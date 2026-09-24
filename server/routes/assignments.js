import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const assignmentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.coerce.date(),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  completed: z.boolean().default(false),
  score: z.coerce.number().min(0).nullable().optional(),
  maxScore: z.coerce.number().positive().default(100),
  weight: z.coerce.number().positive().default(1),
  classId: z.string().nullable().optional(),
});

/** Ensures the referenced class belongs to the current user */
async function assertClassOwned(classId, userId) {
  if (!classId) return;
  const cls = await prisma.class.findFirst({ where: { id: classId, userId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 400 });
}

router.get('/', wrap(async (req, res) => {
  const items = await prisma.assignment.findMany({
    where: { userId: req.user.id },
    include: { class: true },
    orderBy: { dueDate: 'asc' },
  });
  res.json(items);
}));

router.post('/', validate(assignmentSchema), wrap(async (req, res) => {
  await assertClassOwned(req.body.classId, req.user.id);
  const data = { ...req.body, userId: req.user.id };
  if (data.progress === 100) data.completed = true; // auto-complete at 100%
  const item = await prisma.assignment.create({ data, include: { class: true } });
  res.status(201).json(item);
}));

router.put('/:id', validate(assignmentSchema.partial()), wrap(async (req, res) => {
  await assertClassOwned(req.body.classId, req.user.id);
  const data = { ...req.body };
  if (data.progress === 100) data.completed = true;
  if (data.completed === true && data.progress === undefined) data.progress = 100;
  const result = await prisma.assignment.updateMany({ where: { id: req.params.id, userId: req.user.id }, data });
  if (!result.count) return res.status(404).json({ error: 'Assignment not found' });
  res.json(await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { class: true } }));
}));

router.delete('/:id', wrap(async (req, res) => {
  const result = await prisma.assignment.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  if (!result.count) return res.status(404).json({ error: 'Assignment not found' });
  res.status(204).end();
}));

export default router;
