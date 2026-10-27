package com.hora.clock;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * "Upcoming alarm · Work · 07:00" with a Dismiss button, from two hours before the next alarm (or for as long as an
 * alarm is snoozed), like the phone's own clock app. Dismissing it means that ring won't happen; a repeating alarm
 * keeps its other days. Android wakes this receiver when the two hours begin.
 */
public class Upcoming extends BroadcastReceiver {
    static final String CHANNEL = "hora_upcoming_v1";
    static final int ID = 10;
    static final long WINDOW = 2 * 60 * 60_000L;

    @Override
    public void onReceive(Context c, Intent in) {
        refresh(c);
    }

    static void refresh(Context c) {
        try {
            JSONObject next = null;
            long nextAt = Long.MAX_VALUE, now = System.currentTimeMillis();
            JSONArray arr = Scheduler.events(c);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                String k = o.optString("k");
                long at = (long) o.optDouble("at", 0);
                if (!(k.startsWith("a") || k.startsWith("s")) || !o.optBoolean("up", true) || at <= now || Scheduler.isDone(c, k)) continue;
                if (at < nextAt) { nextAt = at; next = o; }
            }
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            AlarmManager am = c.getSystemService(AlarmManager.class);
            PendingIntent wake = PendingIntent.getBroadcast(c, 6, new Intent(c, Upcoming.class),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.cancel(wake);
            if (next == null) { nm.cancel(ID); return; }
            boolean snoozed = next.optString("k").startsWith("s");
            if (!snoozed && now < nextAt - WINDOW) {
                nm.cancel(ID);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextAt - WINDOW, wake);
                return;
            }
            post(c, nm, next, nextAt, snoozed);
        } catch (Exception ignored) {
        }
    }

    private static void post(Context c, NotificationManager nm, JSONObject ev, long at, boolean snoozed) {
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Upcoming alarms", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("The next alarm, a couple of hours ahead, so you can dismiss it early");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        String key = ev.optString("k"), name = ev.optString("name", "Alarm");
        String when = day(at) + RingService.time(c, at, ev.optBoolean("h24", true));
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_hora)
                .setContentTitle(snoozed ? "Snoozed alarm" : "Upcoming alarm")
                .setContentText(name + " · " + (snoozed ? "rings again at " : "") + when)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(Scheduler.showPi(c))
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .setTimeoutAfter(Math.max(1000, at - System.currentTimeMillis()))
                .addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat_hora),
                        snoozed ? "Dismiss" : "Dismiss now", ActionReceiver.pi(c, ActionReceiver.DISMISS, key)).build())
                .build();
        try { nm.notify(ID, n); } catch (SecurityException ignored) { }
    }

    /** "" for today, otherwise the short weekday: "Wed 07:00". */
    private static String day(long at) {
        Calendar a = Calendar.getInstance(), b = Calendar.getInstance();
        b.setTimeInMillis(at);
        if (a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)) return "";
        return new SimpleDateFormat("EEE", Locale.getDefault()).format(new Date(at)) + " ";
    }
}
