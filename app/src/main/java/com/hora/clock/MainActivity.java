package com.hora.clock;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.AlarmClock;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Hora's whole interface is the web app, bundled in the APK. This activity hosts it full screen and
 * gives it what a browser can't: alarms that ring when the app is closed, vibration, the volume, and
 * opening over the lock screen when something rings.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int REQ_FILE = 42, REQ_NOTIF = 9;

    private WebView web;
    private boolean loaded = false;
    private final List<String> pendingJs = new ArrayList<>();
    private ValueCallback<Uri[]> fileCb;
    private float insetTop = 24, insetBottom = 0;
    private int savedMusicVolume = -1;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // draw behind the status and navigation bars so the hero can reach the top edge
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) getWindow().setNavigationBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b1433"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // so an alarm can make sound without a tap
        s.setAllowFileAccess(false);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loaded = true;
                sendInsets();
                for (String code : pendingJs) web.evaluateJavascript(code, null);
                pendingJs.clear();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "HoraNative");

        web.setOnApplyWindowInsetsListener((v, ins) -> {
            float d = getResources().getDisplayMetrics().density;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = ins.getInsets(WindowInsets.Type.systemBars());
                insetTop = bars.top / d;
                insetBottom = bars.bottom / d;
            } else {
                insetTop = ins.getSystemWindowInsetTop() / d;
                insetBottom = ins.getSystemWindowInsetBottom() / d;
            }
            sendInsets();
            return ins;
        });

        AlarmReceiver.ensureChannel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }

        web.loadUrl(START);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // a ring that went off while Hora wasn't on screen, e.g. a notification that wasn't tapped
        SharedPreferences p = Scheduler.prefs(this);
        String key = p.getString("pending", null);
        if (key != null) {
            if (System.currentTimeMillis() - p.getLong("pendingAt", 0) < 15 * 60_000) js("window.horaFire&&horaFire(" + JSONObject.quote(key) + ")");
            p.edit().remove("pending").apply();
        }
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    private void handleIntent(Intent i) {
        if (i == null || i.getAction() == null) return;
        try {
            switch (i.getAction()) {
                case Scheduler.ACTION_FIRE: {
                    showOverLockScreen(true);
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    String key = i.getStringExtra("key");
                    if (key != null) js("window.horaFire&&horaFire(" + JSONObject.quote(key) + ")");
                    break;
                }
                case AlarmClock.ACTION_SET_ALARM: {
                    JSONObject o = new JSONObject().put("type", "alarm");
                    if (i.hasExtra(AlarmClock.EXTRA_HOUR)) {
                        o.put("h", i.getIntExtra(AlarmClock.EXTRA_HOUR, 7)).put("m", i.getIntExtra(AlarmClock.EXTRA_MINUTES, 0));
                    } else {
                        o.put("type", "alarms");
                    }
                    if (i.hasExtra(AlarmClock.EXTRA_MESSAGE)) o.put("label", i.getStringExtra(AlarmClock.EXTRA_MESSAGE));
                    ArrayList<Integer> days = i.getIntegerArrayListExtra(AlarmClock.EXTRA_DAYS);
                    if (days != null) {
                        int[] week = new int[7];   // Hora's week starts on Monday
                        for (Integer d : days) if (d != null) week[(d + 5) % 7] = 1;
                        JSONArray a = new JSONArray();
                        for (int w : week) a.put(w);
                        o.put("days", a);
                    }
                    js("window.horaIntent&&horaIntent(" + o + ")");
                    break;
                }
                case AlarmClock.ACTION_SET_TIMER: {
                    JSONObject o = new JSONObject().put("type", "timer").put("seconds", i.getIntExtra(AlarmClock.EXTRA_LENGTH, 0));
                    if (i.hasExtra(AlarmClock.EXTRA_MESSAGE)) o.put("label", i.getStringExtra(AlarmClock.EXTRA_MESSAGE));
                    js("window.horaIntent&&horaIntent(" + o + ")");
                    break;
                }
                case AlarmClock.ACTION_SHOW_ALARMS:
                    js("window.horaIntent&&horaIntent({type:'alarms'})");
                    break;
                case AlarmClock.ACTION_SHOW_TIMERS:
                    js("window.horaIntent&&horaIntent({type:'timers'})");
                    break;
                default:
                    break;
            }
        } catch (Exception ignored) {
        }
    }

    private void js(String code) {
        runOnUiThread(() -> {
            if (loaded) web.evaluateJavascript(code, null);
            else pendingJs.add(code);
        });
    }

    private void sendInsets() {
        if (loaded) web.evaluateJavascript("window.horaInsets&&horaInsets(" + insetTop + "," + insetBottom + ")", null);
    }

    private void showOverLockScreen(boolean on) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(on);
            setTurnScreenOn(on);
        } else {
            int f = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (on) getWindow().addFlags(f); else getWindow().clearFlags(f);
        }
    }

    /** Hora's sounds play on the media volume; make sure that's at least as loud as the alarm volume. */
    private void raiseVolume() {
        try {
            AudioManager am = getSystemService(AudioManager.class);
            int maxM = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            float alarm = am.getStreamVolume(AudioManager.STREAM_ALARM) / (float) Math.max(1, am.getStreamMaxVolume(AudioManager.STREAM_ALARM));
            int target = Math.max(Math.round(alarm * maxM), Math.round(0.4f * maxM));
            int cur = am.getStreamVolume(AudioManager.STREAM_MUSIC);
            if (cur < target) {
                if (savedMusicVolume < 0) savedMusicVolume = cur;
                am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0);
            }
        } catch (Exception ignored) {
        }
    }

    private void restoreVolume() {
        if (savedMusicVolume < 0) return;
        try {
            getSystemService(AudioManager.class).setStreamVolume(AudioManager.STREAM_MUSIC, savedMusicVolume, 0);
        } catch (Exception ignored) {
        }
        savedMusicVolume = -1;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.horaBack?horaBack():false", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
        }
    }

    @Override
    protected void onDestroy() {
        restoreVolume();
        web.destroy();
        super.onDestroy();
    }

    /** Everything the web app can ask Android for, as window.HoraNative. */
    private class Bridge {
        @JavascriptInterface
        public void schedule(String json) {
            Scheduler.save(MainActivity.this, json);
        }

        @JavascriptInterface
        public void ringing(boolean on, boolean soundStarted) {
            runOnUiThread(() -> {
                if (on) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    raiseVolume();
                    // Hora's own sound is playing, so the backup system alarm sound can stop
                    if (soundStarted) AlarmReceiver.cancel(MainActivity.this);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    showOverLockScreen(false);
                    AlarmReceiver.cancel(MainActivity.this);
                    restoreVolume();
                    Vibrator vib = getSystemService(Vibrator.class);
                    if (vib != null) vib.cancel();
                }
            });
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(String csv) {
            Vibrator vib = getSystemService(Vibrator.class);
            if (vib == null || !vib.hasVibrator()) return;
            try {
                String[] parts = csv.split(",");
                if (parts.length == 1 && Long.parseLong(parts[0].trim()) == 0) { vib.cancel(); return; }
                long[] pattern = new long[parts.length + 1];
                for (int k = 0; k < parts.length; k++) pattern[k + 1] = Long.parseLong(parts[k].trim());
                AudioAttributes aa = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
                vib.vibrate(VibrationEffect.createWaveform(pattern, -1), aa);
            } catch (Exception ignored) {
            }
        }

        /** Same idea as the web version: several timed requests, each bounding the clock offset to one second. */
        @JavascriptInterface
        public void checkClock() {
            new Thread(() -> {
                double lo = Double.NEGATIVE_INFINITY, hi = Double.POSITIVE_INFINITY;
                int n = 0;
                for (int i = 0; i < 7; i++) {
                    try {
                        long t0 = System.currentTimeMillis();
                        HttpURLConnection con = (HttpURLConnection) new URL("https://www.google.com/generate_204").openConnection();
                        con.setRequestMethod("HEAD");
                        con.setUseCaches(false);
                        con.setConnectTimeout(4000);
                        con.setReadTimeout(4000);
                        con.getResponseCode();
                        long t1 = System.currentTimeMillis();
                        long server = con.getDate();
                        con.disconnect();
                        if (server == 0) break;
                        lo = Math.max(lo, server - t1);
                        hi = Math.min(hi, server + 1000 - t0);
                        n++;
                    } catch (Exception e) {
                        break;
                    }
                    try { Thread.sleep(137 + i * 31); } catch (InterruptedException ignored) {}
                }
                String call = (n >= 2 && lo <= hi) ? "window.horaClock&&horaClock(" + n + "," + lo + "," + hi + ")" : "window.horaClock&&horaClock(0,0,0)";
                js(call);
            }).start();
        }

        @JavascriptInterface
        public void statusBar(boolean lightBackground) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController c = getWindow().getInsetsController();
                    if (c == null) return;
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    c.setSystemBarsAppearance(lightBackground ? mask : 0, mask);
                } else {
                    View d = getWindow().getDecorView();
                    int f = d.getSystemUiVisibility();
                    int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    d.setSystemUiVisibility(lightBackground ? (f | light) : (f & ~light));
                }
            });
        }

        @JavascriptInterface
        public boolean exactAllowed() {
            return Scheduler.canExact(MainActivity.this);
        }

        @JavascriptInterface
        public boolean batteryIgnored() {
            PowerManager pm = getSystemService(PowerManager.class);
            return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return getSystemService(NotificationManager.class).areNotificationsEnabled();
        }

        @JavascriptInterface
        public boolean fullScreenAllowed() {
            if (Build.VERSION.SDK_INT < 34) return true;
            return getSystemService(NotificationManager.class).canUseFullScreenIntent();
        }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void openSettings(String what) {
            runOnUiThread(() -> {
                Uri pkg = Uri.parse("package:" + getPackageName());
                Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg);
                Intent i;
                switch (what) {
                    case "exact":
                        i = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) : details;
                        break;
                    case "battery":
                        i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg);
                        break;
                    case "notif":
                        i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                        break;
                    case "fullscreen":
                        i = Build.VERSION.SDK_INT >= 34 ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) : details;
                        break;
                    default:
                        i = details;
                }
                try {
                    startActivity(i);
                } catch (Exception e) {
                    try { startActivity(details); } catch (Exception ignored) {}
                }
            });
        }
    }
}
