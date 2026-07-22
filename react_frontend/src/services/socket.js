// src/services/socket.js
import { io } from 'socket.io-client';

// ── Determine the correct Socket.IO URL ─────────────────────────────
// It MUST be the root of your server (no /api). Derive it from
// VITE_API_URL, or use a dedicated VITE_SOCKET_URL variable.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||                             // preferred
  new URL(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').origin;

console.log('🔌 Socket.IO will connect to:', SOCKET_URL);

let socket = null;

export const connectSocket = (token) => {
  console.log('⚡ connectSocket() called, token provided:', !!token);

  // Reuse existing socket if already connected
  if (socket?.connected) {
    console.log('♻️  Socket already connected, reusing');
    return socket;
  }

  // ── Create a fresh connection ──────────────────────────────────────
  socket = io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket'],      // try pure WebSocket first
  });

  // ── Debug listeners ────────────────────────────────────────────────
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

// ── Optional manual test (paste in browser console) ────────────────
// const test = io('http://localhost:8000', { transports: ['websocket'] });
// test.on('connect', () => console.log('Manual test connected'));
// test.on('connect_error', e => console.log('Manual test error:', e.message));