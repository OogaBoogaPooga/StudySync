import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';
import * as officeparserModule from 'officeparser';
import { z } from 'zod';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const parseOfficeAsync =
  officeparserModule.parseOfficeAsync ||
  officeparserModule.default?.parseOfficeAsync ||
  officeparserModule.default;

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callAI({ systemPrompt, userPrompt, jsonMode = false, maxTokens = 4000 }) {
  const body = {
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    temperature: 0.45,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq error (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function normalizeHtml(html) {
  return html
    .replace(/<span[^>]*font-weight:\s*(bold|[6-9]00)[^>]*>([\s\S]*?)<\/span>/gi, '<strong>$2</strong>')
    .replace(/<span[^>]*font-style:\s*italic[^>]*>([\s\S]*?)<\/span>/gi, '<em>$1</em>')
    .replace(/<span[^>]*text-decoration[^>]*underline[^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>')
    .replace(/<span[^>]*background-color[^>]*>([\s\S]*?)<\/span>/gi, '<mark>$1</mark>')
    .replace(/<b(\s[^>]*)?>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s[^>]*)?>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>')
    .replace(/<div[^>]*>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ');
}

function extractPdfHtml(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataError', (err) => reject(new Error(err?.parserError || 'PDF parse error')));
    parser.on('pdfParser_dataReady', (data) => {
      try {
        const out = [];
        for (const page of data.Pages || []) {
          const fontMap = {};
          for (const f of page.Fonts || []) {
            fontMap[f.id] = (f.name || '').toLowerCase();
          }
          const lines = {};
          for (const text of page.Texts || []) {
            const y = Math.round(text.y * 5) / 5;
            if (!lines[y]) lines[y] = [];
            for (const run of text.R || []) {
              let t = '';
              try { t = decodeURIComponent(run.T || ''); } catch { t = run.T || ''; }
              if (!t) continue;
              const ts = run.TS || [];
              const fontName = fontMap[ts[0]] || '';
              const boldByFlag = !!ts[2];
              const boldByName = /bold|black|heavy|semibold|demi|bd\b/.test(fontName);
              const italicByFlag = !!ts[3];
              const italicByName = /italic|oblique|it\b/.test(fontName);
              const bold = boldByFlag || boldByName;
              const italic = italicByFlag || italicByName;
              if (bold) t = `<strong>${t}</strong>`;
              else if (italic) t = `<em>${t}</em>`;
              lines[y].push(t);
            }
          }
          const ordered = Object.keys(lines).map(Number).sort((a, b) => b - a);
          for (const y of ordered) {
            const line = lines[y].join('').trim();
            if (line) out.push(`<p>${line}</p>`);
          }
        }
        resolve(out.join(''));
      } catch (e) {
        reject(e);
      }
    });
    parser.parseBuffer(buffer);
  });
}

const NOTES_SYSTEM_PROMPT = `You turn source material into detailed APUSH study notes written in the voice of a sharp, well-prepared student — clear and precise, but not stiff or robotic. Not a textbook. Not a text message. The kind of notes you would actually use to write an LEQ or DBQ.

FORMAT — every entry looks exactly like this, one per paragraph:
<p><strong>Term:</strong> explanation covering what it is, when/where it happened, who was involved, and why it mattered historically. 2 to 4 sentences.</p>

RULES:
1. Pull out every named event, war, treaty, battle, person, place, act, policy, movement, court case, and year from the source. Each one gets its own entry.
2. Do not skip anyone or anything. If a person is named, they get their own entry.
3. Never split a term across punctuation. "Proclamation of 1763" is ONE term written as Proclamation of 1763 inside the strong tag. Never put a period or comma right before the colon.
4. Never invent facts or years. Only use what is in the source.
5. Preserve every date, name, number, and citation marker exactly as written.
6. If the source has strong, em, u, or mark tags, every term inside those tags MUST get its own entry.
7. Tone: write like a student who genuinely understands the material. Full sentences. Proper historical terms. You can say "this led to" or "the key thing here is" but avoid filler phrases. No fluff, no hedging.
8. For every entry include: what it is, when or context, and why it mattered for APUSH themes like continuity and change, causation, or power and politics.
9. No Key Terms section. No Key Takeaways. No Cause and Effect section. No headers of any kind. Everything is inline paragraphs only.

OUTPUT FORMAT: Respond with HTML content ONLY. No JSON. No markdown. No backticks. No preamble.
On the very first line output the title as plain text ending with a newline, then start the HTML. Example:

Proclamation of 1763
<p><strong>Proclamation of 1763:</strong> Issued by Britain in 1763 after the Seven Years War, this law prohibited colonial settlement west of the Appalachian Mountains. It was meant to prevent costly conflicts with Native Americans, but colonists saw it as an infringement on their rights and largely ignored it, fueling early resentment toward British authority.</p>
<p><strong>George Washington:</strong> Virginia planter and militia officer who commanded colonial forces during the French and Indian War, including the defeat at Fort Necessity in 1754. His military experience and reputation later made him the obvious choice to lead the Continental Army.</p>

Only use these tags: p, strong, em, u, mark.`;

const STOPWORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'They', 'Their', 'There',
  'Which', 'When', 'Where', 'What', 'While', 'With', 'From', 'Into',
  'Upon', 'After', 'Before', 'During', 'Under', 'Over', 'About',
  'Also', 'Both', 'Each', 'Many', 'Most', 'Some', 'Such', 'More',
  'American', 'United', 'States', 'Government', 'People', 'Nation',
  'History', 'Period', 'Time', 'Year', 'Years', 'Century', 'Section',
  'Chapter', 'Page', 'Part', 'Study', 'Notes', 'Review', 'Answer',
]);

function extractTerms(text) {
  const terms = new Set();

  for (const tag of ['strong', 'em', 'u', 'mark']) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const inner = m[1].replace(/<[^>]+>/g, '').trim();
      if (inner && inner.length > 2 && inner.length < 80) terms.add(inner);
    }
  }

  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const phrases = plain.match(/\b[A-Z][a-zA-Z]+(?:\s+(?:[A-Z][a-zA-Z]+|[&']\s*[A-Z][a-zA-Z]+)){0,3}\b/g) || [];
  for (const p of phrases) {
    const clean = p.trim();
    if (clean.length < 4) continue;
    if (STOPWORDS.has(clean)) continue;
    terms.add(clean);
  }

  for (const y of plain.match(/\b1[5-9]\d{2}\b/g) || []) terms.add(y);

  return [...terms].slice(0, 30);
}

async function generateNotes(sourceContent) {
  const terms = extractTerms(sourceContent);
  const checklist = terms.length
    ? `\n\nMANDATORY TERMS — your output MUST contain a separate entry for EVERY item below. Do not merge them. Do not skip any.\n\n${terms.map((t) => `- ${t}`).join('\n')}`
    : '';

  if (process.env.GROQ_API_KEY) {
    try {
      const raw = await callAI({
        systemPrompt: NOTES_SYSTEM_PROMPT + checklist,
        userPrompt: sourceContent.slice(0, 20000),
        maxTokens: 8000,
      });

      let text = (raw || '').trim();
      text = text.replace(/^```(?:html|json)?\s*/i, '').replace(/```\s*$/i, '').trim();

      let title = 'AI notes';
      let html = text;

      if (text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.html) { title = parsed.title || 'AI notes'; html = parsed.html; }
        } catch {}
      } else {
        const newlineIndex = text.indexOf('\n');
        if (newlineIndex > 0 && newlineIndex < 200) {
          const firstLine = text.slice(0, newlineIndex).trim();
          const rest = text.slice(newlineIndex + 1).trim();
          if (firstLine && !firstLine.includes('<') && firstLine.length < 120 && rest.includes('<')) {
            title = firstLine.replace(/^["']|["']$/g, '');
            html = rest;
          }
        }
      }

      if (html && html.includes('<')) {
        return { title, html, source: 'ai' };
      }
    } catch (e) {
      console.warn('Groq notes generation failed, falling back:', e.message);
    }
  }

  const plain = sourceContent.replace(/<[^>]+>/g, ' ');
  return { ...heuristicNotes(plain), source: 'heuristic' };
}

function heuristicNotes(text) {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = plain.split(/(?<=[.!?])\s+/).slice(0, 60);
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 4) {
    const chunk = sentences.slice(i, i + 4).join(' ');
    if (chunk) paragraphs.push(`<p>${chunk}</p>`);
  }
  const title = (plain.split(/[.!?]/)[0] || 'Notes').slice(0, 60).trim();
  return { title, html: `<h2>Summary</h2>${paragraphs.join('')}` };
}

function heuristicCards(text, max = 12) {
  const cards = [];
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  for (const line of text.replace(/<[^>]+>/g, '\n').split(/\n+/)) {
    const m = line.match(/^\s*([^:\-\u2013]{2,60})\s*[:\-\u2013]\s*(.{5,})$/);
    if (m) cards.push({ front: `What is ${m[1].trim()}?`, back: m[2].trim() });
  }
  for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
    if (cards.length >= max) break;
    const m = sentence.match(/^(?:The\s+)?([A-Z][\w\s-]{2,50}?)\s+(is|are|means|refers to)\s+(.{8,})$/i);
    if (m) cards.push({ front: `What ${m[2].toLowerCase()} ${m[1].trim()}?`, back: sentence.trim() });
  }
  const seen = new Set();
  return cards.filter((c) => !seen.has(c.front) && seen.add(c.front)).slice(0, max);
}

/* ---------- Flashcards ---------- */

router.post(
  '/flashcards',
  validate(z.object({
    text: z.string().trim().min(20, 'Paste at least a few sentences'),
    max: z.coerce.number().int().min(1).max(30).default(12),
  })),
  wrap(async (req, res) => {
    const { text, max } = req.body;
    let cards = [];
    let source = 'heuristic';

    if (process.env.GROQ_API_KEY) {
      try {
        const content = await callAI({
          systemPrompt: `You are a study assistant. Summarize the student's notes into up to ${max} high-quality flashcards. Respond ONLY with JSON: {"cards":[{"front":"question","back":"concise answer"}]}. Questions should test understanding, not trivia. Keep answers under 40 words.`,
          userPrompt: text.slice(0, 12000),
          jsonMode: true,
          maxTokens: 3000,
        });
        const parsed = JSON.parse(content);
        cards = (parsed.cards || []).filter((c) => c.front && c.back).slice(0, max);
        source = 'ai';
      } catch (e) {
        console.warn('Groq flashcard generation failed, falling back:', e.message);
      }
    }

    if (!cards.length) cards = heuristicCards(text, max);
    if (!cards.length) return res.status(422).json({ error: 'Could not extract flashcards. Try "Term: definition" lines or fuller sentences.' });
    res*
        res.json({ cards, source });
  })
);

/* ---------- Notes (pasted text) ---------- */

router.post(
  '/notes',
  validate(z.object({
    text: z.string().trim().min(50, 'Paste at least a paragraph of source text'),
  })),
  wrap(async (req, res) => {
    const normalized = normalizeHtml(req.body.text);
    res.json(await generateNotes(normalized));
  })
);

/* ---------- Notes (uploaded file) ---------- */

router.post('/notes/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const name = (req.file.originalname || '').toLowerCase();
  let content = '';

  try {
    if (name.endsWith('.docx')) {
      const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
      content = normalizeHtml(result.value);
    } else if (name.endsWith('.pdf')) {
      content = await extractPdfHtml(req.file.buffer);
    } else {
      content = await parseOfficeAsync(req.file.buffer);
    }
  } catch (e) {
    return res.status(422).json({ error: `Could not read that file (${e.message}). Try .docx, .pptx, .pdf, or .txt.` });
  }

  content = (content || '').trim();
  if (content.replace(/<[^>]+>/g, '').trim().length < 50) {
    return res.status(422).json({ error: 'That file has too little text to work with.' });
  }

  res.json(await generateNotes(content));
}));

export default router;
