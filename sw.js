const CACHE_NAME = 'sped-link-cache-v1';
const OFFLINE_PAGE = '/index.html';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // Only handle GET
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cachedRes => {
      if (cachedRes) return cachedRes;
      return fetch(event.request).then(networkRes => {
        // Optionally cache new requests
        return caches.open(CACHE_NAME).then(cache => {
          // avoid caching opaque requests (like third-party)
          if (networkRes && networkRes.type === 'basic') {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        });
      }).catch(() => caches.match(OFFLINE_PAGE));
    })
  );
});
