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
  // Add any other static files you want to cache (e.g., CSS, JS bundles)
  // '/static/css/main.css',
  // '/static/js/main.js',
];

// ─── Install event – cache static assets ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force the waiting service worker to become active
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
  // Take control of all clients immediately
  self.clients.claim();
});

// ─── Fetch event – serve from cache, fallback to network ──────────────
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available, else fetch from network
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          // Optional: return a fallback offline page
        })
      );
    })
  );
});

// ─── Push event – show notification ────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (error) {
    // If the payload is not JSON, treat it as plain text
    data = { title: 'New Notification', body: event.data.text() };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    data: data.data || {}, // forwarded to notificationclick
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click event ──────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';

  // Handle actions if present
  if (event.action) {
    // If the notification has custom actions, you can handle them here
    // e.g., event.action === 'reply' -> open chat
  }

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If a window is already open, focus it; otherwise open a new one
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});