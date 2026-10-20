package com.hora.clock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.provider.Settings;

/**
 * Fires when an alarm, snooze or timer is due. It posts a full-screen alarm notification, which wakes
 * the screen and opens Hora over the lock screen. The notification also rings the phone's own alarm
 * sound on a loop, as a backup until Hora's own sound has started.
 */
public class AlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL = "hora_ring_v1";
    static final int NOTIFICATION_ID = 7;

    @Override
    public void onReceive(Context c, Intent in) {
        String key = in.getStringExtra("key");
        if (key == null) return;
        String label = in.getStringExtra("label");

        Intent open = new Intent(c, MainActivity.class)
                .setAction(Scheduler.ACTION_FIRE)
                .putExtra("key", key)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent full = PendingIntent.getActivity(c, 2, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // remembered so that opening Hora shortly afterwards still shows the ring
        Scheduler.prefs(c).edit().putString("pending", key).putLong("pendingAt", System.currentTimeMillis()).apply();

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
        n.flags |= Notification.FLAG_INSISTENT;
        try {
            c.getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, n);
        } catch (SecurityException ignored) {
            // notifications are switched off for Hora
        }
        try {
            c.startActivity(open);
        } catch (Exception ignored) {
            // Android may block this while another app is open; the notification covers that case
        }
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Alarms and timers", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Rings when an alarm or timer goes off");
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = Settings.System.DEFAULT_ALARM_ALERT_URI;
        ch.setSound(sound, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 500, 400, 500});
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    static void cancel(Context c) {
        c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
    }
}
