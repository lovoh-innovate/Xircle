// public/sw.js

// ─── Versioning ──────────────────────────────────────────────────────────
// You no longer need to bump this by hand for normal deploys — the
// network-first HTML strategy below means index.html is never stuck stale.
// Bump this ONLY if you change this file's own caching logic in a way that
// needs old caches wiped immediately.
const CACHE_VERSION = 'v5';
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
  // This is the fix for the "delete/upload doesn't reflect until I clear
  // browser data" bug — API GET responses (e.g. /api/app/version) were
  // previously falling into the cache-first static-asset branch below and
  // being served from cache forever, regardless of server-side changes.
  const isApiRequest = url.pathname.startsWith('/api/');
  if (isApiRequest) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML / navigation requests: ALWAYS go to network first.
  // This is the fix for the stale-index.html-with-dead-asset-hashes problem —
  // the shell HTML is never served from cache unless the network is unreachable.
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          // keep a fallback copy for offline use, but never rely on it
          // unless the network genuinely fails
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

  if (data.notificationType === 'call') {
    options.vibrate = [1000, 500, 1000, 500, 1000];
    options.actions = [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' }
    ];
    options.requireInteraction = true;
    options.tag = 'call';
    options.silent = false;
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