// Singleton Socket.IO client.
// Import { getSocket } anywhere; call connect(token) once after login.

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:1337';

let socket = null;

/**
 * Connect to the Socket.IO server with a JWT.
 * Safe to call multiple times — returns existing socket if already connected.
 */
export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  return socket;
}

/**
 * Get the current socket instance (or null if not connected).
 */
export function getSocket() {
  return socket;
}

/**
 * Disconnect and destroy the socket (call on logout).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
