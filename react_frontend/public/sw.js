// public/sw.js

// ─── Versioning ──────────────────────────────────────────────────────────
const CACHE_VERSION = 'v1';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/badge.png',
];

// ─── Install event – cache static assets ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── Activate event – clean up old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch event – serve from cache, fallback to network ──────────────
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// ─── Push event – show notification ────────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('📩 Push event received');
  let data = {};
  try {
    data = event.data.json();
    console.log('📩 Push payload:', data);
  } catch (error) {
    data = { title: 'New Notification', body: event.data.text() };
    console.warn('Push payload not JSON, using plain text:', data);
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    data: data.data || {}, // this is the notificationData from the server
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };

  console.log('🔔 Showing notification with options:', options);
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click event – navigate to the specific chat ────────
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification);
  const notificationData = event.notification.data || {};
  console.log('🔔 Notification data:', notificationData);

  const urlToOpen = notificationData.url || '/';
  console.log('🔗 URL to open:', urlToOpen);

  // Ensure the URL is absolute
  const absoluteUrl = new URL(urlToOpen, self.location.origin).href;
  console.log('🔗 Absolute URL:', absoluteUrl);

  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // Try to find an existing client and navigate it to the new URL
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          console.log('🔄 Navigating existing client to:', absoluteUrl);
          return client.navigate(absoluteUrl).then(() => client.focus());
        }
      }
      // Otherwise open a new window
      console.log('🆕 Opening new window for:', absoluteUrl);
      return clients.openWindow(absoluteUrl);
    })
  );
});