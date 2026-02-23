// ============================================================
// PWA Service Worker
// Provides offline support, push notifications, and background sync
// ============================================================

/// <reference lib="webworker" />

const CACHE_NAME = 'agentin-v6.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force activation
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control immediately
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: FetchEvent) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((fetchResponse) => {
        // Cache successful responses
        if (fetchResponse && fetchResponse.status === 200) {
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchResponse;
      })
      .catch(() => {
        // Network failed — fall back to cache
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push notification event
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Agentin';
  const options: NotificationOptions = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
  };

  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(
      title,
      options
    )
  );
});

// Notification click event
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: 'window' })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(url);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-reminders') {
    event.waitUntil(syncReminders());
  } else if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncReminders() {
  // Get pending reminders from IndexedDB and sync
  // Implementation depends on your IndexedDB setup
  console.log('Syncing reminders...');
}

async function syncMessages() {
  // Get pending messages from IndexedDB and sync
  console.log('Syncing messages...');
}

export {};
