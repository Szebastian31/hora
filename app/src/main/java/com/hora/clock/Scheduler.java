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
 * Keeps Android's alarm list in step with Hora's. The web app sends every upcoming ring (alarms, snoozes, timers,
 * bedtime reminders) as JSON, with what's needed to ring it without Hora open: sound, vibration, snooze length.
 * They're saved so they can be restored after a reboot. Things done from notifications while Hora is closed
 * (stop, snooze, dismiss) are kept as "actions" for the web app to catch up on when it next opens.
 */
public final class Scheduler {
    static final String PREFS = "hora";
    private static final String EVENTS = "events", COUNT = "count", ACTIONS = "actions", DONE = "done";
    static final String ACTION_FIRE = "com.hora.clock.FIRE";

    private Scheduler() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void save(Context c, String json) {
        prefs(c).edit().putString(EVENTS, json).apply();
        apply(c);
    }

    static synchronized JSONArray events(Context c) {
        try { return new JSONArray(prefs(c).getString(EVENTS, "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    static synchronized JSONObject find(Context c, String key) {
        JSONArray arr = events(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && key.equals(o.optString("k"))) return o;
        }
        return null;
    }

    /** Drops one ring (it has rung, or was dismissed) and adds another (a snooze, a timer's extra minute). */
    static synchronized void replace(Context c, String removeKey, JSONObject add) {
        JSONArray arr = events(c), out = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && !o.optString("k").equals(removeKey)) out.put(o);
        }
        if (add != null) out.put(add);
        prefs(c).edit().putString(EVENTS, out.toString()).apply();
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
            JSONArray arr = events(c);
            long now = System.currentTimeMillis();
            boolean exact = canExact(c);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = (long) o.getDouble("at");
                if (at < now - 60_000 || isDone(c, o.getString("k"))) continue;
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
        Upcoming.refresh(c);
    }

    /* ---- what happened in notifications, for the web app ---- */

    static synchronized void addAction(Context c, JSONObject a) {
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(ACTIONS, "[]"));
            arr.put(a);
            prefs(c).edit().putString(ACTIONS, arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static synchronized String takeActions(Context c) {
        String s = prefs(c).getString(ACTIONS, "[]");
        prefs(c).edit().remove(ACTIONS).apply();
        return s;
    }

    /** Rings that have been handled, so neither Android nor Hora rings them again. The last 30 are kept. */
    static synchronized void markDone(Context c, String key) {
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(DONE, "[]")), out = new JSONArray();
            for (int i = Math.max(0, arr.length() - 29); i < arr.length(); i++) out.put(arr.getString(i));
            out.put(key);
            prefs(c).edit().putString(DONE, out.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static synchronized boolean isDone(Context c, String key) {
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(DONE, "[]"));
            for (int i = 0; i < arr.length(); i++) if (key.equals(arr.getString(i))) return true;
        } catch (Exception ignored) {
        }
        return false;
    }

    /** Ring keys look like "a3@1729411200000": the moment is in Hora's corrected time, "at" is device time. */
    static long keyTime(String key) {
        try { return Long.parseLong(key.substring(key.indexOf('@') + 1)); } catch (Exception e) { return 0; }
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
    static PendingIntent showPi(Context c) {
        Intent i = new Intent(c, MainActivity.class).setAction("android.intent.action.SHOW_ALARMS");
        return PendingIntent.getActivity(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
