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

// ---------- The actual sync ----------
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

  // Your district's portal base URL and app slug — hardcoded from the URL you gave me.
  // If the district ever changes the portal domain, update these.
  const BASE_URL = 'https://jamestownnd.infinitecampus.org';
  const APP_NAME = 'jamestown';

  // ---------- Step 1: log in via verify.jsp and capture the session cookie ----------
  const loginUrl = `${BASE_URL}/campus/verify.jsp?nonBrowser=true&username=${encodeURIComponent(user.icUsername)}&password=${encodeURIComponent(password)}&appName=${APP_NAME}`;

  let loginRes;
  try {
    loginRes = await fetch(loginUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  } catch (e) {
    console.error('[ic/sync] login fetch failed:', e.message);
    return res.status(502).json({ error: `Could not reach Infinite Campus: ${e.message}` });
  }

  // Collect cookies from all Set-Cookie headers
  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  if (!rawCookies.length) {
    const single = loginRes.headers.get('set-cookie');
    if (single) rawCookies.push(single);
  }
  const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');

  if (!cookieHeader || !/JSESSIONID/i.test(cookieHeader)) {
    // Read the body to see if there's a specific rejection message
    const body = await loginRes.text().catch(() => '');
    const hint = /password/i.test(body) ? 'Password was rejected.'
               : /username/i.test(body) ? 'Username was rejected.'
               : /appName/i.test(body) ? 'App name mismatch.'
               : 'No JSESSIONID cookie returned.';
    console.error('[ic/sync] login failed:', loginRes.status, hint);
    return res.status(401).json({
      error: `Infinite Campus login failed (${loginRes.status}). ${hint} Make sure you're using your student portal username and password, not your Microsoft email.`,
    });
  }

  // ---------- Step 2: fetch the gradebook data ----------
  // IC's portal fetches grades from an internal JSON endpoint. Try the common ones.
  const candidateEndpoints = [
    `${BASE_URL}/campus/api/portal/grades?appName=${APP_NAME}&personID=`,
    `${BASE_URL}/campus/resources/portal/grades?appName=${APP_NAME}`,
    `${BASE_URL}/campus/portal/student/grades?appName=${APP_NAME}`,
    `${BASE_URL}/campus/nav-wrapper/student/portal/student/grades?appName=${APP_NAME}`,
  ];

  let gradeHtml = '';
  let usedEndpoint = '';
  for (const url of candidateEndpoints) {
    try {
      const r = await fetch(url, {
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html, */*',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (r.ok) {
        const text = await r.text();
        if (text.length > 200 && (text.includes('grade') || text.includes('course') || text.includes('enrollment'))) {
          gradeHtml = text;
          usedEndpoint = url;
          break;
        }
      }
    } catch (e) {
      // try next endpoint
    }
  }

  if (!gradeHtml) {
    console.error('[ic/sync] no grade endpoint returned usable data');
    return res.status(502).json({
      error: 'Logged in, but could not find a grade data endpoint. Your portal may use a different API path.',
    });
  }

  // ---------- Step 3: parse ----------
  // Try JSON first (in case one of the API endpoints returned structured data)
  let parsed = [];
  try {
    const json = JSON.parse(gradeHtml);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const name = node.courseName || node.name || node.sectionName || node.title;
      const pct = node.percentage ?? node.percent ?? node.gradePercent ?? node.grade;
      if (name && pct != null) {
        const p = Number(String(pct).replace('%', '').trim());
        if (Number.isFinite(p)) parsed.push({ name: String(name).trim(), pct: p });
      }
      Object.values(node).forEach(walk);
    };
    walk(json);
  } catch {
    // Not JSON — fall back to regex on HTML.
    // Matches patterns like: <div class="course-name">AP Chem</div> ... <span class="grade">95.97%</span>
    const blocks = gradeHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const block of blocks) {
      const nameMatch = block.match(/(?:courseName|course-name|courseName|sectionName)[^>]*>([^<]{3,80})</i)
        || block.match(/<td[^>]*>([^<]{3,80}(?:AP|Honors|Chemistry|Algebra|English|History|Physics|Biology|Math|Science)[^<]{0,40})</i);
      const gradeMatch = block.match(/(\d{1,3}\.\d{1,2})\s*%/);
      if (nameMatch && gradeMatch) {
        const name = nameMatch[1].trim().replace(/&amp;/g, '&');
        const pct = parseFloat(gradeMatch[1]);
        if (name && Number.isFinite(pct) && pct >= 0 && pct <= 150) {
          parsed.push({ name, pct });
        }
      }
    }
  }

  // Deduplicate by course name
  const seen = new Set();
  parsed = parsed.filter((c) => {
    const k = c.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!parsed.length) {
    console.error('[ic/sync] parsed 0 grades from', usedEndpoint, '— first 500 chars:', gradeHtml.slice(0, 500));
    return res.status(502).json({
      error: 'Logged in but could not parse any grades. The portal returned data in an unexpected format.',
    });
  }

  // ---------- Step 4: match or create classes ----------
  const classes = await prisma.class.findMany({ where: { userId: req.user.id } });
  const created = [];
  const updated = [];

  for (const c of parsed) {
    const existing = classes.find((k) => k.name.toLowerCase() === c.name.toLowerCase());
    if (existing) {
      await prisma.class.update({
        where: { id: existing.id },
        data: {
          snapshotScore: c.pct,
          snapshotMax: 100,
          snapshotUpdatedAt: new Date(),
          snapshotSource: 'infinitecampus',
        },
      });
      updated.push({ icName: c.name, matchedTo: existing.name, pct: c.pct });
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
