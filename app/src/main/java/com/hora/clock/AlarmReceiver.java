package com.hora.clock;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/**
 * Fires when an alarm, snooze or timer is due, and hands it to RingService, which rings it from Android itself
 * with the sound chosen in Hora. Its notification wakes the screen and opens Hora over the lock screen; while
 * you are using the phone it shows as a pop-up with Stop and Snooze instead, and Hora is never forced open.
 * The phone's own alarm sound is only a backup: BackupReceiver plays it if no sound has started a few seconds
 * later.
 */
public class AlarmReceiver extends BroadcastReceiver {
    // v1 played the system alarm sound the instant it was posted, before Hora's own sound could start;
    // v3 is new so phones where v2's pop-ups were turned off start again from Android's default (pop-ups on)
    static final String[] OLD_CHANNELS = {"hora_ring_v1", "hora_ring_v2"};
    static final String CHANNEL = "hora_ring_v3";
    static final int NOTIFICATION_ID = 7;
    static final long BACKUP_AFTER_MS = 8_000;

    @Override
    public void onReceive(Context c, Intent in) {
        String key = in.getStringExtra("key");
        if (key == null) return;
        String label = in.getStringExtra("label");
        if (key.startsWith("b")) { bedtime(c, key, label); return; }
        // dismissed early from its notification, or already ringing because Hora noticed first
        if (Scheduler.isDone(c, key) || key.equals(RingService.ringingKey())) return;

        // a timer that has ended shouldn't keep counting in the status bar
        if (key.startsWith("t")) LiveNotifier.clear(c);

        JSONObject ev = Scheduler.find(c, key);
        if (ev == null) {
            try {
                ev = new JSONObject().put("k", key).put("label", label).put("name", label != null ? label : "Hora")
                        .put("at", System.currentTimeMillis());
            } catch (Exception e) { return; }
        }
        ensureChannel(c);
        scheduleBackup(c, key, label);
        if (!ring(c, ev)) {
            Scheduler.prefs(c).edit().putString("ringing", key).remove("soundOk").apply();
            BackupReceiver.ring(c, key, label);
        }
    }

    /** Starts ringing; false if Android wouldn't allow it. */
    static boolean ring(Context c, JSONObject ev) {
        ensureChannel(c);
        return RingService.start(c, ev);
    }

    static Intent openIntent(Context c, String key) {
        return new Intent(c, MainActivity.class)
                .setAction(Scheduler.ACTION_FIRE)
                .putExtra("key", key)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    private static PendingIntent backupPi(Context c, String key, String label, int flags) {
        Intent i = new Intent(c, BackupReceiver.class).putExtra("key", key).putExtra("label", label);
        return PendingIntent.getBroadcast(c, 4, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleBackup(Context c, String key, String label) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        long at = System.currentTimeMillis() + BACKUP_AFTER_MS;
        PendingIntent pi = backupPi(c, key, label, PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            if (Scheduler.canExact(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    /** A sound is playing: the backup isn't needed. */
    static void soundStarted(Context c) {
        Scheduler.prefs(c).edit().putBoolean("soundOk", true).apply();
        cancelBackup(c);
    }

    static void cancelBackup(Context c) {
        PendingIntent pi = backupPi(c, "", "", PendingIntent.FLAG_NO_CREATE);
        if (pi != null) { c.getSystemService(AlarmManager.class).cancel(pi); pi.cancel(); }
        BackupReceiver.stop(c);
    }

    /** Bedtime reminders are a quiet notification: no full screen, no looping sound. */
    static final String BED_CHANNEL = "hora_bedtime_v1";
    static final int BED_ID = 8;

    private static void bedtime(Context c, String key, String label) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(BED_CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(BED_CHANNEL, "Bedtime reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("A gentle nudge before your sleep schedule's bedtime");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 120, 1100});
            nm.createNotificationChannel(ch);
        }
        // opens Hora normally (not over the lock screen like an alarm)
        Intent open = new Intent(c, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 3, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, BED_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_hora)
                .setContentTitle("Time to wind down")
                .setContentText(label != null ? label : "Bedtime soon")
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        try { nm.notify(BED_ID, n); } catch (SecurityException ignored) { }
    }

    /** A silent, high-priority channel: Hora plays the sound itself; this wakes the screen and shows Stop and Snooze. */
    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        for (String old : OLD_CHANNELS) if (nm.getNotificationChannel(old) != null) nm.deleteNotificationChannel(old);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Alarms and timers", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Rings alarms and timers, with Stop and Snooze. Keep pop-ups on so they show while you use the phone");
        ch.setSound(null, null);
        ch.enableVibration(false);   // Hora vibrates with the pattern chosen for the alarm
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** Whether the ring notification can pop up over other apps (its channel is still at "high" importance). */
    static boolean popupsAllowed(Context c) {
        ensureChannel(c);
        NotificationChannel ch = c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
        return ch == null || ch.getImportance() >= NotificationManager.IMPORTANCE_HIGH;
    }

    static void cancel(Context c) {
        c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        Scheduler.prefs(c).edit().remove("ringing").apply();
        cancelBackup(c);
    }
}
