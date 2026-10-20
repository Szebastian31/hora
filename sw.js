const VERSION = "hora-v14";
const FILES = ["./", "index.html", "app.js", "scenes.js", "manifest.webmanifest", "icons/icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  // Clock checks (HEAD with ?hora=) must always reach the network.
  if (r.method !== "GET" || r.url.includes("hora=")) return;
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); return res;
  }).catch(() => caches.match("index.html"))));
});
