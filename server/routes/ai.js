import { Router } from 'express';
import multer from 'multer';
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

/** Shared helper for calling Groq via its OpenAI-compatible endpoint */
async function callAI({ systemPrompt, userPrompt, jsonMode = false }) {
  const body = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
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

/** Turns arbitrary source text into structured HTML notes */
async function generateNotes(text) {
  if (process.env.GROQ_API_KEY) {
    try {
      const content = await callAI({
        systemPrompt: `You turn source material into clean, organized study notes for a student. Respond ONLY with JSON: {"title":"short descriptive title","html":"<h2>Section</h2><p>...</p><ul><li>...</li></ul>"}. Use only these HTML tags: h2, h3, p, ul, ol, li, strong, em. Do not include a top-level h1. Keep it concise — the goal is a study guide, not a full rewrite.`,
        userPrompt: text.slice(0, 12000),
        jsonMode: true,
      });
      const parsed = JSON.parse(content);
      if (parsed.html) return { title: parsed.title || 'AI notes', html: parsed.html, source: 'ai' };
    } catch (e) {
      console.warn('Groq notes generation failed, falling back:', e.message);
    }
  }
  return { ...heuristicNotes(text), source: 'heuristic' };
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

/* ---------- Notes (pasted text) ---------- */

router.post('/notes', validate(z.object({ text: z.string().trim().min(50, 'Paste at least a paragraph of source text') })), wrap(async (req, res) => {
  res.json(await generateNotes(req.body.text));
}));

/* ---------- Notes (uploaded file) ---------- */

router.post('/notes/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let text = '';
  try {
    text = await parseOfficeAsync(req.file.buffer);
  } catch (e) {
    return res.status(422).json({ error: `Could not read that file (${e.message}). Try .docx, .pptx, .pdf, or .txt.` });
  }

  text = (text || '').trim();
  if (text.length < 50) return res.status(422).json({ error: 'That file has too little text to work with.' });

  res.json(await generateNotes(text));
}));

export default router;
