import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { getSocket } from './socket.js';

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function colorForUser(user) {
  const id = String(user?.id || user?.name || 'anon');
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function createCollabProvider(setId, user) {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const socket = getSocket();
  let destroyed = false;
  let gotState = false;
  // Start as "not allowed to seed". Only flip to false when server grants seed permission.
  let seedAllowed = false;
  const readyCallbacks = [];

  const fireReady = () => {
    for (const cb of readyCallbacks) {
      try { cb(); } catch (e) { console.warn('[yjs] ready cb failed', e); }
    }
  };

  awareness.setLocalStateField('user', {
    name: user?.name || 'Someone',
    color: colorForUser(user),
  });

  const onState = ({ setId: s, state, shouldSeed }) => {
    if (s !== setId || destroyed) return;
    try {
      Y.applyUpdate(doc, new Uint8Array(state), 'remote');
    } catch (e) {
      console.warn('[yjs] state apply failed', e);
    }
    gotState = true;
    seedAllowed = !!shouldSeed;
    fireReady();
  };

  const onUpdate = ({ setId: s, update }) => {
    if (s !== setId || destroyed) return;
    try {
      Y.applyUpdate(doc, new Uint8Array(update), 'remote');
    } catch (e) {
      console.warn('[yjs] update apply failed', e);
    }
  };

  const onAwareness = ({ setId: s, update }) => {
    if (s !== setId || destroyed) return;
    try {
      applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
    } catch (e) {
      console.warn('[yjs] awareness apply failed', e);
    }
  };

  const onDocUpdate = (update, origin) => {
    if (destroyed || origin === 'remote') return;
    socket.emit('notes:yjs-update', { setId, update: Array.from(update) });
  };

  const onAwarenessUpdate = ({ added, updated, removed }) => {
    if (destroyed) return;
    const ids = [...added, ...updated, ...removed];
    if (!ids.length) return;
    const update = encodeAwarenessUpdate(awareness, ids);
    socket.emit('notes:yjs-awareness', { setId, update: Array.from(update) });
  };

  const onConnect = () => {
    if (destroyed) return;
    socket.emit('notes:yjs-join', { setId });
  };

  socket.on('notes:yjs-state', onState);
  socket.on('notes:yjs-update', onUpdate);
  socket.on('notes:yjs-awareness', onAwareness);
  socket.on('connect', onConnect);
  doc.on('update', onDocUpdate);
  awareness.on('update', onAwarenessUpdate);

  if (socket.connected) onConnect();

  return {
    doc,
    awareness,
    provider: { awareness, doc },
    onReady: (cb) => {
      if (gotState) {
        try { cb(); } catch (e) { console.warn('[yjs] ready cb failed', e); }
      } else {
        readyCallbacks.push(cb);
      }
    },
    isSeeder: () => gotState && seedAllowed,
    markSeeded: () => {
      seedAllowed = false;
      socket.emit('notes:yjs-seed-applied', { setId });
    },
    destroy: () => {
      destroyed = true;
      socket.off('notes:yjs-state', onState);
      socket.off('notes:yjs-update', onUpdate);
      socket.off('notes:yjs-awareness', onAwareness);
      socket.off('connect', onConnect);
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      socket.emit('notes:yjs-leave', { setId });
      awareness.destroy();
      doc.destroy();
    },
  };
}
