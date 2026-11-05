package com.hora.clock;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.res.Configuration;

import java.util.Locale;

/**
 * The language picked in Hora (the web app tells Android through setLang), for what Android shows outside the app:
 * notifications, their buttons, and the channel names in Settings. Before Hora has said, it follows the phone.
 */
final class Lang {
    private Lang() {}

    /** Hora's code ("pl", "no", "pt"…) as a locale; null until Hora has said. */
    static Locale locale(Context c) {
        String code = Scheduler.prefs(c).getString("lang", "");
        if (code.isEmpty()) return null;
        switch (code) {
            case "no": return Locale.forLanguageTag("nb");     // Hora's Norsk is Bokmål
            case "pt": return Locale.forLanguageTag("pt-BR");  // and its Português is Brazilian
            case "zh": return Locale.forLanguageTag("zh-CN");
            default: return Locale.forLanguageTag(code);
        }
    }

    private static Locale madeFor;
    private static Context made;

    /** c, with its strings in Hora's language. Kept, since the running timer asks every few seconds. */
    static synchronized Context ctx(Context c) {
        Locale l = locale(c);
        if (l == null) return c;
        if (!l.equals(madeFor)) {
            Configuration conf = new Configuration(c.getResources().getConfiguration());
            conf.setLocale(l);
            made = c.getApplicationContext().createConfigurationContext(conf);
            madeFor = l;
        }
        return made;
    }

    static String s(Context c, int id, Object... args) {
        Context l = ctx(c);
        return args.length == 0 ? l.getString(id) : l.getString(id, args);
    }

    /** For times and weekdays: Hora's language, always with Western digits like its clock faces. */
    static Locale format(Context c) {
        Locale l = locale(c);
        if (l == null) l = Locale.getDefault();
        try {
            return new Locale.Builder().setLocale(l).setUnicodeLocaleKeyword("nu", "latn").build();
        } catch (Exception e) {
            return l;   // an old-style locale the builder won't take
        }
    }

    /** The language changed: channels that already exist take the new names in Android's settings. */
    static void relabel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        Context l = ctx(c);
        relabel(nm, l, AlarmReceiver.CHANNEL, R.string.ch_ring, R.string.ch_ring_desc);
        relabel(nm, l, AlarmReceiver.BED_CHANNEL, R.string.ch_bed, R.string.ch_bed_desc);
        relabel(nm, l, BackupReceiver.CHANNEL, R.string.ch_backup, R.string.ch_backup_desc);
        relabel(nm, l, LiveNotifier.CHANNEL, R.string.ch_live, R.string.ch_live_desc);
        relabel(nm, l, Upcoming.CHANNEL, R.string.ch_up, R.string.ch_up_desc);
    }

    private static void relabel(NotificationManager nm, Context l, String id, int name, int desc) {
        try {
            NotificationChannel ch = nm.getNotificationChannel(id);
            if (ch == null) return;
            String n = l.getString(name), d = l.getString(desc);
            if (n.contentEquals(ch.getName()) && d.equals(ch.getDescription())) return;
            ch.setName(n);
            ch.setDescription(d);
            nm.createNotificationChannel(ch);   // for a channel that exists, Android only takes the name and description
        } catch (Exception ignored) {
        }
    }
}
