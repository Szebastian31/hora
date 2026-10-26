package com.hora.clock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.provider.Settings;

/**
 * The safety net. A few seconds after an alarm fires, if Hora's own sound still hasn't started
 * (the screen didn't open, the WebView was slow, the sound file failed), this rings the phone's own
 * alarm sound on a loop so an alarm is never silent.
 */
public class BackupReceiver extends BroadcastReceiver {
    static final String CHANNEL = "hora_backup_v1";
    static final int NOTIFICATION_ID = 6;

    @Override
    public void onReceive(Context c, Intent in) {
        String key = in.getStringExtra("key");
        SharedPreferences p = Scheduler.prefs(c);
        if (key == null || !key.equals(p.getString("ringing", null)) || p.getBoolean("soundOk", false)) return;

        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Backup alarm sound", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Rings the phone's own alarm sound if Hora's sound couldn't start");
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
        String label = in.getStringExtra("label");
        PendingIntent full = PendingIntent.getActivity(c, 5, AlarmReceiver.openIntent(c, key),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_hora)
                .setContentTitle(label != null && !label.isEmpty() ? label : "Hora")
                .setContentText(key.startsWith("t") ? "Timer is done · tap to stop" : "Alarm · tap to stop or snooze")
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setFullScreenIntent(full, true)
                .setContentIntent(full)
                .setOngoing(true)
                .build();
        n.flags |= Notification.FLAG_INSISTENT;
        try { nm.notify(NOTIFICATION_ID, n); } catch (SecurityException ignored) { }
    }

    static void stop(Context c) {
        c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
    }
}
