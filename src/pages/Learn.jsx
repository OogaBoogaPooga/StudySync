import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, Circle, ChevronRight, RotateCcw, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils';

export default function Learn() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();

  const [set, setSet] = useState(null);
  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buildingPlan, setBuildingPlan] = useState(false);
  const [error, setError] = useState('');

  const [activeIndex, setActiveIndex] = useState(0);
  const [lesson, setLesson] = useState(null);
  const [loadingLesson, setLoadingLesson] = useState(false);

  const [answer, setAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api(`/sets/${setId}`).catch(() => null),
      api(`/ai/lesson/${setId}/plan`).catch(() => ({ plan: null, progress: null })),
    ]).then(([s, p]) => {
      if (cancelled) return;
      setSet(s);
      if (p?.plan) {
        setPlan(p.plan);
        setProgress(p.progress);
        setActiveIndex(p.progress?.currentIndex || 0);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [setId]);

  const buildPlan = async () => {
    setBuildingPlan(true);
    setError('');
    try {
      const res = await api(`/ai/lesson/${setId}/plan`, { method: 'POST' });
      setPlan(res.plan);
      setProgress({ currentIndex: 0, answers: {}, completed: [] });
      setActiveIndex(0);
    } catch (e) { setError(e.message); }
    finally { setBuildingPlan(false); }
  };

  useEffect(() => {
    if (!plan || !plan.topics?.length) return;
    let cancelled = false;
    setLoadingLesson(true);
    setLesson(null);
    setFeedback(null);
    setAnswer('');
    api(`/ai/lesson/${setId}/topic/${activeIndex}`, { method: 'POST', body: {} })
      .then((data) => { if (!cancelled) setLesson(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingLesson(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, plan?.title, setId]);

  const checkAnswer = async () => {
    if (!answer.trim() || !lesson?.question) return;
    setChecking(true);
    try {
      const res = await api(`/ai/lesson/${setId}/topic/${activeIndex}`, { method: 'POST', body: { answer: answer.trim(), question: lesson.question } });
      setFeedback(res);
      setProgress(res.progress);
    } catch (e) { toast(e.message, 'error'); }
    finally { setChecking(false); }
  };

  const resetLesson = async () => {
    if (!confirm('Restart this lesson?')) return;
    try {
      await api(`/ai/lesson/${setId}/reset`, { method: 'POST' });
      setProgress({ currentIndex: 0, answers: {}, completed: [] });
      setActiveIndex(0);
      toast('Lesson restarted');
    } catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
        <Link to={`/notes/${setId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />{set?.title || 'Back'}
        </Link>
        <div className="rounded-2xl bg-gradient-to-br from-primary/[0.08] via-card to-card p-8">
          <div className="mx-auto max-w-md space-y-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10"><BookOpen className="h-6 w-6 text-primary" /></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Learn this material</h1>
              <p className="mt-2 text-sm text-muted-foreground">I'll break "{set?.title}" into short lessons and walk you through them one at a time.</p>
            </div>
            {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            <Button onClick={buildPlan} disabled={buildingPlan} variant="gradient" size="lg">
              {buildingPlan ? <><Loader2 className="h-4 w-4 animate-spin" />Building…</> : <><Sparkles className="h-4 w-4" />Build lesson plan</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const topics = plan.topics;
  const completed = new Set(progress?.completed || []);
  const totalDone = completed.size;
  const isLast = activeIndex === topics.length - 1;
  const allDone = totalDone === topics.length;

  return (
    <div className="space-y-4">
      <Link to={`/notes/${setId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />{set?.title || 'Back'}
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="shrink-0 lg:w-72">
          <div className="rounded-2xl bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lesson plan</p>
                <h2 className="mt-0.5 text-base font-semibold leading-tight">{plan.title}</h2>
              </div>
              {totalDone > 0 && <button onClick={resetLesson} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" title="Restart"><RotateCcw className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(totalDone / topics.length) * 100}%` }} /></div>
              <span className="text-[10px] tabular-nums text-muted-foreground">{totalDone}/{topics.length}</span>
            </div>
            <nav className="space-y-0.5">
              {topics.map((t, i) => {
                const done = completed.has(i);
                const active = i === activeIndex;
                return (
                  <button key={i} onClick={() => setActiveIndex(i)} className={cn('group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', active ? 'bg-primary/10' : 'hover:bg-accent')}>
                    <span className="mt-0.5 shrink-0">
                      {done ? <CheckCircle2 className={cn('h-4 w-4', active ? 'text-primary' : 'text-emerald-500')} /> : <Circle className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground/50')} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] font-medium leading-tight', active ? 'text-primary' : done ? 'text-foreground/70' : 'text-foreground')}>{t.title}</span>
                      {active && <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{t.summary}</span>}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {loadingLesson ? (
            <div className="flex h-96 items-center justify-center rounded-2xl bg-card"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /><p className="mt-3 text-xs text-muted-foreground">Preparing this topic…</p></div></div>
          ) : lesson ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-card p-6 md:p-8">
                <div className="mb-4 text-[10px] uppercase tracking-widest text-muted-foreground">Topic {activeIndex + 1} of {topics.length}</div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">{lesson.topic?.title}</h1>
                <div className="prose-editor mt-5 text-[15px] leading-relaxed [&_p]:my-3 [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: lesson.explanation || '' }} />
                <div className="mt-8 rounded-xl border border-border/60 bg-background/50 p-5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Check yourself</p>
                  <p className="mb-4 text-[15px] font-medium leading-snug">{lesson.question}</p>
                  {!feedback ? (
                    <>
                      <Textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer in your own words…" className="text-sm" disabled={checking} />
                      <div className="mt-3 flex justify-end">
                        <Button onClick={checkAnswer} disabled={checking || answer.trim().length < 2} variant="gradient" size="sm">
                          {checking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking…</> : 'Check answer'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className={cn('rounded-lg p-3 text-sm', feedback.verdict === 'correct' ? 'bg-emerald-500/10' : feedback.verdict === 'partial' ? 'bg-amber-500/10' : 'bg-red-500/10')}>
                        <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-widest', feedback.verdict === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : feedback.verdict === 'partial' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                          {feedback.verdict === 'correct' ? 'Nice — that\'s right' : feedback.verdict === 'partial' ? 'Close — something\'s missing' : 'Not quite'}
                        </p>
                        <div className="[&_p]:my-1 leading-relaxed [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: feedback.feedback || '' }} />
                      </div>
                      {feedback.verdict !== 'correct' && <button onClick={() => setFeedback(null)} className="text-xs text-muted-foreground underline hover:text-foreground">Try again</button>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0} size="sm"><ArrowLeft className="h-4 w-4" />Previous</Button>
                {isLast ? (
                  <Button variant="gradient" onClick={() => navigate(`/notes/${setId}`)}>{allDone ? 'Finish lesson' : 'Back to set'} <ChevronRight className="h-4 w-4" /></Button>
                ) : (
                  <Button variant="gradient" onClick={() => setActiveIndex(Math.min(activeIndex + 1, topics.length - 1))}>Next topic <ChevronRight className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
