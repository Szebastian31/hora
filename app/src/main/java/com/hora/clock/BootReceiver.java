package com.hora.clock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Android forgets scheduled alarms when the phone restarts or Hora updates; this puts them back. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent in) {
        Scheduler.apply(c);
    }
}
