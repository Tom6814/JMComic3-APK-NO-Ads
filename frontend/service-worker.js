/* eslint-disable no-restricted-globals */
// ============================================================
// JMComic3 PWA Service Worker v2.0.30
// ============================================================

const CACHE_VERSION = "v2.0.30";
const CACHE_NAME = `jmcomic3-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const FALLBACK_IMAGE = "/images/cover_default.jpg";

// App Shell — must precache for instant offline launch
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/pwa-patch.js",
  "/static/css/main.91718a26.css",
  "/static/js/main.2d30d0cc.js",
  FALLBACK_IMAGE,
];

// ============================================================
// Install — precache app shell
// ============================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing v" + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Precaching app shell…");
      return cache.addAll(APP_SHELL);
    })
  );
  // Activate immediately, don't wait for old tabs to close
  self.skipWaiting();
});

// ============================================================
// Activate — clean old caches & claim clients
// ============================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating v" + CACHE_VERSION);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============================================================
// Fetch — intelligent caching strategies
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests over http(s)
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // ── HTML Navigation → Network-first, fallback to offline page ──
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // ── Images → Cache-first, fallback to placeholder ──
  if (request.destination === "image") {
    event.respondWith(
      fromCache(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
          })
          .catch(() => caches.match(FALLBACK_IMAGE));
      })
    );
    return;
  }

  // ── JS / CSS / Fonts → Stale-while-revalidate ──
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  ) {
    event.respondWith(swrStrategy(request));
    return;
  }

  // ── API / dynamic → Network-first ──
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache successful GET responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
  );
});

// ============================================================
// Message handler — app can control SW lifecycle
// ============================================================
self.addEventListener("message", (event) => {
  const { action } = event.data || {};

  switch (action) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "GET_VERSION":
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: CACHE_VERSION });
      }
      break;

    case "CLEAR_CACHE":
      event.waitUntil(
        caches.delete(CACHE_NAME).then(() => {
          console.log("[SW] Cache cleared on demand");
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ cleared: true });
          }
        })
      );
      break;
  }
});

// ============================================================
// Push notifications
// ============================================================
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "JMComic3", body: event.data.text() };
  }

  const options = {
    body: payload.body || "",
    icon: "/logo192.png",
    badge: "/logo92.png",
    data: payload.url || "/",
    vibrate: [200, 100, 200],
    tag: payload.tag || "jmcomic3-notification",
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title || "JMComic3", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================================
// Helpers
// ============================================================

/** Stale-while-revalidate: serve cache, refresh in background */
function swrStrategy(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
}

/** Get from cache with a simple promise */
function fromCache(request) {
  return caches.open(CACHE_NAME).then((cache) => cache.match(request));
}
