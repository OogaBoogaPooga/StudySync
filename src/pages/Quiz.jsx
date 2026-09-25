import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getQuiz, submitQuiz } from '@/lib/api.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getQuiz(id)
      .then((data) => {
        const q = data.quiz || data;
        setQuiz(q);
        setAnswers(q.questions.map((qq) => ({ type: qq.type, userAnswer: '' })));
      })
      .catch((e) => setError(e.message || 'Failed to load quiz'))
      .finally(() => setLoading(false));
  }, [id]);

  const setAnswer = (i, val) =>
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? { ...a, userAnswer: val } : a)));

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await submitQuiz(id, answers);
      setResult(res.attempt || res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading quiz…</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;
  if (!quiz) return null;

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Score: {result.score} / {result.total}</h1>
        </div>
        {result.graded.map((q, i) => (
          <Card key={i} className={q.correct ? 'border-green-500/40' : 'border-red-500/40'}>
            <CardContent className="pt-4 space-y-2 text-sm">
              <p className="font-medium">{i + 1}. {q.question}</p>
              <p><span className="text-muted-foreground">Your answer: </span>{q.userAnswer || <em>blank</em>}</p>
              {!q.correct && <p><span className="text-muted-foreground">Correct: </span>{q.answer}</p>}
              {q.explanation && <p className="text-xs text-muted-foreground">{q.explanation}</p>}
            </CardContent>
          </Card>
        ))}
        <Button onClick={() => navigate(-1)}>Back to set</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Practice quiz</h1>
      {quiz.questions.map((q, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">{i + 1}. {q.question}</CardTitle>
          </CardHeader>
          <CardContent>
            {q.type === 'mcq' ? (
              <div className="space-y-1">
                {(q.options || []).map((opt, j) => (
                  <label key={j} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${i}`}
                      checked={answers[i]?.userAnswer === opt}
                      onChange={() => setAnswer(i, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[i]?.userAnswer || ''}
                onChange={(e) => setAnswer(i, e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your answer…"
              />
            )}
          </CardContent>
        </Card>
      ))}
      <Button onClick={handleSubmit} disabled={submitting} variant="gradient">
        {submitting ? 'Grading…' : 'Submit'}
      </Button>
    </div>
  );
}
