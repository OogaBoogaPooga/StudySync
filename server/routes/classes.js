import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #6366f1');

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: hexColor.default('#6366f1'),
  credits: z.coerce.number().min(0).max(10).default(3),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: hexColor.optional(),
  credits: z.coerce.number().min(0).max(10).optional(),
  snapshotScore: z.number().nullable().optional(),
  snapshotMax: z.number().nullable().optional(),
  snapshotUpdatedAt: z.union([z.string(), z.date(), z.null()]).optional(),
  snapshotSource: z.string().nullable().optional(),
});

router.get('/', wrap(async (req, res) => {
  const classes = await prisma.class.findMany({
    where: { userId: req.user.id },
    include: { _count: { select: { assignments: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(classes);
}));

router.post('/', validate(createSchema), wrap(async (req, res) => {
  const cls = await prisma.class.create({ data: { ...req.body, userId: req.user.id } });
  res.status(201).json(cls);
}));

router.put('/:id', validate(updateSchema), wrap(async (req, res) => {
  const data = { ...req.body };

  // Convert ISO string → Date for Prisma
  if (data.snapshotUpdatedAt && typeof data.snapshotUpdatedAt === 'string') {
    data.snapshotUpdatedAt = new Date(data.snapshotUpdatedAt);
  }

  // Strip undefined values — Prisma rejects empty updates
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }

  // No-op case: verify ownership and return the current class
  if (!Object.keys(data).length) {
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });
    return res.json(existing);
  }

  const result = await prisma.class.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data,
  });

  if (!result.count) {
    console.error('[classes/put] not found', { id: req.params.id, userId: req.user.id });
    return res.status(404).json({ error: 'Class not found' });
  }

  res.json(await prisma.class.findUnique({ where: { id: req.params.id } }));
}));

router.delete('/:id', wrap(async (req, res) => {
  const result = await prisma.class.deleteMany({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!result.count) return res.status(404).json({ error: 'Class not found' });
  res.status(204).end();
}));

export default router;
