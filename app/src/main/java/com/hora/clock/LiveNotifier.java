package com.hora.clock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

/**
 * The live pill, outside the app. A running timer or stopwatch is an ongoing notification whose clock
 * the system counts by itself, so it keeps ticking even while Hora is closed. On Android 16 it asks to
 * be promoted to a Live Update: a chip in the status bar and a card at the top of the lock screen
 * (OPPO's Fluid Cloud and Samsung's Now Bar show these too, where the phone supports it).
 *
 * Android counts the clock by itself but not the progress bar, so while a timer runs the notification is
 * posted again every few seconds with the bar moved on. A running timer also has +30 s and +1 min buttons,
 * which work without opening Hora.
 */
final class LiveNotifier {
    static final String CHANNEL = "hora_live_v1";
    static final int ID = 9;
    static final String ACTION_OPEN = "com.hora.clock.LIVE";

    private static final Handler H = new Handler(Looper.getMainLooper());
    private static JSONObject cur;     // what's shown now, so the bar can move on and time can be added
    private static Context app;
    private static final Runnable TICK = new Runnable() {
        @Override
        public void run() {
            JSONObject o = cur;
            if (o == null || app == null) return;
            post(app, o);
            long left = o.optLong("when") - System.currentTimeMillis();
            if (left > 0) H.postDelayed(this, step(o.optLong("total", 1)));
        }
    };

    private LiveNotifier() {}

    /** The bar moves in about 300 steps, at most once a second (Android limits how often it may be updated). */
    private static long step(long total) {
        return Math.max(1000, Math.min(15_000, total / 300));
    }

    /**
     * json: { kind: "timer"|"sw", key (the timer's ring key), title, text, when (device ms), running, left, total, chip }
     * "" clears it.
     */
    static synchronized void show(Context c, String json) {
        try {
            H.removeCallbacks(TICK);
            if (json == null || json.isEmpty()) { cur = null; clear(c); return; }
            app = c.getApplicationContext();
            cur = new JSONObject(json);
            post(app, cur);
            if ("timer".equals(cur.optString("kind")) && cur.optBoolean("running")) H.postDelayed(TICK, step(cur.optLong("total", 1)));
        } catch (Exception ignored) {
            // a pill that can't be shown must never crash the app
        }
    }

    /**
     * +30 s or +1 min from the notification. The timer's ring moves later, the notification updates at once,
     * and Hora is told so its own timer matches when it next opens.
     */
    static synchronized void add(Context c, String key, long ms) {
        try {
            JSONObject o = cur;
            if (o == null || !key.equals(o.optString("key")) || !o.optBoolean("running")) return;
            String id = key.substring(1, key.indexOf('@'));
            long newKeyAt = Scheduler.keyTime(key) + ms, when = o.optLong("when") + ms;
            String nk = "t" + id + "@" + newKeyAt;
            JSONObject ev = Scheduler.find(c, key);
            if (ev != null) {
                ev = new JSONObject(ev.toString()).put("k", nk).put("at", ev.optDouble("at") + ms);
                Scheduler.replace(c, key, ev);
            }
            o.put("key", nk).put("when", when).put("total", o.optLong("total") + ms)
                    .put("text", "Ends " + RingService.time(c, when, o.optBoolean("h24", true)) + o.optString("more", ""));
            Scheduler.addAction(c, new JSONObject().put("key", key).put("do", "add").put("ms", ms).put("until", newKeyAt));
            MainActivity.pushActions();
            show(c, o.toString());
        } catch (Exception ignored) {
        }
    }

    private static void post(Context c, JSONObject o) {
        try {
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Running timers and stopwatch", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Shows a running timer or the stopwatch in the status bar");
                ch.setSound(null, null);
                ch.enableVibration(false);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            boolean timer = "timer".equals(o.optString("kind")), running = o.optBoolean("running");
            long when = o.optLong("when"), total = Math.max(1, o.optLong("total", 1));
            // while running, what's left is worked out now, so the bar keeps moving
            long left = timer && running ? Math.max(0, when - System.currentTimeMillis()) : o.optLong("left");
            int done = (int) Math.round(1000.0 * Math.min(total, Math.max(0, total - left)) / total);

            Intent open = new Intent(c, MainActivity.class).setAction(ACTION_OPEN)
                    .putExtra("tab", timer ? "timer" : "stopwatch")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, 6, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification.Builder b = new Notification.Builder(c, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_hora)
                    .setContentTitle(o.optString("title", "Hora"))
                    .setContentText(o.optString("text", ""))
                    .setCategory(Notification.CATEGORY_STOPWATCH)
                    .setVisibility(Notification.VISIBILITY_PUBLIC)
                    .setColor(Color.parseColor("#FF6F91"))
                    .setContentIntent(pi)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setLocalOnly(true);
            if (running) {
                // the system ticks the clock by itself, in the notification and in the status bar chip
                b.setWhen(when).setShowWhen(true).setUsesChronometer(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setChronometerCountDown(timer);
                if (timer) b.setTimeoutAfter(Math.max(1000, when - System.currentTimeMillis() + 1500));
            } else {
                b.setShowWhen(false);
            }
            String key = o.optString("key", "");
            if (timer && running && !key.isEmpty()) {
                Icon ic = Icon.createWithResource(c, R.drawable.ic_stat_hora);
                b.addAction(new Notification.Action.Builder(ic, "+30 s", ActionReceiver.pi(c, ActionReceiver.ADD30, key)).build());
                b.addAction(new Notification.Action.Builder(ic, "+1 min", ActionReceiver.pi(c, ActionReceiver.ADD60, key)).build());
            }
            if (Build.VERSION.SDK_INT >= 36) {
                Notification.ProgressStyle st = new Notification.ProgressStyle().setStyledByProgress(false);
                if (timer) st.setProgress(done).setProgressSegments(
                        java.util.Collections.singletonList(new Notification.ProgressStyle.Segment(1000).setColor(Color.parseColor("#FF6F91"))));
                else st.setProgressIndeterminate(running);
                b.setStyle(st);
                String chip = o.optString("chip", "");
                if (!running && !chip.isEmpty()) b.setShortCriticalText(chip);
                Bundle ex = new Bundle();
                ex.putBoolean("android.requestPromotedOngoing", true);   // Notification.EXTRA_REQUEST_PROMOTED_ONGOING (API 36.1)
                b.addExtras(ex);
            } else if (timer) {
                b.setProgress(1000, done, false);
            }
            nm.notify(ID, b.build());
        } catch (Exception ignored) {
        }
    }

    static synchronized void clear(Context c) {
        H.removeCallbacks(TICK);
        cur = null;
        try { c.getSystemService(NotificationManager.class).cancel(ID); } catch (Exception ignored) {}
    }
}
