import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import PDFParser from 'pdf2json';
import * as officeparserModule from 'officeparser';
import { z } from 'zod';
import { requireAuth, validate, wrap } from '../middleware/auth.js';
import { prisma } from '../db.js';

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
    temperature: 0.35,
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

async function callAIVision({ systemPrompt, base64, mimeType, maxTokens = 2000 }) {
  const body = {
    model: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    temperature: 0.15,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract every class and its grade from this screenshot.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  };

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
    if (/model_not_found|does not exist|not found/i.test(detail)) {
      throw new Error('Vision model not available. Try setting GROQ_VISION_MODEL to a different model.');
    }
    throw new Error(`Vision API error (${res.status}): ${detail.slice(0, 200)}`);
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

const NOTES_SYSTEM_PROMPT = `You write study notes from source material. Your ONLY job is to capture what the source actually says — nothing more.

ABSOLUTE RULE — no added information:
- Only include facts that appear in the source text.
- Do NOT add context from your own knowledge, even if it's true or historically important.
- Do NOT connect the term to "broader narratives," "later events," or "consequences" unless the source itself makes that connection.
- Do NOT add dates, numbers, names, or causal claims that aren't explicitly in the source.
- If the source doesn't say something, do not say it.

A shorter note that's strictly accurate is better than a longer note that adds outside context. Students get graded on whether they captured the source, not on how much you know.

FORMAT RULES — follow these without exception:
- One <p> block per term. Open with <strong>Term:</strong> then the explanation.
- 1–2 sentences maximum per entry. Never 3.
- Citation markers like [1][2] belong at the end of the sentence they support — inline, never as their own entry.
- Strip any trailing comma, semicolon, or colon from a term name before bolding it.
- Never split a proper noun phrase. "Proclamation of 1763" is one entry, not two.
- Every named person from the source gets their own standalone entry — even if they are also mentioned inside another entry.
- If the source emphasizes something (bold, highlight, repetition), match that emphasis.
- If the source is vague, keep your note vague too. Do not "clean it up" with specific details the source doesn't provide.

SKIP ENTIRELY — do not write entries for:
- Section or chapter headings (CAUSES, TOPIC, PERIOD, UNIT, WARPERIOD, SECTION, CHAPTER, OVERVIEW)
- Transition words (Ultimately, Therefore, However, Additionally, Furthermore, Consequently)
- Standalone ethnic or national adjectives without a specific historical definition
- Generic geographic terms used only as a backdrop — only include these if the source specifically defines them as a historical concept
- Numbered fragments or date fragments that belong inside another entry
- Partial phrases that are obviously broken off a longer term

VOICE:
- Write exactly what the source says, in cleaner language. Not more, not less.
- Never use: "it is important to note", "this shows us that", "one must understand", "in conclusion"
- Do not add interpretive words the source didn't use — for example "economic exploitation," "perceived absolutism," "infringing on property rights," "broader narrative." If those exact concepts aren't in the source, leave them out.

FEW-SHOT EXAMPLES — match this level of strictness:

Source says: "The Stamp Act was the first direct tax on the colonies and applied to printed paper."

GOOD note:
<p><strong>Stamp Act:</strong> The first direct tax on the colonies, applied to printed paper.</p>

BAD note:
<p><strong>Stamp Act:</strong> The first direct tax on the colonies, applied to printed paper, prompting widespread colonial outrage and contributing to the outbreak of the Revolution.</p>
(The second clause adds facts the source didn't provide.)

Source says: "George III was the king. Grenville was his chancellor."

GOOD notes:
<p><strong>King George III:</strong> The British king during this period.</p>
<p><strong>Lord George Grenville:</strong> King George III's chancellor, who pushed the Sugar, Quartering, and Stamp Acts.</p>

BAD note:
<p><strong>King George III:</strong> The British king whose perceived absolutism pushed the colonies toward revolution.</p>
("Perceived absolutism" is not in the source.)

Now process the source below. Write one entry per significant historical term, person, event, document, or policy. Only use facts present in the source. Skip all headings, transition words, standalone adjectives, and generic geographies.`;

const STOPWORDS = new Set([
  'The','This','That','These','Those','They','Their','There','Which','When','Where','What','While','With','From','Into','Upon','After','Before','During','Under','Over','About','Between','Among','Along','Across','Through','Because','Since','Until','Unless','Within','Without','Against',
  'Also','Both','Each','Many','Most','Some','Such','More','However','Therefore','Nevertheless','Additionally','Furthermore','Consequently','Ultimately','Finally','First','Second','Third','Lastly','Importantly','Similarly','Meanwhile','Instead','Rather','Thus','Hence','Overall','Indeed','Even','Just','Only','Another','Other','Others','Next','Then','Now','Here',
  'American','United','States','Government','People','Nation','History','Period','Time','Year','Years','Century','Section','Chapter','Page','Part','Study','Notes','Review','Answer','Question','Topic','Cause','Causes','Effect','Effects','Impact','Impacts','Overview','Summary','Introduction','Conclusion',
  'European','Europe','British','Britain','France','French','Spanish','Spain','Native','Colonial','Colonies','Americas','America','Africa','Asia','Caribbean','Indigenous',
]);

function extractTerms(text) {
  const terms = new Set();

  for (const tag of ['strong', 'em', 'u', 'mark']) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const inner = m[1].replace(/<[^>]+>/g, '').trim().replace(/[,;:]+$/, '');
      if (inner && inner.length > 2 && inner.length < 80) terms.add(inner);
    }
  }

  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const phraseRe = /\b[A-Z][a-zA-Z]+(?:\s+(?:of|the|and|de|van|von|del|la|le|[A-Z][a-zA-Z]+|\d{3,4})){0,4}\b/g;
  const phrases = plain.match(phraseRe) || [];
  for (const p of phrases) {
    const clean = p.trim().replace(/[,;:]+$/, '').replace(/\s+(of|the|and|de|van|von)$/i, '');
    if (clean.length < 4) continue;
    if (STOPWORDS.has(clean)) continue;
    if (/^[A-Z]{3,}$/.test(clean)) continue;
    terms.add(clean);
  }

  return [...terms].slice(0, 28);
}

async function generateNotes(sourceContent) {
  const terms = extractTerms(sourceContent);
  const checklist = terms.length
    ? `\n\nSUGGESTED TERMS — for each item below that is a genuine historical concept, person, event, or policy from the source, write a dedicated entry in the format above. Skip any item that is a heading, transition word, adjective, fragment, or duplicate of another entry. If an item below is not a real term, ignore it.\n\n${terms.map((t) => `- ${t}`).join('\n')}`
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

/* ---------- Chat with your notes ---------- */

const NL = String.fromCharCode(10);

const CHAT_STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','at','for','with','by',
  'is','are','was','were','be','been','being','do','does','did','what','who',
  'whom','whose','which','when','where','why','how','that','this','these',
  'those','it','its','as','from','into','about','can','could','should','would',
  'will','shall','may','might','i','you','he','she','they','we','me','him',
  'her','them','us','my','your','his','their','our','explain','describe','tell',
  'give','list','name','define',
]);

function tokenize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !CHAT_STOPWORDS.has(w));
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, NL)
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, NL)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, NL + NL)
    .trim();
}

function chunksFromHtml(html, setTitle) {
  const src = String(html || '');
  const out = [];
  const re = /<(p|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const text = stripHtml(m[2]).trim();
    if (text.length >= 25) out.push({ text, setTitle });
  }
  if (!out.length) {
    const plain = stripHtml(src);
    for (const para of plain.split(/\n{2,}/)) {
      const t = para.trim();
      if (t.length >= 25) out.push({ text: t, setTitle });
    }
  }
  return out;
}

function rankCards(question, cards) {
  const qTokens = tokenize(question);
  if (!qTokens.length) return [];
  const qSet = new Set(qTokens);
  const qLower = question.toLowerCase();

  const scored = cards.map((card) => {
    const frontTokens = tokenize(card.front);
    const backTokens = tokenize(card.back);
    let score = 0;
    frontTokens.forEach((t) => { if (qSet.has(t)) score += 3; });
    backTokens.forEach((t) => { if (qSet.has(t)) score += 1; });
    if (card.front && qLower.includes(card.front.toLowerCase())) score += 5;
    return { card, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.card);
}

function rankChunks(question, chunks) {
  const qTokens = tokenize(question);
  if (!qTokens.length) return [];
  const qSet = new Set(qTokens);
  const qLower = question.toLowerCase();

  const scored = chunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    let score = 0;
    for (const t of tokens) if (qSet.has(t)) score += 1;
    if (chunk.text.toLowerCase().includes(qLower)) score += 10;
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.chunk);
}

router.post('/chat', validate(z.object({
  message: z.string().trim().min(1),
  setId: z.string().nullable().optional(),
  mode: z.enum(['notes', 'tutor']).default('notes'),
  context: z.string().max(2000).optional(),
})), wrap(async (req, res) => {
  const { message, setId, mode, context } = req.body;

  let sets = [];
  let scopeLabel = 'all of your study sets';

  if (setId) {
    const set = await prisma.studySet.findFirst({
      where: { id: setId, userId: req.user.id },
      include: { cards: true },
    });
    if (!set) return res.status(404).json({ error: 'Set not found' });
    sets = [set];
    scopeLabel = 'the study set "' + set.title + '"';
  } else {
    sets = await prisma.studySet.findMany({
      where: { userId: req.user.id },
      include: { cards: true },
    });
  }

  const allCards = sets.flatMap((s) => s.cards.map((c) => ({ ...c, setTitle: s.title })));
  const allChunks = sets.flatMap((s) => chunksFromHtml(s.content, s.title));

  const topChunks = rankChunks(message, allChunks);
  const topCards = rankCards(message, allCards);

  const passages = [];
  const sources = [];

  for (const c of topChunks) {
    passages.push('(from notes: "' + c.setTitle + '") ' + c.text);
    sources.push({ kind: 'note', setTitle: c.setTitle, text: c.text });
  }
  for (const c of topCards) {
    passages.push('(flashcard: "' + c.setTitle + '") ' + c.front + ' - ' + c.back);
    sources.push({ kind: 'card', setTitle: c.setTitle, text: c.front + ' - ' + c.back });
  }

  if (!passages.length && mode === 'notes') {
    for (const c of allChunks.slice(0, 8)) {
      passages.push('(from notes: "' + c.setTitle + '") ' + c.text);
      sources.push({ kind: 'note', setTitle: c.setTitle, text: c.text });
    }
    for (const c of allCards.slice(0, 4)) {
      passages.push('(flashcard: "' + c.setTitle + '") ' + c.front + ' - ' + c.back);
      sources.push({ kind: 'card', setTitle: c.setTitle, text: c.front + ' - ' + c.back });
    }
  }

  const passageBlock = passages.length ? passages.join(NL) : '(No matching notes found.)';

  const systemPrompt = mode === 'tutor'
    ? 'You are a patient, encouraging study tutor helping a student with their schoolwork.' + NL +
      (context ? 'Context for this session: ' + context + NL : '') + NL +
      'Rules:' + NL +
      '- Help the student understand — explain concepts step by step, work through problems, check their reasoning.' + NL +
      '- The passages below are excerpts from their notes. Use them if relevant, but you may also use your own knowledge to teach.' + NL +
      '- For math or science problems, walk through the reasoning. Ask them to try the next step rather than just giving the answer.' + NL +
      '- For essays or history, help them shape the argument and cite their notes when relevant.' + NL +
      '- Be concise. 2-4 short paragraphs max. Use **bold** for key terms only.' + NL +
      '- Never say "I couldn\'t find that in your notes" — teaching is the goal, not retrieval.'
    : 'You are StudySync\'s study assistant. Answer the user\'s question using ONLY the information in the passages below, drawn from ' + scopeLabel + '.' + NL +
      'Rules:' + NL +
      '- If the user asks a factual question and the passages do not contain the answer, reply exactly: "I couldn\'t find that in your notes."' + NL +
      '- If the user asks a meta-question about their study material ("what should I study", "summarize this set"), recommend specific terms from the passages.' + NL +
      '- Be concise: 1-3 short paragraphs max.' + NL +
      '- Do NOT include bracketed citations like [1] or [2]. Just answer naturally.' + NL +
      '- You may use **bold** to highlight key terms, but only 1-3 per response.' + NL +
      '- Do not invent facts. Do not use outside knowledge.';

  if (!process.env.GROQ_API_KEY) {
    return res.json({
      reply: 'AI is not configured. Add GROQ_API_KEY to your environment.',
      sources: [],
    });
  }

  const userPrompt = passages.length
    ? 'Passages:' + NL + passageBlock + NL + NL + 'Question: ' + message
    : 'Question: ' + message;

  const reply = await callAI({
    systemPrompt,
    userPrompt,
    maxTokens: 1200,
  });

  await prisma.chatMessage.createMany({
    data: [
      { userId: req.user.id, setId: setId || null, role: 'user', content: message },
      { userId: req.user.id, setId: setId || null, role: 'assistant', content: reply },
    ],
  });

  res.json({ reply, sources });
}));

/* ---------- Screenshot grade importer ---------- */

const GRADES_VISION_PROMPT = `You are an OCR assistant reading a screenshot of a student's grade portal (Infinite Campus, PowerSchool, Canvas, Skyward, etc.).

Return ONLY valid JSON:
{
  "classes": [
    { "name": "string (course name, exactly as shown)", "pct": number, "letter": "string or null" }
  ]
}

RULES:
- Extract EVERY course visible in the screenshot, even partially visible rows.
- For each course, "name" is the course title, cleaned up: trim trailing whitespace, remove trailing section numbers or room codes if attached, but do not otherwise change the name.
- If the grade is shown as a percentage like "94.27%" or "94.27", use that number.
- If shown as a fraction like "167/174", compute percent = (167/174)*100 and use that rounded to 1 decimal.
- If only a letter grade is shown, estimate using: A+=98, A=95, A-=92, B+=88, B=85, B-=82, C+=78, C=75, C-=72, D=65, F=55.
- Include the letter grade if visible or inferable from pct.
- Do NOT invent courses that aren't visible.
- Preserve original casing where possible.
- If the same course appears twice (e.g. from two terms), keep only the most recent one.
- Ignore GPA values, term grades, overall averages, and student names. Only actual courses.`;

router.post('/grades/scan', upload.array('files', 10), wrap(async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ error: 'No images uploaded.' });

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI is not configured on the server.' });
  }

  for (const f of files) {
    const mime = String(f.mimetype || '').toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) {
      return res.status(400).json({ error: `"${f.originalname}" is not a supported image (PNG, JPG, WEBP, GIF).` });
    }
    if (f.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: `"${f.originalname}" is too large. Max 5 MB per image.` });
    }
  }

  const seen = new Map();

  const results = await Promise.allSettled(files.map(async (f) => {
    const base64 = f.buffer.toString('base64');
    const mime = String(f.mimetype).toLowerCase();
    const raw = await callAIVision({ systemPrompt: GRADES_VISION_PROMPT, base64, mimeType: mime });
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.classes) ? parsed.classes : [];
  }));

  const errors = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      errors.push(`${files[i].originalname}: ${r.reason?.message || 'scan failed'}`);
      continue;
    }
    for (const c of r.value) {
      const name = String(c.name || '').trim().slice(0, 120);
      const pct = Number(c.pct);
      if (!name || !Number.isFinite(pct) || pct < 0 || pct > 150) continue;
      const key = name.toLowerCase();
      seen.set(key, {
        name,
        pct,
        letter: c.letter ? String(c.letter).trim().slice(0, 3) : null,
      });
    }
  }

  const classes = [...seen.values()];

  if (!classes.length) {
    return res.status(422).json({
      error: "Couldn't find any classes in those screenshots. Try clearer images that show the full grade list.",
      details: errors.length ? errors : undefined,
    });
  }

  res.json({ classes, detected: classes.length, errors: errors.length ? errors : undefined });
}));

/* ---------- Paste-grades-text importer ---------- */

const GRADES_TEXT_PROMPT = `You are an OCR/parser for pasted grade-portal text. The user copied rows from their school portal (Infinite Campus, PowerSchool, Canvas, Skyward, etc.).

Return ONLY valid JSON:
{
  "classes": [
    { "name": "string (course name)", "pct": number, "letter": "string or null" }
  ]
}

RULES:
- Extract every course row.
- "name" is the course title, trimmed. Remove trailing section/room numbers if attached.
- If the grade is a percentage like "94.27%" or "94.27", use that number.
- If shown as a fraction like "167/174", compute (167/174)*100 rounded to 1 decimal.
- If only a letter grade is shown, estimate using: A+=98, A=95, A-=92, B+=88, B=85, B-=82, C+=78, C=75, C-=72, D=65, F=55.
- Ignore GPA, term averages, teacher names, room numbers, and student names. Only actual courses.
- Dedupe: if the same course appears more than once, keep only the last occurrence.
- Do NOT invent classes that aren't in the text.`;

router.post('/grades/parse-text', validate(z.object({
  text: z.string().trim().min(10, 'Paste at least one class line'),
})), wrap(async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI is not configured on the server.' });
  }

  let raw;
  try {
    raw = await callAI({
      systemPrompt: GRADES_TEXT_PROMPT,
      userPrompt: req.body.text.slice(0, 8000),
      jsonMode: true,
      maxTokens: 1500,
    });
  } catch (e) {
    console.error('[grades/parse-text] AI error:', e.message);
    return res.status(502).json({ error: e.message });
  }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return res.status(502).json({ error: 'AI returned invalid JSON.' }); }

  const classes = Array.isArray(parsed.classes)
    ? parsed.classes
        .map((c) => ({
          name: String(c.name || '').trim().slice(0, 120),
          pct: Number(c.pct),
          letter: c.letter ? String(c.letter).trim().slice(0, 3) : null,
        }))
        .filter((c) => c.name && Number.isFinite(c.pct) && c.pct >= 0 && c.pct <= 150)
    : [];

  if (!classes.length) {
    return res.status(422).json({
      error: "Couldn't find any classes in that text. Make sure it includes course names and grades.",
    });
  }

  res.json({ classes, detected: classes.length });
}));
/* ---------- Assignment workspace analysis ---------- */

const WORKSPACE_KINDS = ['math', 'science', 'english', 'history', 'reading', 'exam_prep', 'coding', 'project', 'foreign_language', 'other'];
const WORKSPACE_TOOLS = ['calculator', 'scratchpad', 'notes', 'outline', 'sources', 'flashcards', 'quiz', 'timer'];

const WORKSPACE_PROMPT = `You analyze a student's assignment and recommend the right tools.

Return ONLY valid JSON:
{
  "kind": "math" | "science" | "english" | "history" | "reading" | "exam_prep" | "coding" | "project" | "foreign_language" | "other",
  "summary": "one clear sentence about what this assignment is asking for",
  "firstSteps": ["concrete step 1", "concrete step 2", "concrete step 3"],
  "tools": ["scratchpad" | "calculator" | "outline" | "sources" | "notes" | "flashcards" | "quiz" | "timer"],
  "tips": "one or two sentences of specific advice for this assignment"
}

CLASSIFICATION RULES:
- math → kind "math" (algebra, geometry, calculus, stats)
- science → kind "science" (bio, chem, physics, any lab)
- essays, writing, literary analysis → kind "english"
- historical analysis, DBQ, primary source work → kind "history"
- assigned reading with notes/responses → kind "reading"
- "study for test/quiz/exam" → kind "exam_prep"
- coding, programming → kind "coding"
- long-term, multi-step, creative → kind "project"
- Spanish/French/etc → kind "foreign_language"

TOOL SELECTION (pick 2-4 that actually fit):
- math → calculator, scratchpad, notes
- science → calculator (only if equations), notes, flashcards, quiz
- english/history essays → outline, sources, notes
- reading → notes, flashcards, quiz
- exam prep → flashcards, quiz, notes
- coding → scratchpad, notes
- project → outline, scratchpad, notes, timer
- NEVER include calculator for essays, reading, or foreign language

First steps must be SPECIFIC to the assignment title and class — not generic advice like "read carefully".`;

router.post('/workspace/:assignmentId/analyze', validate(z.object({
  rubric: z.string().max(20000).optional(),
})), wrap(async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI is not configured on the server.' });
  }

  const a = await prisma.assignment.findFirst({
    where: { id: req.params.assignmentId, userId: req.user.id },
    include: { class: true },
  });
  if (!a) return res.status(404).json({ error: 'Assignment not found' });

  const incomingRubric = (req.body.rubric || '').trim();
  const rubric = incomingRubric || a.rubricText || '';

  const context = [
    `Title: ${a.title}`,
    a.class?.name ? `Class: ${a.class.name}` : '',
    a.description ? `Description: ${a.description}` : '',
    rubric ? `Rubric / Directions: ${rubric.slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n');

  let parsed;
  try {
    const raw = await callAI({
      systemPrompt: WORKSPACE_PROMPT,
      userPrompt: context,
      jsonMode: true,
      maxTokens: 900,
    });
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('[workspace/analyze] AI error:', e.message);
    return res.status(502).json({ error: 'AI could not analyze this assignment. Try again or add a rubric.' });
  }

  const tools = Array.isArray(parsed.tools)
    ? parsed.tools.filter((t) => WORKSPACE_TOOLS.includes(t)).slice(0, 5)
    : ['notes'];

  const analysis = {
    kind: WORKSPACE_KINDS.includes(parsed.kind) ? parsed.kind : 'other',
    summary: String(parsed.summary || '').slice(0, 400),
    firstSteps: Array.isArray(parsed.firstSteps)
      ? parsed.firstSteps.slice(0, 5).map((s) => String(s).slice(0, 200))
      : [],
    tools: tools.length ? tools : ['notes'],
    tips: parsed.tips ? String(parsed.tips).slice(0, 400) : '',
  };

  await prisma.assignment.update({
    where: { id: a.id },
    data: {
      aiAnalysis: JSON.stringify(analysis),
      ...(incomingRubric ? { rubricText: incomingRubric } : {}),
    },
  });

  res.json({ analysis });
}));

// Clear the analysis so it can be redone
router.delete('/workspace/:assignmentId/analyze', wrap(async (req, res) => {
  await prisma.assignment.updateMany({
    where: { id: req.params.assignmentId, userId: req.user.id },
    data: { aiAnalysis: null, rubricText: null },
  });
  res.json({ ok: true });
}));
export default router;
