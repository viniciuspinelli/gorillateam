/**
 * Service Worker
 * Enables basic PWA capabilities
 */

const CACHE_NAME = 'gymdiet-v2';
const STATIC_ASSETS = [
    '/css/style.css',
    '/js/utils.js',
    '/manifest.json',
];

// Rotas autenticadas que nunca devem ser cacheadas
const NO_CACHE_PREFIXES = [
    '/workouts',
    '/diet',
    '/shopping',
    '/admin',
    '/auth',
];

// Install event - cache only static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Don't fail if assets are not available
            });
        })
    );
    self.skipWaiting();
});

// Fetch event - serve from cache only for safe static assets
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Never cache authenticated or auth routes — always fetch from network
    if (NO_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
        event.respondWith(fetch(event.request));
        return;
    }

    // For known static assets: cache-first strategy
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request);
            })
        );
    }
    // All other requests: network only (no caching)
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
