package com.hora.clock;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Fires when an alarm, snooze or timer is due. It posts a silent full-screen alarm notification, which
 * wakes the screen and opens Hora over the lock screen, where Hora plays the sound the user chose.
 * The phone's own alarm sound is only a backup: BackupReceiver plays it if Hora's sound hasn't started
 * a few seconds later (for example when Android didn't let Hora open).
 */
public class AlarmReceiver extends BroadcastReceiver {
    // v1 played the system alarm sound the instant it was posted, before Hora's own sound could start
    static final String OLD_CHANNEL = "hora_ring_v1";
    static final String CHANNEL = "hora_ring_v2";
    static final int NOTIFICATION_ID = 7;
    static final long BACKUP_AFTER_MS = 8_000;

    @Override
    public void onReceive(Context c, Intent in) {
        String key = in.getStringExtra("key");
        if (key == null) return;
        String label = in.getStringExtra("label");
        if (key.startsWith("b")) { bedtime(c, key, label); return; }

        // a timer that has ended shouldn't keep counting in the status bar
        if (key.startsWith("t")) LiveNotifier.clear(c);

        Intent open = openIntent(c, key);
        PendingIntent full = PendingIntent.getActivity(c, 2, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // remembered so that opening Hora shortly afterwards still shows the ring;
        // "soundOk" is set by Hora once its own sound is actually playing
        Scheduler.prefs(c).edit().putString("pending", key).putLong("pendingAt", System.currentTimeMillis())
                .putString("ringing", key).remove("soundOk").apply();

        ensureChannel(c);
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_hora)
                .setContentTitle(label != null ? label : "Hora")
                .setContentText(key.startsWith("t") ? "Timer is done · tap to stop" : "Alarm · tap to stop or snooze")
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setFullScreenIntent(full, true)
                .setContentIntent(full)
                .setOngoing(true)
                .setAutoCancel(false)
                .build();
        try {
            c.getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, n);
        } catch (SecurityException ignored) {
            // notifications are switched off for Hora
        }
        scheduleBackup(c, key, label);
        try {
            c.startActivity(open);
        } catch (Exception ignored) {
            // Android may block this while another app is open; the notification covers that case
        }
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

    /** Hora's own sound is playing: the backup isn't needed. */
    static void soundStarted(Context c) {
        Scheduler.prefs(c).edit().putBoolean("soundOk", true).apply();
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

    /** A silent, high-priority channel: it's only there to wake the screen and open Hora. */
    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(OLD_CHANNEL) != null) nm.deleteNotificationChannel(OLD_CHANNEL);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Alarms and timers", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Opens Hora over the lock screen when an alarm or timer goes off");
        ch.setSound(null, null);
        ch.enableVibration(false);   // Hora vibrates with the pattern chosen for the alarm
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    static void cancel(Context c) {
        c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        Scheduler.prefs(c).edit().remove("ringing").apply();
        PendingIntent pi = backupPi(c, "", "", PendingIntent.FLAG_NO_CREATE);
        if (pi != null) { c.getSystemService(AlarmManager.class).cancel(pi); pi.cancel(); }
        BackupReceiver.stop(c);
    }
}
