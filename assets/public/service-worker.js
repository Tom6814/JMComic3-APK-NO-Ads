/* eslint-disable no-restricted-globals */
const CACHE_NAME = "offline-cache-v2.1.9";
const OFFLINE_URL = "/offline.html?v=2.1.9";
const FALLBACK_IMAGE = "/images/cover_default.jpg?v=2.1.9";

const PRECACHE_URLS = [OFFLINE_URL, FALLBACK_IMAGE];

// Cap concurrent outbound fetches to avoid unbounded request volume
// (CWE-770: Allocation of Resources Without Limits or Throttling).
const MAX_CONCURRENT_FETCHES = 20;
let activeFetches = 0;

function limitedFetch(request) {
  if (activeFetches >= MAX_CONCURRENT_FETCHES) {
    return Promise.reject(new Error("Too many concurrent requests"));
  }
  activeFetches++;
  return fetch(request).finally(() => {
    activeFetches--;
  });
}

// =========================
// install
// =========================
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

// =========================
// activate
// =========================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// =========================
// fetch strategy
// =========================
self.addEventListener("fetch", (event) => {
  const { request } = event;

  //過濾非 http(s)
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  // -------------------------
  // HTML navigation
  // -------------------------
  if (request.mode === "navigate") {
    event.respondWith(limitedFetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // -------------------------
  // IMAGE: cache-first
  // -------------------------
  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return limitedFetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => caches.match(FALLBACK_IMAGE));
      })
    );
    return;
  }

  // -------------------------
  // default: network first
  // -------------------------
  event.respondWith(
    limitedFetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
  );
});
