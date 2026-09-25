/**
 * Real-time study rooms: chat, shared whiteboard, quick polls.
 * Collaborative note editing: Yjs document sync + awareness relay.
 * State is held in memory (resets on restart) — simple and dependency-free.
 */
import * as Y from 'yjs';

const rooms = new Map(); // code -> { users: Map, messages: [], canvas: [], poll: null }
const yjsRooms = new Map(); // setId -> { doc: Y.Doc, clients: Set<socketId>, seeded: boolean }
const MAX_MESSAGES = 200;
const MAX_CANVAS_OBJECTS = 2000;

const clean = (s, n) => String(s ?? '').trim().slice(0, n);

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { users: new Map(), messages: [], canvas: [], poll: null });
  return rooms.get(code);
}

function pollView(poll) {
  if (!poll) return null;
  const counts = poll.options.map(() => 0);
  for (const idx of Object.values(poll.votes)) counts[idx]++;
  return { question: poll.question, options: poll.options, counts, total: Object.keys(poll.votes).length };
}

function cleanupYjs(setId) {
  const room = yjsRooms.get(setId);
  if (room && room.clients.size === 0) {
    room.doc.destroy();
    yjsRooms.delete(setId);
  }
}

export function setupSockets(io) {
  io.on('connection', (socket) => {
    let current = null; // room code this socket has joined

    /* ---------- Study rooms (existing) ---------- */

    socket.on('room:join', ({ code, name }) => {
      code = clean(code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
      name = clean(name, 30) || 'Anonymous';
      if (!code) return socket.emit('room:error', 'Invalid room code');

      current = code;
      const room = getRoom(code);
      room.users.set(socket.id, name);
      socket.join(code);

      socket.emit('room:state', {
        code,
        users: [...room.users.values()],
        messages: room.messages,
        canvas: room.canvas,
        poll: pollView(room.poll),
      });
      io.to(code).emit('room:users', [...room.users.values()]);
      socket.to(code).emit('chat:message', { system: true, text: `${name} joined`, at: Date.now() });
    });

    socket.on('chat:message', (text) => {
      if (!current) return;
      const room = getRoom(current);
      const msg = { name: room.users.get(socket.id) || 'Anonymous', text: clean(text, 500), at: Date.now() };
      if (!msg.text) return;
      room.messages.push(msg);
      if (room.messages.length > MAX_MESSAGES) room.messages.shift();
      io.to(current).emit('chat:message', msg);
    });

    socket.on('draw:path', (obj) => {
      if (!current || !obj || typeof obj !== 'object') return;
      const room = getRoom(current);
      room.canvas.push(obj);
      if (room.canvas.length > MAX_CANVAS_OBJECTS) room.canvas.shift();
      socket.to(current).emit('draw:path', obj);
    });

    socket.on('draw:clear', () => {
      if (!current) return;
      getRoom(current).canvas = [];
      io.to(current).emit('draw:clear');
    });

    socket.on('poll:create', ({ question, options }) => {
      if (!current) return;
      const opts = (Array.isArray(options) ? options : []).map((o) => clean(o, 80)).filter(Boolean).slice(0, 6);
      question = clean(question, 200);
      if (!question || opts.length < 2) return socket.emit('room:error', 'A poll needs a question and at least 2 options');
      const room = getRoom(current);
      room.poll = { question, options: opts, votes: {} };
      io.to(current).emit('poll:update', pollView(room.poll));
    });

    socket.on('poll:vote', (index) => {
      if (!current) return;
      const room = getRoom(current);
      if (!room.poll || !Number.isInteger(index) || index < 0 || index >= room.poll.options.length) return;
      room.poll.votes[socket.id] = index;
      io.to(current).emit('poll:update', pollView(room.poll));
    });

    socket.on('poll:close', () => {
      if (!current) return;
      getRoom(current).poll = null;
      io.to(current).emit('poll:update', null);
    });

    /* ---------- Collaborative note editing (Yjs relay) ---------- */

    socket.on('notes:yjs-join', ({ setId }) => {
      setId = clean(setId, 40);
      if (!setId) return;

      let room = yjsRooms.get(setId);
      if (!room) {
        room = { doc: new Y.Doc(), clients: new Set(), seeded: false };
        yjsRooms.set(setId, room);
      }
      room.clients.add(socket.id);
      socket.join(`yjs:${setId}`);

      const state = Y.encodeStateAsUpdate(room.doc);
      const shouldSeed = !room.seeded;
      if (shouldSeed) room.seeded = true;

      socket.emit('notes:yjs-state', {
        setId,
        state: Array.from(state),
        shouldSeed,
      });
    });

    socket.on('notes:yjs-seed-applied', ({ setId }) => {
      setId = clean(setId, 40);
      const room = yjsRooms.get(setId);
      if (room) room.seeded = true;
    });

    socket.on('notes:yjs-update', ({ setId, update }) => {
      setId = clean(setId, 40);
      if (!setId || !Array.isArray(update)) return;
      const room = yjsRooms.get(setId);
      if (!room) return;
      try {
        Y.applyUpdate(room.doc, new Uint8Array(update));
        socket.to(`yjs:${setId}`).emit('notes:yjs-update', { setId, update });
      } catch (e) {
        console.warn('[yjs] apply failed', e.message);
      }
    });

    socket.on('notes:yjs-awareness', ({ setId, update }) => {
      setId = clean(setId, 40);
      if (!setId || !Array.isArray(update)) return;
      socket.to(`yjs:${setId}`).emit('notes:yjs-awareness', { setId, update });
    });

    socket.on('notes:yjs-leave', ({ setId }) => {
      setId = clean(setId, 40);
      if (!setId) return;
      const room = yjsRooms.get(setId);
      if (!room) return;
      room.clients.delete(socket.id);
      socket.leave(`yjs:${setId}`);
      cleanupYjs(setId);
    });

    /* ---------- Disconnect ---------- */

    socket.on('disconnect', () => {
      if (current) {
        const room = rooms.get(current);
        if (room) {
          const name = room.users.get(socket.id);
          room.users.delete(socket.id);
          io.to(current).emit('room:users', [...room.users.values()]);
          if (name) socket.to(current).emit('chat:message', { system: true, text: `${name} left`, at: Date.now() });
          if (room.users.size === 0) rooms.delete(current);
        }
      }
      for (const [setId, room] of yjsRooms) {
        if (room.clients.has(socket.id)) {
          room.clients.delete(socket.id);
          cleanupYjs(setId);
        }
      }
    });
  });
}
