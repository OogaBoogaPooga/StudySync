import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const router = Router();
router.use(requireAuth);

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

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
    data: { icDistrict: district, icState: state, icUsername: username, icPasswordEnc: enc },
  });
  res.json({ ok: true });
}));

// ---------- Disconnect ----------
router.delete('/credentials', wrap(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { icDistrict: null, icState: null, icUsername: null, icPasswordEnc: null, icLastSync: null },
  });
  res.json({ ok: true });
}));

// ---------- Name normalization + matching ----------
function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 60;
  // token overlap
  const ta = new Set(na.split(' ').filter((w) => w.length > 2));
  const tb = new Set(nb.split(' ').filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  ta.forEach((w) => { if (tb.has(w)) hits++; });
  return Math.round((hits / Math.max(ta.size, tb.size)) * 50);
}

// ---------- Sync ----------
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
    return res.status(500).json({ error: 'Could not read stored credentials. Try re-entering them.' });
  }

  let IC;
  try {
    const mod = await import('infinite-campus');
    IC = mod.default || mod;
  } catch (e) {
    return res.status(500).json({ error: 'infinite-campus library not installed.' });
  }

  // Shorter timeout than Railway's proxy so we return a real error before the proxy cuts us off.
  const fetchGrades = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Login timed out after 12s')), 12000);
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
    return res.status(502).json({
      error: 'Infinite Campus returned no course data. This usually means your district uses Microsoft SSO, which the library cannot handle. Manual grade entry is recommended.',
    });
  }

  // Flatten: the library returns terms, each with a courses array
  const flat = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== 'object') return;
    if (node.courseName || node.name || node.CourseName || node.title) {
      flat.push(node);
    }
    if (Array.isArray(node.courses)) node.courses.forEach(walk);
  };
  walk(courses);

  const parsed = flat.map((c) => {
    const name = c.courseName || c.name || c.CourseName || c.title || c.periodName || '';
    const pctRaw = c.percentage ?? c.percent ?? c.gradePercent ?? c.grade ?? c.score ?? null;
    let pct = null;
    if (pctRaw != null) {
      const cleaned = Number(String(pctRaw).replace('%', '').trim());
      if (Number.isFinite(cleaned)) pct = cleaned;
    }
    const letter = c.letterGrade || c.gradeLetter || c.letter || null;
    return { name: String(name).trim(), pct, letter };
  }).filter((c) => c.name && c.pct != null);

  if (!parsed.length) {
    return res.status(502).json({
      error: 'Logged in but could not parse any grades. Your district\'s IC portal may return a different format than the library supports.',
    });
  }

  // Match against existing classes, auto-create the rest
  const classes = await prisma.class.findMany({ where: { userId: req.user.id } });
  const created = [];
  const updated = [];

  for (const c of parsed) {
    let best = null;
    let bestScore = 0;
    for (const existing of classes) {
      const s = scoreMatch(existing.name, c.name);
      if (s > bestScore) { bestScore = s; best = existing; }
    }

    if (best && bestScore >= 50) {
      await prisma.class.update({
        where: { id: best.id },
        data: { snapshotScore: c.pct, snapshotMax: 100, snapshotUpdatedAt: new Date(), snapshotSource: 'infinitecampus' },
      });
      updated.push({ icName: c.name, matchedTo: best.name, pct: c.pct });
    } else {
      const color = COLORS[classes.length % COLORS.length];
      const fresh = await prisma.class.create({
        data: {
          name: c.name,
          color,
          credits: 1,
          userId: req.user.id,
          snapshotScore: c.pct,
          snapshotMax: 100,
          snapshotUpdatedAt: new Date(),
          snapshotSource: 'infinitecampus',
        },
      });
      classes.push(fresh);
      created.push({ name: c.name, pct: c.pct });
    }
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { icLastSync: new Date() } });

  res.json({
    ok: true,
    updated,
    created,
    syncedAt: new Date().toISOString(),
  });
}));

export default router;
