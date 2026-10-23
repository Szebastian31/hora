// Augur offline cache. Bump VERSION whenever you change a file so phones pick up the update.
const VERSION = "augur-v5";
const LANGS = ["en","pl","de","uk","es","fr","ru","zh","ja","pt","nl","it","hi","ar","el","cs","sv","ko","id","bn","tr","te","ro","hu","fi","no","sk","sw","fa","da","th","vi","bg"];
const FILES = ["./","index.html","i18n.js",...LANGS.map(l => `i18n/${l}.js`),"astro.js","chart.js","native.js","chinese.js","numerology.js","egyptian.js","mayan.js","texts.js","quotes.js","consensus.js","daily.js","week.js",
  "ui.js","draw.js","systems.js","app.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => c.add(f).catch(()=>{})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first, so updates show up straight away; fall back to the cache when offline.
// The birthplace search (another site) is never cached.
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
