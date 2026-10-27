package com.hora.clock;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Rings an alarm or timer from Android itself: the sound chosen in Hora (a rendered copy of a built-in sound, or
 * your own song), its vibration, a gentle fade-in, and ending the ring if nobody answers. Because it doesn't need
 * Hora's screen, it rings the same whether the phone is locked or you're in another app. Its notification has
 * Stop and Snooze (or +1 min for timers); over the lock screen it opens Hora's ring screen instead.
 */
public class RingService extends Service {
    static final String EXTRA_EV = "ev";
    static volatile RingService instance;

    private static final AudioAttributes ALARM = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();

    private final Handler h = new Handler(Looper.getMainLooper());
    private JSONObject ev;
    private String key;
    private long started, endsAt;
    private MediaPlayer mp;
    private PowerManager.WakeLock wl;
    private AudioFocusRequest focus;

    static boolean start(Context c, JSONObject ev) {
        try {
            c.startForegroundService(new Intent(c, RingService.class).putExtra(EXTRA_EV, ev.toString()));
            return true;
        } catch (Exception e) {
            return false;   // Android wouldn't let it start; the caller falls back to the system alarm sound
        }
    }

    static String ringingKey() {
        RingService r = instance;
        String k = r != null ? r.key : null;
        return k != null ? k : "";
    }

    static long left() {
        RingService r = instance;
        return r != null && r.key != null ? Math.max(0, r.endsAt - System.currentTimeMillis()) : 0;
    }

    /** Hora's own ring screen stopped or snoozed it; Hora keeps track of that itself. */
    static void stopQuietly() {
        RingService r = instance;
        if (r != null) r.h.post(() -> r.finish("app", false, true));
    }

    /** From the notification's buttons. */
    static boolean act(String key, String how) {
        RingService r = instance;
        if (r == null || key == null || !key.equals(r.key)) return false;
        r.h.post(() -> r.finish(how, true, true));
        return true;
    }

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent in, int flags, int startId) {
        instance = this;
        JSONObject e = null;
        try { e = new JSONObject(in.getStringExtra(EXTRA_EV)); } catch (Exception ignored) { }
        String k = e != null ? e.optString("k", "") : "";
        if (k.isEmpty() || k.equals(key)) {
            // Android requires every start to show the notification, even one that changes nothing
            if (key != null) foreground(build());
            else { foreground(new Notification.Builder(this, AlarmReceiver.CHANNEL).setSmallIcon(R.drawable.ic_stat_hora).build()); stopAll(); }
            return START_NOT_STICKY;
        }
        // a new ring while another is still going: the first one is treated as unanswered
        if (key != null) finish("auto", true, false);
        begin(e);
        return START_NOT_STICKY;
    }

    private void begin(JSONObject e) {
        ev = e;
        key = e.optString("k");
        started = System.currentTimeMillis();
        endsAt = started + Math.max(30_000, e.optLong("ringMs", 10 * 60_000));
        Scheduler.markDone(this, key);
        Scheduler.prefs(this).edit().putString("pending", key).putLong("pendingAt", started)
                .putString("ringing", key).remove("soundOk").apply();
        foreground(build());

        PowerManager pm = getSystemService(PowerManager.class);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hora:ring");
        wl.acquire(endsAt - started + 60_000);

        AudioManager am = getSystemService(AudioManager.class);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(ALARM).setOnAudioFocusChangeListener(f -> { }).build();
        try { am.requestAudioFocus(focus); } catch (Exception ignored) { }

        play();
        vibrate();
        h.postDelayed(() -> finish("auto", true, true), endsAt - started);
        if (e.optBoolean("gentle", false)) h.post(ramp);
    }

    /* ---- sound ---- */

    private float volume() {
        if (ev == null || !ev.optBoolean("gentle", false)) return 1f;
        return Math.min(1f, .12f + (System.currentTimeMillis() - started) / 30_000f);   // louder over 30 seconds
    }

    private final Runnable ramp = new Runnable() {
        @Override
        public void run() {
            if (mp == null || key == null) return;
            float v = volume();
            try { mp.setVolume(v, v); } catch (Exception ignored) { }
            if (v < 1f) h.postDelayed(this, 250);
        }
    };

    private void play() {
        File f = new File(new File(getFilesDir(), "sounds"), safe(ev.optString("snd", "")));
        if (!f.isFile() || f.length() == 0 || !startPlayer(f, null)) fallback();
    }

    private boolean startPlayer(File f, Uri uri) {
        releasePlayer();
        try {
            MediaPlayer p = new MediaPlayer();
            p.setAudioAttributes(ALARM);
            if (f != null) {
                try (FileInputStream in = new FileInputStream(f)) { p.setDataSource(in.getFD()); }
            } else {
                p.setDataSource(this, uri);
            }
            p.setLooping(true);
            p.setOnErrorListener((pl, what, extra) -> { if (f != null) h.post(this::fallback); return true; });
            p.prepare();
            float v = volume();
            p.setVolume(v, v);
            p.start();
            mp = p;
            AlarmReceiver.soundStarted(this);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Hora's sound couldn't be played (missing or unreadable file): the phone's own alarm sound instead. */
    private void fallback() {
        if (key == null) return;
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (u == null) u = Settings.System.DEFAULT_ALARM_ALERT_URI;
        if (!startPlayer(null, u)) BackupReceiver.ring(this, key, ev.optString("label", "Hora"));
    }

    @SuppressWarnings("deprecation")
    private void vibrate() {
        try {
            String[] parts = ev.optString("vib", "").split(",");
            if (parts.length < 2) return;
            long[] t = new long[parts.length + 1];
            for (int i = 0; i < parts.length; i++) t[i + 1] = Long.parseLong(parts[i].trim());
            Vibrator v = getSystemService(Vibrator.class);
            if (v != null && v.hasVibrator()) v.vibrate(VibrationEffect.createWaveform(t, 1), ALARM);
        } catch (Exception ignored) {
        }
    }

    private void releasePlayer() {
        if (mp == null) return;
        try { mp.stop(); } catch (Exception ignored) { }
        try { mp.release(); } catch (Exception ignored) { }
        mp = null;
    }

    /* ---- ending ---- */

    /**
     * how: "stop", "snooze", "plus" (a timer's extra minute), "auto" (nobody answered) or "app" (Hora's own ring
     * screen handled it). record: tell Hora what happened, so it catches up when it next opens.
     */
    private void finish(String how, boolean record, boolean stopService) {
        if (key == null) { if (stopService) stopAll(); return; }
        String k = key;
        JSONObject e = ev;
        key = null;
        ev = null;
        h.removeCallbacksAndMessages(null);
        releasePlayer();
        try { Vibrator v = getSystemService(Vibrator.class); if (v != null) v.cancel(); } catch (Exception ignored) { }
        try { if (focus != null) getSystemService(AudioManager.class).abandonAudioFocusRequest(focus); } catch (Exception ignored) { }
        if (wl != null && wl.isHeld()) wl.release();

        boolean timer = k.startsWith("t");
        long now = System.currentTimeMillis();
        long off = Scheduler.keyTime(k) - (long) e.optDouble("at", Scheduler.keyTime(k));
        String id = k.substring(1, k.indexOf('@'));
        if ("auto".equals(how)) {
            how = !timer && "snooze".equals(e.optString("after", "snooze")) && e.optInt("auto", 0) < 3 ? "autosnooze" : "stop";
        }
        JSONObject next = null, act = new JSONObject();
        try {
            act.put("key", k);
            if (how.endsWith("snooze") && !timer) {
                int auto = how.equals("autosnooze") ? e.optInt("auto", 0) + 1 : 0;
                long until = now + e.optLong("snooze", 9) * 60_000L;
                next = new JSONObject(e.toString()).put("k", "s" + id + "@" + (until + off)).put("at", until)
                        .put("auto", auto).put("label", e.optString("name", "Alarm") + " (snoozed)");
                act.put("do", "snooze").put("until", until + off).put("auto", auto);
            } else if ("plus".equals(how) && timer) {
                long until = now + 60_000;
                next = new JSONObject(e.toString()).put("k", "t" + id + "@" + (until + off)).put("at", until);
                act.put("do", "plus").put("until", until + off);
            } else {
                act.put("do", "stop");
            }
        } catch (Exception ignored) {
        }
        // the ring that just ended leaves Android's list; a snooze or extra minute joins it
        if (record) Scheduler.addAction(this, act);
        if (!"app".equals(how)) Scheduler.replace(this, k, next);
        Scheduler.prefs(this).edit().remove("ringing").remove("pending").apply();
        AlarmReceiver.cancelBackup(this);
        if (record) MainActivity.pushActions();
        if (stopService) stopAll();
    }

    private void stopAll() {
        try { stopForeground(STOP_FOREGROUND_REMOVE); } catch (Exception ignored) { }
        instance = null;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (key != null) finish("stop", true, false);
        if (instance == this) instance = null;
        super.onDestroy();
    }

    /* ---- the notification ---- */

    private void foreground(Notification n) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                try { startForeground(AlarmReceiver.NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED); }
                catch (Exception e) { startForeground(AlarmReceiver.NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK); }
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(AlarmReceiver.NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(AlarmReceiver.NOTIFICATION_ID, n);
            }
        } catch (Exception e) {
            // still show it, so Stop and Snooze are reachable
            try { getSystemService(android.app.NotificationManager.class).notify(AlarmReceiver.NOTIFICATION_ID, n); } catch (Exception ignored) { }
        }
    }

    private Notification build() {
        boolean timer = key.startsWith("t");
        String name = ev.optString("name", ev.optString("label", "Hora"));
        PendingIntent open = PendingIntent.getActivity(this, 2, AlarmReceiver.openIntent(this, key),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = new Notification.Builder(this, AlarmReceiver.CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_hora)
                .setContentTitle(timer ? name + " is done" : name)
                .setContentText(timer ? "Time's up" : (key.startsWith("s") ? "Snoozed alarm · " : "Alarm · ") + time(this, started, ev.optBoolean("h24", true)))
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setFullScreenIntent(open, true)
                .setContentIntent(open)
                .setOngoing(true)
                .setAutoCancel(false)
                .setWhen(started)
                .setShowWhen(true)
                .setUsesChronometer(true);   // counts how long it has been ringing
        Icon ic = Icon.createWithResource(this, R.drawable.ic_stat_hora);
        if (timer) {
            b.addAction(new Notification.Action.Builder(ic, "+1 min", ActionReceiver.pi(this, ActionReceiver.PLUS, key)).build());
        } else {
            b.addAction(new Notification.Action.Builder(ic, "Snooze · " + ev.optInt("snooze", 9) + " min", ActionReceiver.pi(this, ActionReceiver.SNOOZE, key)).build());
        }
        b.addAction(new Notification.Action.Builder(ic, "Stop", ActionReceiver.pi(this, ActionReceiver.STOP, key)).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    static String time(Context c, long ms, boolean h24) {
        return new SimpleDateFormat(h24 ? "HH:mm" : "h:mm a", Locale.getDefault()).format(new Date(ms));
    }

    static String safe(String name) {
        return name == null ? "" : name.replaceAll("[^A-Za-z0-9_]", "");
    }
}
