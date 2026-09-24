import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

// ---------- Authenticated study-set routes ----------
export const setRoutes = Router();
setRoutes.use(requireAuth);

const cardSchema = z.object({ front: z.string().trim().min(1).max(1000), back: z.string().trim().min(1).max(2000) });

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

/** Ownership check helper for card operations */
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

// Bulk insert (used by AI generator)
setRoutes.post('/:id/cards/bulk', validate(z.object({ cards: z.array(cardSchema).min(1).max(100) })), wrap(async (req, res) => {
  await ownedSet(req.params.id, req.user.id);
  await prisma.flashcard.createMany({ data: req.body.cards.map((c) => ({ ...c, setId: req.params.id })) });
  res.status(201).json(await prisma.flashcard.findMany({ where: { setId: req.params.id } }));
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
  res.json({ title: set.title, content: set.content, cards: set.cards, author: set.user.name });
}));
