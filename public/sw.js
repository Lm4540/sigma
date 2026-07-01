/* SIGMA — Service Worker v1 */
'use strict';

const CACHE_NAME = 'sigma-v2-cache-v1';
const STATIC_ASSETS = ['/css/main.css', '/js/ui.js', '/js/gps.js', '/js/sync.js', '/offline.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Solo manejar GET sobre mismo origen
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cachear assets estáticos
        if (e.request.url.includes('/css/') || e.request.url.includes('/js/')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Background Sync — sincronizar gestiones offline
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-collections') {
    e.waitUntil(syncPendingCollections());
  }
});

async function syncPendingCollections() {
  // La lógica real vive en sync.js del cliente
  // El SW notifica al cliente para que procese la cola
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'sync-trigger' }));
}

// Push notifications
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'SIGMA', body: 'Nueva notificación' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: data.data || {},
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const clientId = e.notification.data?.clientId;
  const url = clientId ? `/clients/${clientId}` : '/dashboard';
  e.waitUntil(clients.openWindow(url));
});
