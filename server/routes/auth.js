import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
const sign = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

router.post('/register', validate(registerSchema), wrap(async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'An account with that email already exists' });
  const user = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(password, 10) } });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

const loginSchema = z.object({ email: z.string().trim().email().toLowerCase(), password: z.string().min(1) });

router.post('/login', validate(loginSchema), wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  const ok = user && (await bcrypt.compare(req.body.password, user.password));
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });
  res.json({ token: sign(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(user));
}));

export default router;
