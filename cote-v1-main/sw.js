const CACHE_VERSION = "v2026-05-24-01";
const CACHE_NAME = `cote-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/login.html",
  "/registration.html",
  "/teacher-login.html",
  "/teacher-register.html",
  "/dashboard.html",
  "/admin.html",
  "/super-admin.html",
  "/style.css",
  "/login.js",
  "/teacher-login.js",
  "/teacher-register.js",
  "/script.js",
  "/dashboard.js",
  "/admin.js",
  "/super-admin.js",
  "/firebase.js",
  "/pwa-updates.js",
  "/manifest.json",
  "/audio/background-music.MP3",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/cote-logo.png"
];

const HTML_EXTENSIONS = new Set(["", ".html"]);

function isHtmlRequest(request, url) {
  if (request.mode === "navigate") return true;

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const extension = url.pathname.includes(".")
    ? url.pathname.slice(url.pathname.lastIndexOf(".")).toLowerCase()
    : "";

  return acceptsHtml || HTML_EXTENSIONS.has(extension);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || cache.match("/index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cached);

  return cached || fresh;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("cote-cache-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (isHtmlRequest(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
