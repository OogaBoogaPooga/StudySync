import { io } from 'socket.io-client';
import { getToken } from './api.js';

let socket = null;

export function getSocket() {
  // Reuse existing socket — even if it's still connecting. Never tear down mid-handshake.
  if (socket) return socket;
  const token = getToken();
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function closeSocket() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
}
