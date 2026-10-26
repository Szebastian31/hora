package com.hora.clock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;

import org.json.JSONObject;

/**
 * The live pill, outside the app. A running timer or stopwatch is an ongoing notification whose clock
 * the system counts by itself, so it keeps ticking even while Hora is closed. On Android 16 it asks to
 * be promoted to a Live Update: a chip in the status bar and a card at the top of the lock screen
 * (OPPO's Fluid Cloud and Samsung's Now Bar show these too, where the phone supports it).
 */
final class LiveNotifier {
    static final String CHANNEL = "hora_live_v1";
    static final int ID = 9;
    static final String ACTION_OPEN = "com.hora.clock.LIVE";

    private LiveNotifier() {}

    /** json: { kind: "timer"|"sw", title, text, when (device ms), down, running, left, total, chip } */
    static void show(Context c, String json) {
        try {
            if (json == null || json.isEmpty()) { clear(c); return; }
            JSONObject o = new JSONObject(json);
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
            long when = o.optLong("when"), left = o.optLong("left"), total = Math.max(1, o.optLong("total", 1));

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
            if (Build.VERSION.SDK_INT >= 36) {
                Notification.ProgressStyle st = new Notification.ProgressStyle().setStyledByProgress(false);
                if (timer) st.setProgress((int) Math.round(1000.0 * (total - left) / total)).setProgressSegments(
                        java.util.Collections.singletonList(new Notification.ProgressStyle.Segment(1000).setColor(Color.parseColor("#FF6F91"))));
                else st.setProgressIndeterminate(running);
                b.setStyle(st);
                String chip = o.optString("chip", "");
                if (!running && !chip.isEmpty()) b.setShortCriticalText(chip);
                Bundle ex = new Bundle();
                ex.putBoolean("android.requestPromotedOngoing", true);   // Notification.EXTRA_REQUEST_PROMOTED_ONGOING (API 36.1)
                b.addExtras(ex);
            } else if (timer) {
                b.setProgress(1000, (int) Math.round(1000.0 * (total - left) / total), false);
            }
            nm.notify(ID, b.build());
        } catch (Exception ignored) {
            // a pill that can't be shown must never crash the app
        }
    }

    static void clear(Context c) {
        try { c.getSystemService(NotificationManager.class).cancel(ID); } catch (Exception ignored) {}
    }
}
