import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import classRoutes from './routes/classes.js';
import assignmentRoutes from './routes/assignments.js';
import sessionRoutes from './routes/sessions.js';
import { setRoutes, shareRoutes } from './routes/sets.js';
import aiRoutes from './routes/ai.js';
import { setupSockets } from './socket.js';

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API routes
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/ai', aiRoutes);

// In production, serve the built React app from /dist
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist, { maxAge: '1y', immutable: true, index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Central error handler — never leak stack traces to clients
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setupSockets(io);

server.listen(PORT, () => console.log(`🚀 StudySync API running on http://localhost:${PORT}`));
