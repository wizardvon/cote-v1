const CACHE_NAME = 'cote-web-app-v3';
const ASSETS_TO_CACHE = [
  '/cote-v1/',
  '/cote-v1/index.html',
  '/cote-v1/login.html',
  '/cote-v1/style.css',
  '/cote-v1/script.js',
  '/cote-v1/login.js',
  '/cote-v1/firebase.js',
  '/cote-v1/manifest.json',
  '/cote-v1/icons/icon-192.png',
  '/cote-v1/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request)));
});
