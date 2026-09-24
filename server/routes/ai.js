import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Offline fallback: turns pasted notes into Q/A pairs using simple heuristics.
 *  - "Term: definition" or "Term - definition" lines become cards directly
 *  - Sentences containing "is/are/means" become "What is X?" cards
 */
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
  // Dedupe by question
  const seen = new Set();
  return cards.filter((c) => !seen.has(c.front) && seen.add(c.front)).slice(0, max);
}

/** Calls an OpenAI-compatible chat endpoint and expects strict JSON back */
async function aiCards(text, max = 12) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a study assistant. Summarize the student's notes into up to ${max} high-quality flashcards. Respond ONLY with JSON: {"cards":[{"front":"question","back":"concise answer"}]}. Questions should test understanding, not trivia. Keep answers under 40 words.`,
        },
        { role: 'user', content: text.slice(0, 12000) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI provider error (${res.status})`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return (parsed.cards || []).filter((c) => c.front && c.back).slice(0, max);
}

router.post('/flashcards', validate(z.object({ text: z.string().trim().min(20, 'Paste at least a few sentences'), max: z.coerce.number().int().min(1).max(30).default(12) })), wrap(async (req, res) => {
  const { text, max } = req.body;
  let cards = [];
  let source = 'heuristic';
  if (process.env.OPENAI_API_KEY) {
    try {
      cards = await aiCards(text, max);
      source = 'ai';
    } catch (e) {
      console.warn('AI generation failed, falling back:', e.message);
    }
  }
  if (!cards.length) cards = heuristicCards(text, max);
  if (!cards.length) return res.status(422).json({ error: 'Could not extract flashcards. Try "Term: definition" lines or fuller sentences.' });
  res.json({ cards, source });
}));

/** Calls OpenAI to turn source material into structured HTML notes */
async function aiNotes(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You turn source material into clean, organized study notes for a student. Respond ONLY with JSON: {"title":"short descriptive title","html":"<h2>Section</h2><p>...</p><ul><li>...</li></ul>"}. Use only these HTML tags: h2, h3, p, ul, ol, li, strong, em. Do not include a top-level h1. Keep it concise — the goal is a study guide, not a full rewrite.`,
        },
        { role: 'user', content: text.slice(0, 12000) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI provider error (${res.status})`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  if (!parsed.html) throw new Error('AI returned no notes');
  return { title: parsed.title || 'AI notes', html: parsed.html };
}

/** Offline fallback when no API key is configured */
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

router.post('/notes', validate(z.object({ text: z.string().trim().min(50, 'Paste at least a paragraph of source text') })), wrap(async (req, res) => {
  const { text } = req.body;
  let result = null;
  let source = 'heuristic';
  if (process.env.OPENAI_API_KEY) {
    try {
      result = await aiNotes(text);
      source = 'ai';
    } catch (e) {
      console.warn('AI notes failed, falling back:', e.message);
    }
  }
  if (!result) result = heuristicNotes(text);
  res.json({ ...result, source });
}));

export default router;
