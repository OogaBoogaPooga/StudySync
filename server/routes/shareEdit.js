import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { validate, wrap } from '../middleware/auth.js';

/**
 * Public share-editing routes. No auth — anyone with the shareId can edit.
 * Share IDs are unguessable cuids, so this is the "anyone with the link can edit"
 * semantic, same trust model as a Google Docs "anyone with the link" share.
 */
const router = Router();

router.put(
  '/:shareId/content',
  validate(z.object({ content: z.string().max(200000) })),
  wrap(async (req, res) => {
    const { shareId } = req.params;
    const { content } = req.body;

    const exists = await prisma.studySet.findUnique({ where: { shareId } });
    if (!exists) return res.status(404).json({ error: 'Set not found' });

    await prisma.studySet.update({ where: { shareId }, data: { content } });
    res.json({ ok: true });
  })
);

export default router;
