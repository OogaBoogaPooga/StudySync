import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const classSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #6366f1').default('#6366f1'),
  credits: z.coerce.number().min(0).max(10).default(3),
});

router.get('/', wrap(async (req, res) => {
  const classes = await prisma.class.findMany({
    where: { userId: req.user.id },
    include: { _count: { select: { assignments: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(classes);
}));

router.post('/', validate(classSchema), wrap(async (req, res) => {
  const cls = await prisma.class.create({ data: { ...req.body, userId: req.user.id } });
  res.status(201).json(cls);
}));

router.put('/:id', validate(classSchema.partial()), wrap(async (req, res) => {
  // updateMany with userId ensures a user can only edit their own class
  const result = await prisma.class.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: req.body });
  if (!result.count) return res.status(404).json({ error: 'Class not found' });
  res.json(await prisma.class.findUnique({ where: { id: req.params.id } }));
}));

router.delete('/:id', wrap(async (req, res) => {
  const result = await prisma.class.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  if (!result.count) return res.status(404).json({ error: 'Class not found' });
  res.status(204).end();
}));

export default router;
