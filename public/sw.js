// The Pale Lamps: network first, with everything kept for offline play once installed.
const CACHE = 'pale-lamps-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/first-captain/'))),
  );
});
