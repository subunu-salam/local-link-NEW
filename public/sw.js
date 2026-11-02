/* Local Link service worker — offline app shell + fast repeat loads.
   Strategy:
   - API calls (/api/…): network-only (data must stay fresh; no stale caching).
   - Navigations: network-first, fall back to the cached app shell when offline.
   - Same-origin static assets: stale-while-revalidate (instant load, updates in bg).
   - Cross-origin (fonts, photos): left to the browser. */
const VERSION = 'll-pop-v2';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';
const SHELL_ASSETS = ['/', '/index.html', '/app.js', '/styles.css', '/fx.css', '/studio.css', '/logo.svg', '/fx.js', '/favicon.svg',
  '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache the API — always go to network
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: 'offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // navigations: network-first, offline → cached shell
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  // same-origin static: network-first so every deploy shows up immediately; cache = offline fallback
  if (url.origin === location.origin) {
    e.respondWith(caches.open(RUNTIME).then((cache) =>
      fetch(req).then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); return res; })
        .catch(() => cache.match(req).then((c) => c || caches.match(req)))
    ));
  }
});
