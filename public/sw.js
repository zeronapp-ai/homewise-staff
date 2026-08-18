const CACHE_NAME = 'handyy-cache-v5';

// DIKKAT: Basarisiz yanitlar ASLA onbellege alinmamali. Deploy penceresinde bir
// varlik anlik 404 donebiliyor; cache-first strateji bu 404'u kalici hale
// getiriyor, boylece uygulama o cihazda bir daha hic acilmiyordu (JS paketleri
// 404 -> React hic yuklenmiyor -> form native submit yapiyor).
function onbellegeAlinabilir(response) {
  return !!response && response.status === 200 && response.type !== 'opaque';
}

function ayniKaynak(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

// DIKKAT: Sorun yalnizca bu service worker'in onbelleginde degil, TARAYICININ
// KENDI HTTP onbelleginde de olusabiliyor. Deploy aninda donen 404, /assets/*
// icin gonderilen "immutable" basligiyla birlikte diske yazilinca ayni URL
// aylarca 404 donmeye devam ediyor ve uygulama o cihazda hic acilmiyor.
// Ayni istegi bir kez cache:'reload' ile tekrarlamak hem dogru yaniti getiriyor
// hem de zehirlenmis kaydin uzerine yaziyor; boylece cihaz kendi kendine
// toparliyor.
function zehirliOnbellegiTazele(request) {
  return fetch(request.url, { cache: 'reload', credentials: 'same-origin' });
}

function agdanGetir(request) {
  return fetch(request).then((response) => {
    if (onbellegeAlinabilir(response) || !ayniKaynak(request)) {
      return response;
    }
    return zehirliOnbellegiTazele(request).catch(() => response);
  });
}
const IKON = 'https://ik.imagekit.io/uiuf7hq8x/homewisestaff.png?updatedAt=1786916778121';

// DIKKAT: Burada olmayan bir adres birakma. cache.addAll tek bir istek bile
// basarisiz olursa TUMUYLE reddeder; bu da install olayini cokertir, worker
// "redundant" olur ve kayit silinir. Bu uygulama SSR oldugu icin /index.html
// yok, listede oldugu surece hicbir cihazda service worker aktif olamiyordu.
const urlsToCache = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Tek tek ekle ve hatayi yut: eksik bir dosya kurulumu asla cokertmesin
      Promise.all(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] onbellege alinamadi, atlaniyor:', url, err);
          })
        )
      )
    )
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
          if (onbellegeAlinabilir(response)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            return response || new Response('Offline', { status: 503 });
          });
        })
    );
  } else if (event.request.mode === 'navigate') {
    // Sayfa istekleri network-first olmali. Cache-first yapilirsa cihaz eski
    // HTML kabugunu sonsuza kadar servis eder, o da eski hash'li paketleri
    // cagirir ve kullanici yeni surumu hic goremez.
    event.respondWith(
      agdanGetir(event.request)
        .then((response) => {
          if (onbellegeAlinabilir(response)) {
            const kopya = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopya));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((response) => response || caches.match('/'))
            .then((response) => response || new Response('Offline', { status: 503 }))
        )
    );
  } else {
    // Hash'li statik dosyalar degismez, cache-first uygun
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Onbellekte hatali bir yanit kalmissa ona guvenme, agdan tazele.
        if (response && response.status === 200) {
          return response;
        }
        return agdanGetir(event.request).then((response) => {
          if (onbellegeAlinabilir(response)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
