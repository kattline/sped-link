const CACHE_NAME = 'sped-link-v1';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/', '/index.html', '/styles.css', '/app.js', '/manifest.json'
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then((r) => r || fetch(evt.request).catch(() => caches.match(OFFLINE_URL)))
  );
});

// Placeholder for background sync if implemented later
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncLogsToServer());
  }
});

async function syncLogsToServer() {
  // advanced implementations can use IndexedDB from service worker via idb-keyval or clients.postMessage
}
