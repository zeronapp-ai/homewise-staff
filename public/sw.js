const CACHE_NAME = 'homewise-v2';
const IKON = 'https://ik.imagekit.io/uiuf7hq8x/homewisestaff.png?updatedAt=1786916778121';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

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
  self.clients.claim();
});

// Sunucudan gelen push: uygulama kapaliyken de bildirim gosterir
self.addEventListener('push', (event) => {
  let veri = {};
  try {
    veri = event.data ? event.data.json() : {};
  } catch (e) {
    veri = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(veri.title || 'Homewise', {
      body: veri.body || '',
      icon: veri.icon || IKON,
      badge: veri.icon || IKON,
      tag: veri.tag,
      requireInteraction: true,
      data: { url: veri.url || '/bildirimler' }
    })
  );
});

// Bildirime tiklayinca uygulamayi ac / one getir
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hedef = (event.notification.data && event.notification.data.url) || '/bildirimler';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((pencereler) => {
      for (const pencere of pencereler) {
        if ('focus' in pencere) {
          if ('navigate' in pencere) pencere.navigate(hedef);
          return pencere.focus();
        }
      }
      return clients.openWindow(hedef);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For API calls, use network-first strategy
  if (event.request.url.includes('/api') || event.request.url.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            return response || new Response('Offline', { status: 503 });
          });
        })
    );
  } else {
    // For assets, use cache-first strategy
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
  }
});
