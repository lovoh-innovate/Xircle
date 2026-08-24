// src/services/socket.js
import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

/**
 * Determine the correct Socket.IO server URL (hardcoded).
 */
const getSocketUrl = () => {
  const isNative = Capacitor.isNativePlatform();

  // 1. Capacitor (mobile app) – always production
  if (isNative) {
    console.log('📱 Capacitor detected – using production URL');
    return 'https://xircle.onrender.com';
  }

  // 2. Web – check if we're on localhost
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    console.log('🌐 Localhost detected – using http://localhost:8000');
    return 'http://localhost:8000';
  }

  // 3. Web – production (or staging)
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

  socket = io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected! ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message);
    console.error('Full error object:', err);
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected. Reason:', reason);
  });

  socket.on('reconnect', (attempt) => {
    console.log('🔄 Reconnected after', attempt, 'attempt(s)');
  });

  socket.on('reconnect_error', (err) => {
    console.error('❌ Reconnect error:', err.message);
  });

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