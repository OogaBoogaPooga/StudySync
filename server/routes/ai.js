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

const NOTES_SYSTEM_PROMPT = `You are creating thorough, professional study notes for a student preparing for an AP-level exam (APUSH, AP Lang, AP Bio, AP World, AP Government, etc.). Your notes must be comprehensive enough to serve as the only study material the student needs.

SOURCE FORMAT:
The source may arrive as plain text OR as HTML with formatting tags. Pay attention to these tags and PRESERVE their meaning in your output:
- <strong> or <b> = bolded in the original (usually a key term, name, or concept)
- <em> or <i> = italicized in the original
- <u> = underlined
- <mark> = highlighted
Any content that was bolded, highlighted, or underlined in the source is important and must appear in <strong> in your output.

Structure requirements:
- Open with a short overview paragraph explaining what the source is about.
- Use <h2> for major sections and <h3> for subsections.
- Use <p> for explanations and <ul>/<ol> for lists of facts, events, terms, or steps.
- Add a "Key Terms" section near the end with <ul>, where each <li> is a term in <strong> followed by a short definition.
- If the source mentions dates, people, treaties, wars, court cases, or laws, include them. Do not omit specifics.
- If the source is a history text, add a "Cause and Effect" section.
- If the source is a rhetorical/nonfiction text, add an "Author's Argument" section and note rhetorical devices used.
- If the source is science, add a "Definitions" section and a "Processes" section.

Rules:
- Do not summarize away detail. Preserve all key facts, names, dates, and numbers from the source.
- Every term that was bolded, highlighted, or underlined in the source must appear in <strong> in your notes.
- Do not invent facts. Only use what is in the source.
- Aim for length proportional to the source. Short sources get short notes; long sources get long notes. Do not truncate.

Respond ONLY with JSON: {"title":"short descriptive title","html":"<h2>Section</h2><p>...</p>"}. Use only these HTML tags: h2, h3, p, ul, ol, li, strong, em, u, mark. Do not include a top-level h1.`;

async function generateNotes(sourceContent) {
  if (process.env.GROQ_API_KEY) {
    try {
      const content = await callAI({
        systemPrompt: NOTES_SYSTEM_PROMPT,
        userPrompt: sourceContent.slice(0, 24000),
        jsonMode: true,
      });
      const parsed = JSON.parse(content);
      if (parsed.html) return { title: parsed.title || 'AI notes', html: parsed.html, source: 'ai' };
    } catch (e) {
      console.warn('Groq notes generation failed, falling back:', e.message);
    }
  }
  // Fallback: strip tags, then run the heuristic
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
