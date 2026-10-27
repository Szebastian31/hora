package com.hora.clock;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** The buttons on Hora's notifications: Stop, Snooze and +1 min while ringing, and Dismiss on an upcoming alarm. */
public class ActionReceiver extends BroadcastReceiver {
    static final String STOP = "com.hora.clock.STOP", SNOOZE = "com.hora.clock.SNOOZE",
            PLUS = "com.hora.clock.PLUS", DISMISS = "com.hora.clock.DISMISS",
            ADD30 = "com.hora.clock.ADD30", ADD60 = "com.hora.clock.ADD60";

    static PendingIntent pi(Context c, String action, String key) {
        Intent i = new Intent(c, ActionReceiver.class).setAction(action).putExtra("key", key);
        int req = STOP.equals(action) ? 21 : SNOOZE.equals(action) ? 22 : PLUS.equals(action) ? 23
                : ADD30.equals(action) ? 25 : ADD60.equals(action) ? 26 : 24;
        return PendingIntent.getBroadcast(c, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onReceive(Context c, Intent in) {
        String key = in.getStringExtra("key"), a = in.getAction();
        if (key == null || a == null) return;
        switch (a) {
            case STOP:
            case SNOOZE:
            case PLUS:
                if (!RingService.act(key, STOP.equals(a) ? "stop" : SNOOZE.equals(a) ? "snooze" : "plus")) {
                    // the ring had already ended: just clear the leftover notification
                    AlarmReceiver.cancel(c);
                }
                break;
            case DISMISS:
                // an alarm dismissed before it rings: it won't ring, and Hora is told so it can skip it too
                Scheduler.markDone(c, key);
                try { Scheduler.addAction(c, new JSONObject().put("do", "dismiss").put("key", key)); } catch (Exception ignored) { }
                c.getSystemService(NotificationManager.class).cancel(Upcoming.ID);
                // the next upcoming alarm, if any, takes its place
                Scheduler.replace(c, key, null);
                MainActivity.pushActions();
                break;
            case ADD30:
            case ADD60:
                // more time on a running timer, from its notification
                LiveNotifier.add(c, key, ADD30.equals(a) ? 30_000 : 60_000);
                break;
            default:
                break;
        }
    }
}
