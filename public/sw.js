/**
 * PAMONG AI — Service Worker
 *
 * Caching Strategy:
 * - App Shell (JS, CSS, fonts, icons) → Cache-First
 * - Navigation requests → Network-First with offline fallback
 * - /api/chat, /api/dashboard/[id]/stream -> Network-Only (must be fresh)
 * - /api/sesi/... -> Network-First (fallback to cache)
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `pamong-ai-shell-${CACHE_VERSION}`;
const DATA_CACHE = `pamong-ai-data-${CACHE_VERSION}`;

// App shell assets to pre-cache on install
const SHELL_ASSETS = [
  '/',
  '/guru/login',
  '/siswa/login',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── Install: Pre-cache shell ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Shell pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: Clean old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: Route-based caching strategy ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // 1. Network-Only: Chat API and SSE streams (MUST be fresh)
  if (url.pathname.startsWith('/api/chat') || url.pathname.includes('/stream')) {
    return; // Let browser handle normally
  }

  // 2. Network-Only: Auth endpoints
  if (url.pathname.startsWith('/api/auth')) {
    return;
  }

  // 3. Network-Only: File upload
  if (url.pathname.includes('/materi')) {
    return;
  }

  // 4. Network-First: Other API routes (session data, history)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // 5. Cache-First: Static assets (JS chunks, CSS, images, fonts)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 6. Network-First with offline fallback: HTML navigation
  event.respondWith(navigationHandler(request));
});

// ─── Strategy Implementations ────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Resource not available offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    // Cache successful navigation responses
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: try cache first, then offline.html
    const cached = await caches.match(request);
    if (cached) return cached;

    const offlinePage = await caches.match('/offline.html');
    return offlinePage ?? new Response('<h1>Offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// ─── Push notifications (future feature, stub only) ─────────────────────────
self.addEventListener('push', () => {
  // Reserved for future push notifications
});
