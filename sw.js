// ── Bloom Service Worker ─────────────────────────────────────────────────────
// Strategy:
//   app files (html/js/css)  → network-first  (always fresh when online)
//   static assets (fonts/icons) → cache-first (never change, fast)
//   offline fallback            → serve cached version if network fails
//
// To force an update on all devices: bump CACHE_VERSION below, push to GitHub.
// Phones will pick up the new SW within ~24h, or immediately on next open.

const CACHE_VERSION = 'bloom-v6';
const APP_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
];
const STATIC_FILES = [
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap',
];

// ── Install: pre-cache everything ────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll([...APP_FILES, ...STATIC_FILES])
    )
  );
  // Take over immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ── Activate: wipe every old cache version ───────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())  // claim all open tabs immediately
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin requests we don't control
  if (e.request.method !== 'GET') return;

  // Fonts & icons → cache-first (they never change)
  const isStatic =
    url.pathname.endsWith('.png') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
          return res;
        })
      )
    );
    return;
  }

  // App files (html/js/css) → network-first so updates always show up
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Got a fresh response — update the cache silently
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(e.request).then(cached =>
          cached || caches.match('/index.html')
        );
      })
  );
});

// ── Tell the page when a new version has been installed ───────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
