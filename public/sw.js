// Frontline Coach service worker.
// Network-first: always try the live version so a new deploy shows up immediately,
// and only fall back to cache when the phone is offline. This gives the app
// installability (a fetch handler) without the classic "PWA won't update" trap.
const CACHE = "fc-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Stash a fresh copy for offline use.
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
