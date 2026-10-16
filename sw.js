// Service worker: lets the game install as an app and open offline.
// Network first (so updates arrive straight away), cached copy when offline.
const CACHE = "bvb-v2.0.0";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/main.js", "js/sim.js", "js/fighters.js", "js/draw.js", "js/audio.js", "js/net.js", "js/mqtt-lite.js",
  "fonts/kanit-400.woff", "fonts/kanit-500.woff", "fonts/kanit-600.woff", "fonts/lilita-400.woff",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("bvb-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
