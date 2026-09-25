import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, validate, wrap } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callAI({ systemPrompt, userPrompt, jsonMode = false, maxTokens = 4000 }) {
  const body = {
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    temperature: 0.4,
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

const generateSchema = z.object({
  setId: z.string(),
  count: z.coerce.number().int().min(3).max(20).default(10),
  types: z.array(z.enum(['mcq', 'short'])).min(1).default(['mcq', 'short']),
});

// POST /api/quizzes/generate
router.post('/generate', validate(generateSchema), wrap(async (req, res) => {
  const { setId, count, types } = req.body;

  const set = await prisma.studySet.findFirst({
    where: { id: setId, userId: req.user.id },
    include: { cards: true },
  });
  if (!set) return res.status(404).json({ error: 'Set not found' });
  if (!set.cards?.length) return res.status(400).json({ error: 'Add some cards first' });
  if (!process.env.GROQ_API_KEY) return res.status(400).json({ error: 'AI is not configured' });

  const cardText = set.cards
    .map((c, i) => `${i + 1}. Front: ${c.front}\n   Back: ${c.back}`)
    .join('\n');

  const typeInstruction = types.length === 2
    ? 'Mix multiple-choice and short-answer questions, roughly 50/50.'
    : types[0] === 'mcq'
      ? 'All questions must be multiple-choice.'
      : 'All questions must be short-answer.';

  const systemPrompt = `You write practice quizzes for students based on their flashcards. Return ONLY valid JSON matching this exact shape:
{
  "questions": [
    {
      "type": "mcq" | "short",
      "question": "string",
      "options": ["a","b","c","d"],
      "answer": "string",
      "explanation": "string"
    }
  ]
}
Rules:
- Generate exactly ${count} questions.
- ${typeInstruction}
- For "mcq", provide exactly 4 options and set "answer" to the full text of the correct option.
- For "short", omit "options" and set "answer" to a short model answer (1 sentence).
- Only test knowledge present in the provided cards.
- Do not number the questions inside the "question" field.
- Keep questions clear and test-like.`;

  const userPrompt = `Study set: "${set.title}"\n\nCards:\n${cardText}`;

  const raw = await callAI({ systemPrompt, userPrompt, jsonMode: true, maxTokens: 4000 });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return res.status(502).json({ error: 'AI returned invalid JSON' });
  }
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) {
    return res.status(502).json({ error: 'AI returned no questions' });
  }

  const quiz = await prisma.quiz.create({
    data: { setId, userId: req.user.id, questions: JSON.stringify(parsed.questions) },
  });

  res.json({ quiz: { id: quiz.id, setId, createdAt: quiz.createdAt } });
}));

// GET /api/quizzes/by-set/:setId — attempt history
// NOTE: must be declared before /:id so "by-set" isn't treated as an id
router.get('/by-set/:setId', wrap(async (req, res) => {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: req.user.id, quiz: { setId: req.params.setId } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({
    attempts: attempts.map((a) => ({
      id: a.id, quizId: a.quizId, score: a.score, total: a.total, createdAt: a.createdAt,
    })),
  });
}));

// GET /api/quizzes/:id
router.get('/:id', wrap(async (req, res) => {
  const quiz = await prisma.quiz.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  res.json({
    quiz: {
      id: quiz.id,
      setId: quiz.setId,
      createdAt: quiz.createdAt,
      questions: JSON.parse(quiz.questions),
    },
  });
}));

// POST /api/quizzes/:id/submit
const submitSchema = z.object({
  answers: z.array(z.object({
    type: z.enum(['mcq', 'short']),
    userAnswer: z.string().default(''),
  })).min(1),
});

router.post('/:id/submit', validate(submitSchema), wrap(async (req, res) => {
  const quiz = await prisma.quiz.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const questions = JSON.parse(quiz.questions);
  const submitted = req.body.answers;

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  let score = 0;
  const graded = questions.map((q, i) => {
    const userAnswer = submitted[i]?.userAnswer ?? '';
    let correct = false;

    if (q.type === 'mcq') {
      correct = norm(userAnswer) === norm(q.answer);
    } else {
      const expected = norm(q.answer);
      const given = norm(userAnswer);
      if (!given) correct = false;
      else if (given === expected) correct = true;
      else {
        const expWords = new Set(expected.split(' ').filter((w) => w.length > 3));
        if (!expWords.size) correct = false;
        else {
          const givenWords = new Set(given.split(' '));
          let hits = 0;
          expWords.forEach((w) => givenWords.has(w) && hits++);
          correct = hits / expWords.size >= 0.6;
        }
      }
    }
    if (correct) score++;
    return { ...q, userAnswer, correct };
  });

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: req.user.id,
      score,
      total: questions.length,
      answers: JSON.stringify(graded),
    },
  });

  res.json({
    attempt: { id: attempt.id, score, total: questions.length, createdAt: attempt.createdAt, graded },
  });
}));

export default router;
