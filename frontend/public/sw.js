/*
 * PDA service worker: one job, an offline page. It never stores account data.
 *
 * - Page navigations and the offline page's own files (offline.js, the icon) are handled; API calls, Next.js assets, images and
 *   everything else go straight to the network and are never cached by this worker (signed-in content must not outlive the session in a cache).
 * - A navigation that fails because the network is down is answered with the pre-cached /offline.html.
 * - Updates: the browser re-fetches this file on every start and at least daily (next.config.ts serves it with
 *   `no-cache`). Bump CACHE_VERSION whenever offline.html or the list below changes: the new worker installs, takes
 *   over at once (skipWaiting + clients.claim) and deletes every older `pda-` cache in `activate`.
 */
const CACHE_VERSION = "v3";
const CACHE_NAME = `pda-offline-${CACHE_VERSION}`;
const PRECACHE = ["/offline.html", "/offline.js", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("pda-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // The offline page's own files (script, icon) come from the cache first: offline.html needs them while the network is down.
  if (request.mode !== "navigate") {
    const url = new URL(request.url);
    if (url.origin === self.location.origin && PRECACHE.includes(url.pathname)) {
      event.respondWith(caches.match(url.pathname, { cacheName: CACHE_NAME }).then((cached) => cached ?? fetch(request)));
    }
    return;
  }
  event.respondWith(
    fetch(request).catch(async () => (await caches.match("/offline.html", { cacheName: CACHE_NAME })) ?? Response.error()),
  );
});
