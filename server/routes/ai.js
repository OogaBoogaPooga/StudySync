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

const NOTES_SYSTEM_PROMPT = `You are a sharp, well-prepared AP US History student writing concise study notes from source material. Your notes are precise, causally aware, and efficient — built for LEQ and DBQ writing.

FORMAT RULES — follow these without exception:
- One <p> block per term. Open with <strong>Term:</strong> then your explanation.
- 1–2 sentences maximum per entry. Never 3. If a third thought is essential, compress it into a parenthetical inside sentence 2.
- Citation markers like [1][2] belong at the end of the sentence they support — inline, never as their own entry. Never write an entry explaining what a footnote is.
- Strip any trailing comma, semicolon, or colon from a term name before bolding it.
- Never split a proper noun phrase. "Proclamation of 1763" is one entry, not two.
- Every named person from the source gets their own standalone entry — even if they are also mentioned inside another entry. Benjamin Franklin, George Washington, King George III, and Chief Pontiac each get their own <strong>Name:</strong> paragraph describing who they were and what they did. Do not bury a person only inside an event entry.

SKIP ENTIRELY — do not write entries for:
- Section or chapter headings (CAUSES, TOPIC, PERIOD, UNIT, WARPERIOD, SECTION, CHAPTER, OVERVIEW)
- Transition words (Ultimately, Therefore, However, Additionally, Furthermore, Consequently)
- Standalone ethnic or national adjectives without a specific historical definition (European, British, French, Spanish, Native American, Colonial)
- Generic geographic terms used only as a backdrop (Europe, Americas, North America, Africa) — only include these if the source is specifically defining them as a historical concept
- Numbered fragments or date fragments that belong inside another entry (e.g. "1763." alone is not an entry — it belongs inside Treaty of Paris or Proclamation of 1763)
- Partial phrases that are obviously broken off a longer term ("THE SEVEN YEARS", "Seven Years", "Proclamation of")

VOICE:
- Sound like a confident, well-read AP student — precise vocabulary, causal reasoning, no filler
- Never use: "it is important to note", "this shows us that", "one must understand", "in conclusion"
- Name causes, name effects, name the connection to the broader APUSH narrative

FEW-SHOT EXAMPLES — match this style exactly:

<p><strong>Seven Years' War:</strong> A global conflict from 1754–1763 in which Britain and its Native allies defeated France, eliminating French dominance in North America and leaving Britain with massive war debt that drove the taxation policies fueling colonial unrest.</p>

<p><strong>Albany Plan of Union:</strong> Drafted by Benjamin Franklin at the Albany Congress in 1754, it proposed a unified colonial legislature for common defense and taxation — rejected by both colonies and Britain, but it foreshadowed the intercolonial cooperation that made the Revolution possible.</p>

<p><strong>Proclamation of 1763:</strong> King George III's decree banning colonial settlement west of the Appalachians, intended to stabilize relations with Native Americans after Pontiac's Rebellion [1]; colonists resented it as British overreach that denied them the western lands they believed they had earned through the war.</p>

<p><strong>George Washington:</strong> Virginia militia officer who led British colonial forces at the Battle of Fort Necessity (July 3, 1754), his surrender marking the opening engagement of the French & Indian War and an early lesson in the limits of colonial military capability against seasoned European troops.</p>

<p><strong>Pontiac's Rebellion:</strong> A 1763 armed uprising led by Ottawa chief Pontiac in which Native tribes struck British forts and settlements from New York to Virginia, demonstrating the limits of imperial frontier control and directly prompting the Proclamation of 1763.</p>

Now process the source below. Write one entry per significant historical term, person, event, document, or policy. Skip all headings, transition words, standalone adjectives, and generic geographies.`;

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

// Strip HTML tags/entities down to clean plain text
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

// Split a set's HTML content into paragraph-sized chunks.
// Prefers <p>, <h1-6>, <li> boundaries so each AI-generated entry stays whole.
function chunksFromHtml(html, setTitle) {
  const src = String(html || '');
  const out = [];
  const re = /<(p|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const text = stripHtml(m[2]).trim();
    if (text.length >= 25) out.push({ text, setTitle });
  }
  // Fallback: no structured tags — split on blank lines
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

// Same idea as rankCards, but for note paragraphs.
function rankChunks(question, chunks) {
  const qTokens = tokenize(question);
  if (!qTokens.length) return [];
  const qSet = new Set(qTokens);
  const qLower = question.toLowerCase();

  const scored = chunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    let score = 0;
    for (const t of tokens) if (qSet.has(t)) score += 1;
    // Big bonus if the whole question appears verbatim
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
})), wrap(async (req, res) => {
  const { message, setId } = req.body;

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

  // Both: rich-text notes AND flashcards
  const allCards = sets.flatMap((s) => s.cards.map((c) => ({ ...c, setTitle: s.title })));
  const allChunks = sets.flatMap((s) => chunksFromHtml(s.content, s.title));

  if (!allCards.length && !allChunks.length) {
    return res.json({
      reply: "You don't have any notes or cards yet. Add some content to a study set and I'll be able to help.",
      sources: [],
    });
  }

  const topChunks = rankChunks(message, allChunks);
  const topCards = rankCards(message, allCards);

  const passages = [];
  const sources = [];
  let n = 1;

  // Notes first — they're the richer source
  for (const c of topChunks) {
    passages.push('[' + n + '] (from notes: "' + c.setTitle + '") ' + c.text);
    sources.push({ kind: 'note', setTitle: c.setTitle, text: c.text });
    n++;
  }
  for (const c of topCards) {
    passages.push('[' + n + '] (flashcard: "' + c.setTitle + '") ' + c.front + ' - ' + c.back);
    sources.push({ kind: 'card', setTitle: c.setTitle, text: c.front + ' - ' + c.back });
    n++;
  }

  // Nothing matched — fall back to a sampling of the notes
  if (!passages.length) {
    for (const c of allChunks.slice(0, 8)) {
      passages.push('[' + n + '] (from notes: "' + c.setTitle + '") ' + c.text);
      sources.push({ kind: 'note', setTitle: c.setTitle, text: c.text });
      n++;
    }
    for (const c of allCards.slice(0, 4)) {
      passages.push('[' + n + '] (flashcard: "' + c.setTitle + '") ' + c.front + ' - ' + c.back);
      sources.push({ kind: 'card', setTitle: c.setTitle, text: c.front + ' - ' + c.back });
      n++;
    }
  }

  const passageBlock = passages.length ? passages.join(NL) : '(No matching content.)';

  const systemPrompt = 'You are StudySync\'s study assistant. Answer the user\'s question using ONLY the information in the passages below, drawn from ' + scopeLabel + '.' + NL +
    'Rules:' + NL +
    '- If the user asks a factual question and the passages do not contain the answer, reply exactly: "I couldn\'t find that in your notes."' + NL +
    '- If the user asks a meta-question about their study material ("what should I study", "summarize this set"), recommend specific terms from the passages.' + NL +
    '- Be concise: 1-3 short paragraphs max.' + NL +
    '- When you use a passage, cite it inline like [1], [2].' + NL +
    '- Do not invent facts. Do not use outside knowledge.';

  if (!process.env.GROQ_API_KEY) {
    return res.json({
      reply: 'AI is not configured. Add GROQ_API_KEY to your environment.',
      sources: [],
    });
  }

  const reply = await callAI({
    systemPrompt,
    userPrompt: 'Passages:' + NL + passageBlock + NL + NL + 'Question: ' + message,
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

router.post('/grades/scan', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  const mime = String(req.file.mimetype || '').toLowerCase();
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) {
    return res.status(400).json({ error: 'Please upload a PNG, JPG, WEBP, or GIF image.' });
  }
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large. Max 5 MB.' });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI is not configured on the server.' });
  }

  const base64 = req.file.buffer.toString('base64');

  let raw;
  try {
    raw = await callAIVision({ systemPrompt: GRADES_VISION_PROMPT, base64, mimeType: mime });
  } catch (e) {
    console.error('[grades/scan] vision error:', e.message);
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
      error: "Couldn't find any classes in that screenshot. Try a clearer image that shows the full grade list.",
    });
  }

  res.json({ classes, detected: classes.length });
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
export default router;
