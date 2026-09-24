/**
 * Real-time study rooms: chat, shared whiteboard, quick polls.
 * State is held in memory (resets on restart) — simple and dependency-free.
 */
const rooms = new Map(); // code -> { users: Map<socketId, name>, messages: [], canvas: [], poll: null }
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

export function setupSockets(io) {
  io.on('connection', (socket) => {
    let current = null; // room code this socket has joined

    socket.on('room:join', ({ code, name }) => {
      code = clean(code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
      name = clean(name, 30) || 'Anonymous';
      if (!code) return socket.emit('room:error', 'Invalid room code');

      current = code;
      const room = getRoom(code);
      room.users.set(socket.id, name);
      socket.join(code);

      // Send full state to the newcomer, then notify others
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

    // Whiteboard: each finished stroke is serialized Fabric.js JSON
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
      room.poll.votes[socket.id] = index; // one vote per person, re-voting allowed
      io.to(current).emit('poll:update', pollView(room.poll));
    });

    socket.on('poll:close', () => {
      if (!current) return;
      getRoom(current).poll = null;
      io.to(current).emit('poll:update', null);
    });

    socket.on('disconnect', () => {
      if (!current) return;
      const room = rooms.get(current);
      if (!room) return;
      const name = room.users.get(socket.id);
      room.users.delete(socket.id);
      io.to(current).emit('room:users', [...room.users.values()]);
      if (name) socket.to(current).emit('chat:message', { system: true, text: `${name} left`, at: Date.now() });
      if (room.users.size === 0) rooms.delete(current); // free memory for empty rooms
    });
  });
}
