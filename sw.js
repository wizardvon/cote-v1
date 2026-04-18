const CACHE_NAME = "cote-web-app-v5";

const APP_SHELL = [
  "/cote-v1/",
  "/cote-v1/index.html",
  "/cote-v1/login.html",
  "/cote-v1/registration.html",
  "/cote-v1/teacher-login.html",
  "/cote-v1/teacher-register.html",
  "/cote-v1/dashboard.html",
  "/cote-v1/admin.html",
  "/cote-v1/style.css",
  "/cote-v1/login.js",
  "/cote-v1/teacher-login.js",
  "/cote-v1/teacher-register.js",
  "/cote-v1/script.js",
  "/cote-v1/dashboard.js",
  "/cote-v1/admin.js",
  "/cote-v1/firebase.js",
  "/cote-v1/manifest.json",
  "/cote-v1/icons/icon-192.png",
  "/cote-v1/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/cote-v1/index.html"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
