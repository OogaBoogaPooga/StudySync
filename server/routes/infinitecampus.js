import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const router = Router();
router.use(requireAuth);

// ---------- IC status ----------
router.get('/status', wrap(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { icDistrict: true, icState: true, icUsername: true, icPasswordEnc: true, icLastSync: true },
  });
  res.json({
    connected: !!(u?.icPasswordEnc && u?.icUsername && u?.icDistrict && u?.icState),
    district: u?.icDistrict || null,
    state: u?.icState || null,
    username: u?.icUsername || null,
    lastSync: u?.icLastSync || null,
  });
}));

// ---------- Save credentials ----------
const credSchema = z.object({
  district: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(2).toUpperCase(),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

router.post('/credentials', validate(credSchema), wrap(async (req, res) => {
  const { district, state, username, password } = req.body;
  const enc = encrypt(password);
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      icDistrict: district,
      icState: state,
      icUsername: username,
      icPasswordEnc: enc,
    },
  });
  res.json({ ok: true });
}));

// ---------- Disconnect ----------
router.delete('/credentials', wrap(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      icDistrict: null,
      icState: null,
      icUsername: null,
      icPasswordEnc: null,
      icLastSync: null,
    },
  });
  res.json({ ok: true });
}));

// ---------- Sync grades ----------
router.post('/sync', wrap(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, icDistrict: true, icState: true, icUsername: true, icPasswordEnc: true },
  });

  if (!user?.icPasswordEnc) {
    return res.status(400).json({ error: 'Infinite Campus is not connected. Add credentials first.' });
  }

  let password;
  try {
    password = decrypt(user.icPasswordEnc);
  } catch (e) {
    console.error('[ic/sync] decrypt failed:', e.message);
    return res.status(500).json({ error: 'Could not read stored credentials. Try re-entering them.' });
  }

  // Lazy-import so a broken library doesn't crash the whole server on boot
  let IC;
  try {
    const mod = await import('infinite-campus');
    IC = mod.default || mod;
  } catch (e) {
    return res.status(500).json({ error: 'infinite-campus library not installed. Add it to package.json.' });
  }

  // Try to fetch courses / grades. Wrap in a timeout + event handlers.
  const fetchGrades = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Login timed out after 30s')), 30000);
    let client;
    try {
      client = new IC(user.icDistrict, user.icState, user.icUsername, password);
    } catch (e) {
      clearTimeout(timer);
      return reject(e);
    }

    client.on('ready', async () => {
      clearTimeout(timer);
      try {
        // Library exposes getCourses() on most versions. Try a few method names.
        const raw =
          (typeof client.getCourses === 'function' && (await client.getCourses())) ||
          (typeof client.getGrades === 'function' && (await client.getGrades())) ||
          (typeof client.getGradebook === 'function' && (await client.getGradebook())) ||
          null;
        resolve(raw || []);
      } catch (e) {
        reject(e);
      }
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err?.message || err)));
    });
  });

  let courses;
  try {
    courses = await fetchGrades();
  } catch (e) {
    console.error('[ic/sync] fetch failed:', e.message);
    return res.status(502).json({ error: `Infinite Campus sync failed: ${e.message}` });
  }

  if (!Array.isArray(courses) || !courses.length) {
    return res.status(502).json({ error: 'Infinite Campus returned no course data. Your district may use a different portal.' });
  }

  // Normalize whatever shape the library returned
  const parsed = courses.map((c) => {
    const name =
      c.courseName || c.name || c.CourseName || c.title || c.periodName || 'Unknown';
    const pctRaw =
      c.percentage ?? c.percent ?? c.gradePercent ?? c.grade ?? c.score ?? null;
    const pct = pctRaw == null ? null : Number(String(pctRaw).replace('%', '').trim());
    const letter = c.letterGrade || c.gradeLetter || c.letter || null;
    return { name: String(name).trim(), pct: Number.isFinite(pct) ? pct : null, letter };
  }).filter((c) => c.name && c.pct != null);

  if (!parsed.length) {
    return res.status(502).json({ error: 'Could not parse grade data from Infinite Campus response.' });
  }

  // Match to existing StudySync classes by name (case-insensitive substring, either direction)
  const classes = await prisma.class.findMany({ where: { userId: req.user.id } });
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
  const matched = [];
  const unmatched = [];

  for (const c of parsed) {
    const cn = norm(c.name);
    const cls = classes.find((k) => {
      const kn = norm(k.name);
      return kn && cn && (kn === cn || kn.includes(cn) || cn.includes(kn));
    });
    if (cls) {
      await prisma.class.update({
        where: { id: cls.id },
        data: {
          snapshotScore: c.pct,
          snapshotMax: 100,
          snapshotUpdatedAt: new Date(),
        },
      });
      matched.push({ className: cls.name, icName: c.name, pct: c.pct, letter: c.letter });
    } else {
      unmatched.push({ icName: c.name, pct: c.pct });
    }
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { icLastSync: new Date() },
  });

  res.json({
    ok: true,
    matched,
    unmatched,
    syncedAt: new Date().toISOString(),
  });
}));

export default router;
