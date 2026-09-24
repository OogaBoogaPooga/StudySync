import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const sessionSchema = z.object({
  type: z.enum(['focus', 'break']).default('focus'),
  durationMin: z.coerce.number().int().min(1).max(600),
  notes: z.string().max(5000).optional().nullable(),
});

router.get('/', wrap(async (req, res) => {
  const sessions = await prisma.studySession.findMany({
    where: { userId: req.user.id },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  res.json(sessions);
}));

/** Aggregated analytics: total focus minutes, streak-friendly 7-day breakdown */
router.get('/stats', wrap(async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const sessions = await prisma.studySession.findMany({
    where: { userId: req.user.id, type: 'focus' },
  });

  const byDay = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  let totalMin = 0;
  for (const s of sessions) {
    totalMin += s.durationMin;
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    if (key in byDay) byDay[key] += s.durationMin;
  }
  res.json({ totalMin, sessionCount: sessions.length, byDay });
}));

router.post('/', validate(sessionSchema), wrap(async (req, res) => {
  const session = await prisma.studySession.create({ data: { ...req.body, userId: req.user.id } });
  res.status(201).json(session);
}));

export default router;
