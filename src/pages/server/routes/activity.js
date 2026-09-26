import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

router.get('/streak', wrap(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const since = new Date(Date.now() - days * DAY_MS);

  const sessions = await prisma.studySession.findMany({
    where: { userId: req.user.id, startedAt: { gte: since } },
    select: { startedAt: true, durationMin: true, type: true },
  });

  const cards = await prisma.flashcard.findMany({
    where: {
      set: { userId: req.user.id },
      lastReviewedAt: { gte: since },
    },
    select: { lastReviewedAt: true },
  });

  const assignments = await prisma.assignment.findMany({
    where: { userId: req.user.id, completed: true, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const byDate = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * DAY_MS);
    byDate.set(isoDate(d), { date: isoDate(d), focusMin: 0, cards: 0, assignments: 0 });
  }

  for (const s of sessions) {
    if (s.type !== 'focus') continue;
    const day = byDate.get(isoDate(s.startedAt));
    if (day) day.focusMin += s.durationMin;
  }
  for (const c of cards) {
    const day = byDate.get(isoDate(c.lastReviewedAt));
    if (day) day.cards += 1;
  }
  for (const a of assignments) {
    const day = byDate.get(isoDate(a.createdAt));
    if (day) day.assignments += 1;
  }

  const list = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const isActive = (d) => d.focusMin >= 5 || d.cards >= 3 || d.assignments >= 1;

  let streak = 0;
  let i = 0;
  if (list[0] && !isActive(list[0])) i = 1;
  while (i < list.length && isActive(list[i])) { streak++; i++; }

  const totalMin = list.reduce((s, d) => s + d.focusMin, 0);
  const totalCards = list.reduce((s, d) => s + d.cards, 0);
  const totalAssignments = list.reduce((s, d) => s + d.assignments, 0);
  const activeDays = list.filter(isActive).length;

  res.json({ days: list, streak, totalMin, totalCards, totalAssignments, activeDays });
}));

export default router;