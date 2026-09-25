import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const router = Router();
router.use(requireAuth);

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const GRADES_ENDPOINTS = [
  '/campus/resources/portal/grades',
  '/campus/resources/portal/gradebook',
  '/campus/portal/student/grades',
  '/campus/api/portal/grades',
];

function parsePortalUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  const base = `${url.protocol}//${url.host}`;
  let app = url.searchParams.get('appName');
  if (!app) {
    const m = url.pathname.match(/\/([a-zA-Z0-9_-]+)\.jsp/);
    if (m) app = m[1];
  }
  return { base, app };
}

async function login(base, app, username, password) {
  const url = `${base}/campus/verify.jsp?nonBrowser=true&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&appName=${app}`;
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (!rawCookies.length) {
    const single = res.headers.get('set-cookie');
    if (single) rawCookies.push(single);
  }
  const cookiePairs = rawCookies.map((c) => c.split(';')[0]);
  const cookieHeader = cookiePairs.join('; ');
  const xsrf = cookiePairs.find((c) => /^XSRF-TOKEN=/i.test(c))?.split('=').slice(1).join('=');

  if (!/JSESSIONID/i.test(cookieHeader)) {
    const body = await res.text().catch(() => '');
    const hint = /password/i.test(body) ? 'Password rejected.'
               : /username/i.test(body) ? 'Username rejected.'
               : /appName/i.test(body) ? 'App name mismatch.'
               : 'No JSESSIONID cookie returned.';
    throw new Error(`Login failed (${res.status}). ${hint}`);
  }
  return { cookieHeader, xsrf };
}

async function fetchIC(base, app, path, cookieHeader, xsrf) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${base}${path}${sep}appName=${app}`;
  const headers = {
    'Cookie': cookieHeader,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': `${base}/campus/nav-wrapper/student/portal/student/grades?appName=${app}`,
  };
  if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { __rawText: text.slice(0, 2000) }; }
}

/* ---------- IC "portal/grades" parser (matches your district's shape) ---------- */

function parseICGrades(data) {
  const out = [];
  const seen = new Set();

  const enrollments = Array.isArray(data) ? data
    : Array.isArray(data?.enrollments) ? data.enrollments
    : data ? [data] : [];
  if (!enrollments.length) return out;

  // Find the term whose date range contains today
  const today = Date.now();
  const allTerms = [];
  for (const e of enrollments) {
    if (Array.isArray(e?.terms)) allTerms.push(...e.terms);
  }
  const currentTermID = (() => {
    for (const t of allTerms) {
      if (!t.startDate || !t.endDate) continue;
      const s = Date.parse(t.startDate);
      const en = Date.parse(t.endDate);
      if (Number.isFinite(s) && Number.isFinite(en) && s <= today && today <= en) return t.termID;
    }
    return null;
  })();

  for (const enrollment of enrollments) {
    if (!Array.isArray(enrollment?.courses)) continue;
    for (const course of enrollment.courses) {
      const courseName = course.courseName || course.name || course.title;
      if (!courseName) continue;

      const tasks = Array.isArray(course.gradingTasks) ? course.gradingTasks : [];

      // Tasks that represent the overall course grade for a term
      const gradeTasks = tasks.filter((t) => {
        if (t.progressPercent == null) return false;
        const n = String(t.taskName || '').toLowerCase().trim();
        return n === 'term grade' || n === 'final grade' || n === 'overall grade' || n === 'semester grade';
      });

      // Prefer current term
      let pick = null;
      if (currentTermID != null) {
        pick = gradeTasks.find((t) => t.termID === currentTermID);
      }
      // Else the most recent term that has a grade
      if (!pick && gradeTasks.length) {
        pick = gradeTasks.slice().sort((a, b) => (b.termSeq || 0) - (a.termSeq || 0))[0];
      }

      if (!pick) continue;

      const pct = Number(pick.progressPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 150) continue;

      const key = String(courseName).toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        name: String(courseName).trim(),
        pct,
        letter: pick.progressScore || null,
        term: pick.termName || null,
      });
    }
  }
  return out;
}

/* ---------- Generic fallback parser for other IC portal variants ---------- */

function parseGenericGrades(data) {
  const out = [];
  const seen = new Set();

  const push = (name, raw) => {
    if (!name || raw == null) return;
    const pct = Number(String(raw).replace('%', '').trim());
    if (!Number.isFinite(pct) || pct < 0 || pct > 150) return;
    const key = String(name).toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: String(name).trim(), pct, letter: null, term: null });
  };

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== 'object') return;

    const name = node.courseName || node.courseTitle || node.sectionName ||
                 node.courseDescription || node.className || node.title || node.name;

    let pct = node.displayGrade ?? node.calculatedScore ?? node.percentage ??
              node.percent ?? node.gradePercent ?? node.scorePercent ??
              node.currentGrade ?? node.termGrade ?? node.finalGrade ??
              node.grade ?? node.score;
    if (pct == null && Array.isArray(node.gradingTasks)) {
      const term = node.gradingTasks.find((t) =>
        /term|final|semester|quarter|overall/i.test(String(t.name || t.taskName || '')) &&
        (t.progressPercent != null || t.score != null || t.percentage != null)
      );
      if (term) pct = term.progressPercent ?? term.score ?? term.percentage;
    }
    if (name && pct != null) push(name, pct);

    Object.values(node).forEach(walk);
  };

  walk(data);
  return out;
}

function extractGrades(data) {
  const structured = parseICGrades(data);
  if (structured.length) return structured;
  return parseGenericGrades(data);
}

/* ---------- Sync orchestration ---------- */

async function syncUser(user, password) {
  const parsed = parsePortalUrl(user.icPortalUrl);
  if (!parsed) throw new Error('Invalid portal URL saved. Re-enter it.');
  const { base, app } = parsed;
  if (!app) throw new Error('Could not determine app name from portal URL. Include ?appName=... in the URL.');

  const session = await login(base, app, user.icUsername, password);

  const order = user.icWorkingEndpoint
    ? [user.icWorkingEndpoint, ...GRADES_ENDPOINTS.filter((e) => e !== user.icWorkingEndpoint)]
    : GRADES_ENDPOINTS;

  let working = null;
  let grades = [];
  let lastError = '';
  for (const path of order) {
    try {
      const data = await fetchIC(base, app, path, session.cookieHeader, session.xsrf);
      const g = extractGrades(data);
      if (g.length) { working = path; grades = g; break; }
    } catch (e) { lastError = e.message; }
  }
  return { grades, working, lastError, base, app };
}

/* ---------- Routes ---------- */

router.get('/status', wrap(async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { icPortalUrl: true, icUsername: true, icPasswordEnc: true, icLastSync: true, icWorkingEndpoint: true },
  });
  res.json({
    connected: !!(u?.icPasswordEnc && u?.icUsername && u?.icPortalUrl),
    portalUrl: u?.icPortalUrl || null,
    username: u?.icUsername || null,
    lastSync: u?.icLastSync || null,
  });
}));

const credSchema = z.object({
  portalUrl: z.string().trim().url(),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

router.post('/credentials', validate(credSchema), wrap(async (req, res) => {
  const { portalUrl, username, password } = req.body;
  const parsed = parsePortalUrl(portalUrl);
  if (!parsed || !parsed.app) {
    return res.status(400).json({ error: 'Portal URL must include ?appName=... in it. Copy it from your browser while logged in to IC.' });
  }
  const enc = encrypt(password);
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      icPortalUrl: portalUrl,
      icUsername: username,
      icPasswordEnc: enc,
      icDistrict: parsed.app,
      icState: 'NA',
      icWorkingEndpoint: null,
    },
  });
  res.json({ ok: true });
}));

router.delete('/credentials', wrap(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      icPortalUrl: null, icUsername: null, icPasswordEnc: null,
      icDistrict: null, icState: null, icLastSync: null, icWorkingEndpoint: null,
    },
  });
  res.json({ ok: true });
}));

router.post('/sync', wrap(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, icUsername: true, icPasswordEnc: true, icPortalUrl: true, icWorkingEndpoint: true },
  });
  if (!user?.icPasswordEnc || !user?.icPortalUrl) {
    return res.status(400).json({ error: 'Infinite Campus is not connected. Add your portal URL and credentials first.' });
  }

  let password;
  try { password = decrypt(user.icPasswordEnc); }
  catch { return res.status(500).json({ error: 'Could not read stored credentials. Re-enter them.' }); }

  let result;
  try { result = await syncUser(user, password); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  if (!result.grades.length) {
    return res.status(502).json({
      error: `Logged in but found no grades. Tried ${GRADES_ENDPOINTS.length} endpoints${result.lastError ? '. Last error: ' + result.lastError : '.'}`,
      hint: 'Use /api/ic/debug/probe to see which endpoints your portal responds to.',
    });
  }

  if (result.working && result.working !== user.icWorkingEndpoint) {
    await prisma.user.update({ where: { id: user.id }, data: { icWorkingEndpoint: result.working } });
  }

  const classes = await prisma.class.findMany({ where: { userId: req.user.id } });
  const created = [];
  const updated = [];

  for (const c of result.grades) {
    const existing = classes.find((k) => k.name.toLowerCase() === c.name.toLowerCase());
    if (existing) {
      await prisma.class.update({
        where: { id: existing.id },
        data: { snapshotScore: c.pct, snapshotMax: 100, snapshotUpdatedAt: new Date(), snapshotSource: 'infinitecampus' },
      });
      updated.push({ icName: c.name, matchedTo: existing.name, pct: c.pct, letter: c.letter, term: c.term });
    } else {
      const color = COLORS[classes.length % COLORS.length];
      const fresh = await prisma.class.create({
        data: {
          name: c.name, color, credits: 1, userId: req.user.id,
          snapshotScore: c.pct, snapshotMax: 100,
          snapshotUpdatedAt: new Date(), snapshotSource: 'infinitecampus',
        },
      });
      classes.push(fresh);
      created.push({ name: c.name, pct: c.pct, letter: c.letter, term: c.term });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { icLastSync: new Date() } });
  res.json({ ok: true, updated, created, syncedAt: new Date().toISOString(), endpoint: result.working });
}));

router.get('/debug/probe', wrap(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { icUsername: true, icPasswordEnc: true, icPortalUrl: true },
  });
  if (!user?.icPasswordEnc || !user?.icPortalUrl) return res.status(400).json({ error: 'Not connected' });

  const { base, app } = parsePortalUrl(user.icPortalUrl);
  if (!app) return res.status(400).json({ error: 'Portal URL missing appName' });

  let session;
  try { session = await login(base, app, user.icUsername, decrypt(user.icPasswordEnc)); }
  catch (e) { return res.status(401).json({ error: 'Login failed: ' + e.message }); }

  const results = {};
  for (const path of GRADES_ENDPOINTS) {
    try {
      const data = await fetchIC(base, app, path, session.cookieHeader, session.xsrf);
      const parsed = extractGrades(data);
      results[path] = {
        ok: true,
        gradesFound: parsed.length,
        sample: parsed.slice(0, 8),
        rawPreview: JSON.stringify(data).slice(0, 600),
      };
    } catch (e) {
      results[path] = { ok: false, error: e.message };
    }
  }
  res.json({ base, app, results });
}));

router.get('/debug/raw', wrap(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { icUsername: true, icPasswordEnc: true, icPortalUrl: true },
  });
  if (!user?.icPasswordEnc || !user?.icPortalUrl) return res.status(400).json({ error: 'Not connected' });
  const { base, app } = parsePortalUrl(user.icPortalUrl);
  const path = req.query.path || '/campus/resources/portal/grades';
  const session = await login(base, app, user.icUsername, decrypt(user.icPasswordEnc));
  const data = await fetchIC(base, app, path, session.cookieHeader, session.xsrf);
  res.json(data);
}));

export default router;
