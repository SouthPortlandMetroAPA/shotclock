/* ════════════════════════════════════════════════════════════════════════
   ShotClock — service worker.

   Strategy:
     • install: pre-cache the app shell (index.html, version.js, manifest,
       icon) and skipWaiting() so a newly-deployed SW activates IMMEDIATELY
       on next page load instead of sitting in "waiting" indefinitely.
     • activate: claim() all open clients so they're controlled by the new
       SW without requiring a navigation. Purge old caches.
     • fetch:
         - HTML / navigation requests → network-first (so the user always
           sees the latest shell while online, and the browser's standard
           SW update check sees fresh sw.js bytes).
         - Everything else → cache-first with background revalidation
           (so static assets load instantly, even on flaky pool-hall WiFi).

   The accompanying page logic (in index.html) listens for the
   `controllerchange` event and triggers a silent location.reload() —
   BUT defers the reload while a shot is mid-flight (currentShot !== null).
   This combination = "silent auto-update, never during a running shot."

   VERSION bumped on every deploy so the byte-content of sw.js changes,
   which forces the browser to detect the new SW (per spec, the browser
   compares the new SW against the cached one byte-for-byte). Without
   this, identical sw.js bytes = no perceived update.
   ════════════════════════════════════════════════════════════════════════ */
const VERSION = '0.6';
const CACHE_NAME = 'shotclock-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './version.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())  // activate without waiting
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim()  // take control of open tabs immediately
    ])
  );
});

self.addEventListener('fetch', e => {
  /* Only handle same-origin GET. CORS preflight / cross-origin (e.g.,
     CDN) pass through to the network. */
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  /* HTML / navigation → network-first */
  if (e.request.mode === 'navigate' ||
      e.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
    return;
  }

  /* Other assets → cache-first with background revalidate */
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);  /* offline + uncached → undefined; browser shows network error */
      return cached || fetchPromise;
    })
  );
});
