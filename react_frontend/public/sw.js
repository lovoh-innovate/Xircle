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

// ─── Push event – show notification with call actions ──────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (error) {
    data = { title: 'New Notification', body: event.data.text() };
  }

  const title = data.title || 'Notification';
  let options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    data: data.data || {},
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };

  // If it's a call notification, add call-specific behaviour
  if (data.notificationType === 'call') {
    options.vibrate = [1000, 500, 1000, 500, 1000]; // ring pattern
    options.actions = [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' }
    ];
    options.requireInteraction = true;
    options.tag = 'call'; // group calls together
    options.silent = false; // ensure sound plays
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click – handle actions and navigation ────────────────
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  const openUrl = (url) => {
    const absoluteUrl = new URL(url, self.location.origin).href;
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.navigate(absoluteUrl).then(() => client.focus());
          }
        }
        return clients.openWindow(absoluteUrl);
      })
    );
  };

  // Handle call actions
  if (data.notificationType === 'call') {
    if (action === 'answer') {
      openUrl(`/call/${data.roomId}?autoJoin=true`);
    } else if (action === 'decline') {
      // Optionally hit API to reject, then go home
      openUrl('/my-workspaces');
    } else {
      // Default tap (no action) – open call screen with auto-join
      openUrl(`/call/${data.roomId}?autoJoin=true`);
    }
    return;
  }

  // Handle message quick reply action
  if (action === 'reply' && data.chatId && data.workspaceId) {
    openUrl(`/workspace/${data.workspaceId}/chat/${data.chatId}?focusInput=true`);
    return;
  }

  // Default: navigate to the provided URL or home
  const url = data.url || '/my-workspaces';
  openUrl(url);
});