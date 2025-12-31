
const CACHE_NAME = 'traffic-os-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install Event: Cache Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Matrix Warmup: Caching Tactical Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Cleanup old matrices
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Matrix Purge: Removing deprecated data clusters');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event: Tactical Intercept
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy for Live API / Data feeds: Network First, fallback to cache
  if (url.origin.includes('trafficnz.info') || url.origin.includes('router.project-osrm.org')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Strategy for Static Assets: Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        // Only cache valid successful responses for our own origin or known CDNs
        if (networkResponse.ok) {
           const clonedNetworkResponse = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => {
             cache.put(request, clonedNetworkResponse);
           });
        }
        return networkResponse;
      });
    })
  );
});
