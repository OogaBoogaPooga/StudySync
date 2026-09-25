import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth'; import PDFParser from 'pdf2json';
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

async function callAI({ systemPrompt, userPrompt, jsonMode = false }) {
  const body = {
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    temperature: 0.3,
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
    throw new Error(`Groq error (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Normalizes HTML so bold/italic/highlight/underline from Word, Google Docs,
 * and other rich-text sources become plain <strong>, <em>, <u>, <mark> tags
 * that the AI can recognize.
 */
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
/**
 * Extracts text from a PDF while preserving bold and italic runs.
 * Uses font-name inspection — works when the PDF embeds named fonts like
 * "Arial-BoldMT". Won't work for scanned PDFs or obfuscated fonts.
 */
function extractPdfHtml(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataError', (err) => reject(new Error(err?.parserError || 'PDF parse error')));
    parser.on('pdfParser_dataReady', (data) => {
      try {
        const out = [];
        for (const page of data.Pages || []) {
          // Build a font-name lookup so we can detect bold by name when the flag is missing
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
              // Detect bold via flag OR font name
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

const NOTES_SYSTEM_PROMPT = `You are turning source material into a student's personal study notes. Not a study guide, not a summary, not a textbook. Study notes in the exact format a real student writes them in class.

THE FORMAT — this is the most important rule:
Every entry follows this exact shape, on its own line:

<p><strong>Term:</strong> casual explanation of what it is or does.</p>

- The term is bolded with <strong>.
- Immediately followed by a colon.
- Then a casual explanation, 1–3 sentences, same line.
- One entry per paragraph. No bullet lists. No headers per term. No sub-bullets.

CRITICAL — PRESERVING BOLDED TERMS FROM THE SOURCE:
The source text may contain <strong>, <em>, <u>, or <mark> tags. These represent terms the student's teacher emphasized or the student highlighted.
- EVERY term that appears in <strong>, <em>, <u>, or <mark> in the source MUST appear as a bolded term (<strong>) at the start of its own paragraph in your output.
- Do not skip any emphasized term. Even if it seems minor. Even if it appears mid-sentence in the source.
- If the source has an emphasized term with an explanation right after it, put the term in <strong> at the start of the paragraph and the explanation after the colon.
- If the source has an emphasized term with no explanation, use the surrounding sentences to write a short explanation for it.
- Count the emphasized terms in the source. Count the bolded entries in your output. The numbers must match.

VOICE:
- Write laid, back and professional, like a advanced student explaining to a classmate. "Basically," "this is when," "in other words," "think of it as" are all fine.
- Keep the student's shorthand. If they wrote "more then just," keep it.
- Short parenthetical asides for context are welcome. Example: "(people start going to church again)".
- Do NOT clean up the source's grammar to sound formal. Match the source's voice.
- Keep explanations short. This is a cheat sheet, not an essay.

PRESERVE FROM SOURCE:
- Keep citation markers like [1], [2], [3] exactly where they appeared.
- Keep every date, name, treaty, court case, and number.


DO NOT:
- Do NOT add a "Key Terms" section at the end.
- Do NOT add a "Key Takeaways" section.
- Do NOT add a "Cause and Effect" section.
- Do NOT use bullet lists (<ul>/<ol>) unless the source itself is a list.
- Do NOT add headings for every entry. Only use <h2> when the source genuinely shifts to a new topic.

Respond ONLY with JSON: {"title":"short descriptive title","html":"<h2>Topic</h2><p><strong>Term:</strong> explanation</p>"}. Use only these HTML tags: h2, h3, p, ul, ol, li, strong, em, u, mark. Do not include a top-level h1.`

/** Pulls out proper nouns, dates, and tagged terms as a mandatory checklist */
function extractTerms(text) {
  const terms = new Set();
  const stopwords = new Set(['The','And','This','That','They','These','Those','However','Nevertheless','Therefore','Because','When','While','After','Before','Importantly','Ultimately','First','Second','Third','Lastly','By','In','On','At','To','Of','For','With','From','As','If','It','Its','But','Or','So','Yet','Also','Both','Each','Every','Some','Many','Most','Such','Then','Than','Here','There','Where','What','Which','Who','Whom','Whose','Why','How']);

  // Anything wrapped in formatting tags
  for (const tag of text.match(/<(strong|em|u|mark)>([^<]+)<\/\1>/g) || []) {
    const inner = tag.replace(/<[^>]+>/g, '').trim();
    if (inner) terms.add(inner);
  }

  // Proper-noun phrases (1-4 capitalized words in a row)
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const phrases = plain.match(/\b[A-Z][a-zA-Z]+(?:\s+(?:[A-Z][a-zA-Z]+|[&']\s*[A-Z][a-zA-Z]+)){0,3}\b/g) || [];
  for (const p of phrases) {
    const clean = p.trim();
    if (clean.length < 4) continue;
    if (stopwords.has(clean)) continue;
    terms.add(clean);
  }

  // Years
  for (const y of plain.match(/\b1[5-9]\d{2}\b/g) || []) terms.add(y);

  return [...terms].slice(0, 80);
}

async function generateNotes(sourceContent) {
  const terms = extractTerms(sourceContent);
  const checklist = terms.length
    ? `\n\nMANDATORY TERMS — your output MUST contain a separate <strong>Term:</strong> entry for EVERY item in this list. Do not merge them. Do not mention them inside other entries. Each one gets its own paragraph.\n\n${terms.map((t) => `- ${t}`).join('\n')}\n\nIf any item is missing from your output, the response is wrong. Count them and verify.`
    : '';

  if (process.env.GROQ_API_KEY) {
    try {
      const content = await callAI({
        systemPrompt: NOTES_SYSTEM_PROMPT + checklist,
        userPrompt: sourceContent.slice(0, 24000),
        jsonMode: true,
      });
      const parsed = JSON.parse(content);
      if (parsed.html) return { title: parsed.title || 'AI notes', html: parsed.html, source: 'ai' };
    } catch (e) {
      console.warn('Groq notes generation failed, falling back:', e.message);
    }
  }
  const plain = sourceContent.replace(/<[^>]+>/g, ' ');
  return { ...heuristicNotes(plain), source: 'heuristic' };
}

/* ---------- Flashcards ---------- */

function heuristicCards(text, max = 12) {
  const cards = [];
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  for (const line of text.replace(/<[^>]+>/g, '\n').split(/\n+/)) {
    const m = line.match(/^\s*([^:\-–]{2,60})\s*[:\-–]\s*(.{5,})$/);
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


router.post('/flashcards', validate(z.object({ text: z.string().trim().min(20, 'Paste at least a few sentences'), max: z.coerce.number().int().min(1).max(30).default(12) })), wrap(async (req, res) => {
  const { text, max } = req.body;
  let cards = [];
  let source = 'heuristic';

  if (process.env.GROQ_API_KEY) {
    try {
      const content = await callAI({
        systemPrompt: `You are a study assistant. Summarize the student's notes into up to ${max} high-quality flashcards. Respond ONLY with JSON: {"cards":[{"front":"question","back":"concise answer"}]}. Questions should test understanding, not trivia. Keep answers under 40 words.`,
        userPrompt: text.slice(0, 12000),
        jsonMode: true,
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
  res.json({ cards, source });
}));

/* ---------- Notes (pasted text — may be HTML) ---------- */

router.post('/notes', validate(z.object({ text: z.string().trim().min(50, 'Paste at least a paragraph of source text') })), wrap(async (req, res) => {
  const normalized = normalizeHtml(req.body.text);
  res.json(await generateNotes(normalized));
}));

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
