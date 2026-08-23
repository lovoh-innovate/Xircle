// src/services/socket.js
import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

/**
 * Determine the correct Socket.IO server URL (hardcoded).
 */
const getSocketUrl = () => {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    console.log('📱 Capacitor detected – using production URL');
    return 'https://xircle.onrender.com';
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    console.log('🌐 Localhost detected – using http://localhost:8000');
    return 'http://localhost:8000';
  }

  console.log('🌐 Production web – using https://xircle.onrender.com');
  return 'https://xircle.onrender.com';
};

const SOCKET_URL = getSocketUrl();
console.log('🔌 Socket.IO will connect to:', SOCKET_URL);

// redux-persist storage key from src/store.js (persistConfig.key)
const PERSIST_KEY = 'persist:root-v25';

let socket = null;
let latestToken = null;
let listenersAttached = false;

// ── Always pull the freshest token off disk, not the one captured
//    at the original connectSocket() call. This is what makes
//    reconnection work after the JWT has been refreshed elsewhere
//    in the app, instead of silently failing auth forever. ──────────
const getFreshToken = () => {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return latestToken;
    const rootParsed = JSON.parse(raw);
    if (!rootParsed?.auth) return latestToken;
    const authParsed = JSON.parse(rootParsed.auth);
    return authParsed?.userInfo?.token || latestToken;
  } catch (err) {
    console.warn('Could not read persisted token, falling back:', err.message);
    return latestToken;
  }
};

const attachLifecycleListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  // ── Native: force a reconnect when the app comes back to foreground.
  //    Android/iOS can suspend the underlying socket while backgrounded,
  //    and socket.io-client doesn't always notice on its own. ─────────
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && socket && !socket.connected) {
        console.log('📱 App resumed – forcing socket reconnect');
        socket.connect();
      }
    });
  }

  // ── Web: same idea for background tabs / sleeping devices ──────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket && !socket.connected) {
      console.log('👁️ Tab visible again – forcing socket reconnect');
      socket.connect();
    }
  });

  window.addEventListener('online', () => {
    if (socket && !socket.connected) {
      console.log('🌐 Network back online – forcing socket reconnect');
      socket.connect();
    }
  });
};

export const connectSocket = (token) => {
  console.log('⚡ connectSocket() called, token provided:', !!token);
  latestToken = token || latestToken;

  if (socket?.connected) {
    console.log('♻️  Socket already connected, reusing');
    return socket;
  }

  if (socket) {
    // Existing (disconnected) instance — just reconnect it rather than
    // creating a second socket.
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    // Function form: re-evaluated on EVERY connection/reconnection
    // attempt, so an expired token doesn't kill reconnects forever.
    auth: (cb) => cb({ token: getFreshToken() }),
    withCredentials: false, // token-based auth, no cookies needed
    transports: ['websocket', 'polling'], // allow fallback instead of hard-failing
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected! ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected. Reason:', reason);
    // Server- or transport-initiated disconnects don't auto-reconnect
    // in socket.io-client v4 — kick it back off manually.
    if (reason === 'io server disconnect' || reason === 'transport close') {
      socket.connect();
    }
  });

  socket.on('reconnect', (attempt) => {
    console.log('🔄 Reconnected after', attempt, 'attempt(s)');
  });

  socket.on('reconnect_error', (err) => {
    console.error('❌ Reconnect error:', err.message);
  });

  attachLifecycleListeners();

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('👋 Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;