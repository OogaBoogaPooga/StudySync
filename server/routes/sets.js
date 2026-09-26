import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

// ---------- Authenticated study-set routes ----------
export const setRoutes = Router();
setRoutes.use(requireAuth);

const cardSchema = z.object({ front: z.string().trim().min(1).max(1000), back: z.string().trim().min(1).max(2000) });

/* ---------- Spaced repetition (SM-2 variant) ---------- */

const MIN_EASE = 1.3;
const MAX_EASE = 2.8;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INTERVAL_DAYS = 365;

function computeNextReview(card, grade, now) {
  const isLearning = card.state === 'new' || card.state === 'learning' || (card.interval ?? 0) === 0;
  const ease = card.ease ?? 2.5;
  const interval = card.interval ?? 0;
  const reps = card.reps ?? 0;
  const lapses = card.lapses ?? 0;

  const AGAIN_MS = 10 * 60 * 1000;
  const HARD_MS = 60 * 60 * 1000;
  const GOOD_DAYS = 1;
  const EASY_DAYS = 4;

  if (isLearning) {
    if (grade === 'again') {
      return {
        ease: Math.max(MIN_EASE, ease - 0.2),
        interval: AGAIN_MS / DAY_MS,
        dueAt: new Date(now.getTime() + AGAIN_MS),
        reps: 0,
        lapses: card.state === 'new' ? lapses : lapses + 1,
        state: 'learning',
        lastReviewedAt: now,
      };
    }
    if (grade === 'hard') {
      return {
        ease: Math.max(MIN_EASE, ease - 0.15),
        interval: HARD_MS / DAY_MS,
        dueAt: new Date(now.getTime() + HARD_MS),
        reps: reps + 1,
        lapses,
        state: 'learning',
        lastReviewedAt: now,
      };
    }
    if (grade === 'good') {
      return {
        ease,
        interval: GOOD_DAYS,
        dueAt: new Date(now.getTime() + GOOD_DAYS * DAY_MS),
        reps: reps + 1,
        lapses,
        state: 'review',
        lastReviewedAt: now,
      };
    }
    return {
      ease: Math.min(MAX_EASE, ease + 0.15),
      interval: EASY_DAYS,
      dueAt: new Date(now.getTime() + EASY_DAYS * DAY_MS),
      reps: reps + 1,
      lapses,
      state: 'review',
      lastReviewedAt: now,
    };
  }

  let newInterval = interval;
  let newEase = ease;

  if (grade === 'again') {
    newEase = Math.max(MIN_EASE, ease - 0.2);
    newInterval = Math.max(1, interval * 0.4);
    return {
      ease: newEase,
      interval: newInterval,
      dueAt: new Date(now.getTime() + newInterval * DAY_MS),
      reps: 0,
      lapses: lapses + 1,
      state: 'learning',
      lastReviewedAt: now,
    };
  }
  if (grade === 'hard') {
    newEase = Math.max(MIN_EASE, ease - 0.15);
    newInterval = Math.max(1, interval * 1.2);
  } else if (grade === 'good') {
    newInterval = Math.max(1, interval * ease);
  } else {
    newEase = Math.min(MAX_EASE, ease + 0.15);
    newInterval = Math.max(1, interval * ease * 1.3);
  }

  newInterval = Math.min(newInterval, MAX_INTERVAL_DAYS);
  const newState = newInterval >= 21 ? 'mastered' : 'review';

  return {
    ease: newEase,
    interval: newInterval,
    dueAt: new Date(now.getTime() + newInterval * DAY_MS),
    reps: reps + 1,
    lapses,
    state: newState,
    lastReviewedAt: now,
  };
}

/* ---------- Set routes ---------- */

setRoutes.get('/', wrap(async (req, res) => {
  const sets = await prisma.studySet.findMany({
    where: { userId: req.user.id },
    include: { _count: { select: { cards: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(sets);
}));

setRoutes.post('/', validate(z.object({ title: z.string().trim().min(1).max(100), content: z.string().max(200000).optional() })), wrap(async (req, res) => {
  const set = await prisma.studySet.create({ data: { title: req.body.title, content: req.body.content || '', userId: req.user.id } });
  res.status(201).json(set);
}));

setRoutes.get('/:id', wrap(async (req, res) => {
  const set = await prisma.studySet.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { cards: true } });
  if (!set) return res.status(404).json({ error: 'Study set not found' });
  res.json(set);
}));

setRoutes.put('/:id', validate(z.object({ title: z.string().trim().min(1).max(100).optional(), content: z.string().max(200000).optional() })), wrap(async (req, res) => {
  const result = await prisma.studySet.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: req.body });
  if (!result.count) return res.status(404).json({ error: 'Study set not found' });
  res.json(await prisma.studySet.findUnique({ where: { id: req.params.id } }));
}));

setRoutes.delete('/:id', wrap(async (req, res) => {
  const result = await prisma.studySet.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  if (!result.count) return res.status(404).json({ error: 'Study set not found' });
  res.status(204).end();
}));

async function ownedSet(setId, userId) {
  const set = await prisma.studySet.findFirst({ where: { id: setId, userId } });
  if (!set) throw Object.assign(new Error('Study set not found'), { status: 404 });
  return set;
}

setRoutes.post('/:id/cards', validate(cardSchema), wrap(async (req, res) => {
  await ownedSet(req.params.id, req.user.id);
  const card = await prisma.flashcard.create({ data: { ...req.body, setId: req.params.id } });
  res.status(201).json(card);
}));

setRoutes.post('/:id/cards/bulk', validate(z.object({ cards: z.array(cardSchema).min(1).max(100) })), wrap(async (req, res) => {
  await ownedSet(req.params.id, req.user.id);
  await prisma.flashcard.createMany({ data: req.body.cards.map((c) => ({ ...c, setId: req.params.id })) });
  res.status(201).json(await prisma.flashcard.findMany({ where: { setId: req.params.id } }));
}));

// Spaced repetition — record a review and reschedule the card
setRoutes.post('/:id/cards/:cardId/review', validate(z.object({
  grade: z.enum(['again', 'hard', 'good', 'easy']),
})), wrap(async (req, res) => {
  await ownedSet(req.params.id, req.user.id);

  const card = await prisma.flashcard.findFirst({
    where: { id: req.params.cardId, setId: req.params.id },
  });
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const now = new Date();
  const update = computeNextReview(card, req.body.grade, now);

  const updated = await prisma.flashcard.update({
    where: { id: card.id },
    data: update,
  });

  res.json(updated);
}));

setRoutes.delete('/:id/cards/:cardId', wrap(async (req, res) => {
  await ownedSet(req.params.id, req.user.id);
  await prisma.flashcard.deleteMany({ where: { id: req.params.cardId, setId: req.params.id } });
  res.status(204).end();
}));

// ---------- Public share route (no auth) ----------
export const shareRoutes = Router();
shareRoutes.get('/:shareId', wrap(async (req, res) => {
  const set = await prisma.studySet.findUnique({
    where: { shareId: req.params.shareId },
    include: { cards: true, user: { select: { name: true } } },
  });
  if (!set) return res.status(404).json({ error: 'This shared set does not exist' });
  res.json({ id: set.id, title: set.title, content: set.content, cards: set.cards, author: set.user.name });
}));
