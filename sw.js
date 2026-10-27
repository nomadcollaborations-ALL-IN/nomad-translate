// Service worker for Nomad Translate.
// Same-origin app files: NETWORK-FIRST (always fresh when online; falls back to cache
// when there's no signal). Cross-origin CDN (the translator library, versioned/immutable):
// CACHE-FIRST. The translation models cache themselves in IndexedDB/Cache Storage.
const CACHE = 'nomad-translate-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    // Network-first: fresh app when online, cached app when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // Cache-first for the versioned CDN library (so it loads with no signal).
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      })
    );
  }
});
