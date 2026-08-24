// public/sw.js

// ─── Firebase Messaging (background push) ───────────────────────────────
// Loaded as compat scripts because service workers can't use ES module
// imports or Vite env vars — this is the one place these values are
// hardcoded rather than pulled from .env. They're public client
// identifiers (same ones used in usePushNotifications.js), so that's fine.
// ⚠️ Match the SDK version below to whatever `firebase` version is in
// your package.json (major version at least).
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCP3S5DnU5KKg-y8AdP9ZVkxqxJIy7ZLQM',
  authDomain: 'xircle-f60ef.firebaseapp.com',
  projectId: 'xircle-f60ef',
  storageBucket: 'xircle-f60ef.firebasestorage.app',
  messagingSenderId: '596946698879',
  appId: '1:596946698879:web:24bd19169f77ed0125b54a',
});

const messaging = firebase.messaging();

// ─── Versioning ──────────────────────────────────────────────────────────
// You no longer need to bump this by hand for normal deploys — the
// network-first HTML strategy below means index.html is never stuck stale.
// Bump this ONLY if you change this file's own caching logic in a way that
// needs old caches wiped immediately.
const CACHE_VERSION = 'v30';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// Only precache things that rarely/never change. Do NOT put '/' or
// '/index.html' here — those must always be fetched fresh (see fetch handler).
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.png',
  '/badge.png',
];

// ─── Install event ─────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Take over immediately instead of waiting for old SW to finish —
  // this is what makes updates apply "on their own" without a manual reload dance.
  self.skipWaiting();
});

// ─── Activate event – clean up old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch event ───────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return; // never intercept POST/PUT/etc.

  const url = new URL(req.url);

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  // API requests: NEVER cache these, always go straight to network.
  const isApiRequest = url.pathname.startsWith('/api/');
  if (isApiRequest) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML / navigation requests: ALWAYS go to network first.
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Hashed static assets (JS/CSS/images from /assets, fonts, etc.) are
  // content-hashed by Vite — safe to serve cache-first since a changed
  // file always has a new URL.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkResponse) => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return networkResponse;
      });
    })
  );
});

// ─── Push event – now handled by Firebase Messaging ─────────────────────
// IMPORTANT: There is no `self.addEventListener('push', ...)` anymore.
// firebase-messaging-compat.js registers its OWN internal 'push' listener
// when you call firebase.messaging() above — adding a second one here
// would cause duplicate/garbled notifications. All notification-building
// logic that used to live in the 'push' listener now lives in
// onBackgroundMessage below, working from `payload.data` (all string
// values, matching the data-only messages the backend now sends for web).
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'Notification';

  let options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [],
  };

  if (data.notificationType === 'call') {
    options.vibrate = [1000, 500, 1000, 500, 1000];
    options.actions = [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' },
    ];
    options.requireInteraction = true;
    options.tag = 'call';
    options.silent = false;
  } else if (data.notificationType === 'chat' || data.notificationType === 'channel') {
    options.actions = [{ action: 'reply', title: 'Reply' }];
  }

  self.registration.showNotification(title, options);
});

// ─── Notification click – handle actions and navigation ────────────────
// Unchanged — this is generic Notification API behaviour, unrelated to
// whether the notification came from raw web-push or FCM.
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

  if (data.notificationType === 'call') {
    if (action === 'answer') {
      openUrl(`/call/${data.roomId}?autoJoin=true`);
    } else if (action === 'decline') {
      openUrl('/my-workspaces');
    } else {
      openUrl(`/call/${data.roomId}?autoJoin=true`);
    }
    return;
  }

  if (action === 'reply' && data.chatId && data.workspaceId) {
    openUrl(`/workspace/${data.workspaceId}/chat/${data.chatId}?focusInput=true`);
    return;
  }

  const url = data.url || '/my-workspaces';
  openUrl(url);
});