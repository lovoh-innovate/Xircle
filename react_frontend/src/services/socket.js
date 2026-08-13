// src/services/socket.js
import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

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

let socket = null;

export const connectSocket = (token) => {
  console.log('⚡ connectSocket() called, token provided:', !!token);

  if (socket?.connected) {
    console.log('♻️  Socket already connected, reusing');
    return socket;
  }

  // Clean up any stale/disconnected instance before creating a new one
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected! ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected. Reason:', reason);
    // If Render's server dropped an idle connection, reconnect immediately
    // instead of waiting on the default backoff timer.
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });

  socket.on('reconnect', (attempt) => {
    console.log('🔄 Reconnected after', attempt, 'attempt(s)');
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log('🔁 Reconnect attempt #', attempt);
  });

  socket.on('reconnect_error', (err) => {
    console.error('❌ Reconnect error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('👋 Disconnecting socket...');
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;