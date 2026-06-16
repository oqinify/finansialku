const CACHE_NAME = 'finansialku-v46';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become active
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Network First Strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network request succeeds, update the cache
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails (offline), use cache
        return caches.match(event.request);
      })
  );
});
