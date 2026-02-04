/* service-worker.js */

const CACHE_NAME = "eazypay-kassa-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/klant-bedankt.html",
  "/kassa-betaald.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: cache basis assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: cleanup oude caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Fetch: network-first voor HTML, cache-first voor assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Alleen eigen origin
  if (url.origin !== self.location.origin) return;

  // Network-first voor html (altijd nieuwste)
  if (req.headers.get("accept") && req.headers.get("accept").includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Cache-first voor rest
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response("Offline", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}
