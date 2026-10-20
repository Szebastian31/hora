package com.hora.clock;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps Android's alarm list in step with Hora's. The web app sends every upcoming ring
 * (alarms, snoozes, timers) as JSON; they're saved so they can be restored after a reboot.
 */
public final class Scheduler {
    static final String PREFS = "hora";
    private static final String EVENTS = "events", COUNT = "count";
    static final String ACTION_FIRE = "com.hora.clock.FIRE";

    private Scheduler() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void save(Context c, String json) {
        prefs(c).edit().putString(EVENTS, json).apply();
        apply(c);
    }

    static synchronized void apply(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = prefs(c);

        int old = p.getInt(COUNT, 0);
        for (int i = 0; i < old; i++) {
            PendingIntent pi = firePi(c, i, null, null, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }

        int n = 0;
        try {
            JSONArray arr = new JSONArray(p.getString(EVENTS, "[]"));
            long now = System.currentTimeMillis();
            boolean exact = canExact(c);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = (long) o.getDouble("at");
                if (at < now - 60_000) continue;
                PendingIntent pi = firePi(c, n, o.getString("k"), o.optString("label", "Hora"),
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                if (exact) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi(c)), pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                n++;
            }
        } catch (Exception ignored) {
            // bad data from the web app: keep whatever was scheduled successfully
        }
        p.edit().putInt(COUNT, n).apply();
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am.canScheduleExactAlarms();
    }

    private static PendingIntent firePi(Context c, int req, String key, String label, int flags) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE);
        if (key != null) { i.putExtra("key", key); i.putExtra("label", label); }
        return PendingIntent.getBroadcast(c, 1000 + req, i, flags);
    }

    /** What opens when you tap the alarm icon in the status bar or quick settings. */
    private static PendingIntent showPi(Context c) {
        Intent i = new Intent(c, MainActivity.class).setAction("android.intent.action.SHOW_ALARMS");
        return PendingIntent.getActivity(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
