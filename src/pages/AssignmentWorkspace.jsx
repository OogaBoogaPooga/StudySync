import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, Circle, Sparkles, ArrowRight, RotateCcw, AlertCircle, Check, Lightbulb, Flame } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { useTimer } from '@/lib/timer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AssignmentWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const timer = useTimer();

  const [assignment, setAssignment] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState(null);
  const [buildingPlan, setBuildingPlan] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [coaching, setCoaching] = useState(null);
  const [loadingStep, setLoadingStep] = useState(false);
  const [work, setWork] = useState('');
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [rubricInput, setRubricInput] = useState('');
  const [showRubricInput, setShowRubricInput] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api('/assignments'),
      api('/classes'),
      api(`/ai/coach/${id}/plan`).catch(() => ({ plan: null, progress: null })),
    ]).then(([aList, cList, p]) => {
      if (cancelled) return;
      const a = Array.isArray(aList) ? aList.find((x) => x.id === id) : null;
      if (!a) { setError('Assignment not found'); setLoading(false); return; }
      setAssignment(a);
      setClasses(Array.isArray(cList) ? cList : []);
      if (p?.plan) {
        setPlan(p.plan);
        setProgress(p.progress);
        setActiveIndex(p.progress?.currentIndex || 0);
        if (p.progress?.work) setWork(p.progress.work[String(p.progress.currentIndex || 0)] || '');
      }
      setLoading(false);
    }).catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  const buildPlan = async (withRubric) => {
    setBuildingPlan(true);
    setError('');
    try {
      if (withRubric && rubricInput.trim()) {
        await api(`/assignments/${id}`, { method: 'PUT', body: { rubricText: rubricInput.trim() } });
      }
      const res = await api(`/ai/coach/${id}/plan`, { method: 'POST', body: { regenerate: true } });
      setPlan(res.plan);
      setProgress({ currentIndex: 0, work: {}, completed: [] });
      setActiveIndex(0);
      setWork('');
    } catch (e) { setError(e.message); }
    finally { setBuildingPlan(false); }
  };

  useEffect(() => {
    if (!plan || !plan.steps?.length) return;
    let cancelled = false;
    setLoadingStep(true);
    setCoaching(null);
    setFeedback(null);
    setWork(progress?.work?.[String(activeIndex)] || '');
    api(`/ai/coach/${id}/step/${activeIndex}`, { method: 'POST', body: {} })
      .then((d) => { if (!cancelled) setCoaching(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingStep(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, plan?.goal, id]);

  const submitWork = async () => {
    if (!work.trim()) return;
    setChecking(true);
    try {
      const res = await api(`/ai/coach/${id}/step/${activeIndex}`, { method: 'POST', body: { work: work.trim() } });
      setFeedback(res);
      setProgress(res.progress);
      setAssignment((a) => a ? { ...a, progress: res.assignmentProgress ?? a.progress, completed: res.progress?.completed?.length === plan.steps.length ? true : a.completed } : a);
    } catch (e) { toast(e.message, 'error'); }
    finally { setChecking(false); }
  };

  const resetAll = async () => {
    if (!confirm('Restart the plan? Your work on all steps will be cleared.')) return;
    try {
      await api(`/ai/coach/${id}/reset`, { method: 'POST' });
      setProgress({ currentIndex: 0, work: {}, completed: [] });
      setActiveIndex(0);
      setWork('');
      toast('Plan restarted');
    } catch (e) { toast(e.message, 'error'); }
  };

  const startFocus = () => {
    if (timer.running) { navigate('/focus'); return; }
    timer.selectMode('focus');
    timer.start();
    toast('Focus session started');
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (error || !assignment) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"><p className="font-medium text-destructive">{error || 'Assignment not found'}</p></div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
      </div>
    );
  }

  const cls = assignment.classId ? classes.find((c) => c.id === assignment.classId) : null;
  const due = new Date(assignment.dueDate);
  const daysOut = Math.round((due - Date.now()) / DAY_MS);
  const dueText = assignment.completed ? 'Completed'
    : due.getTime() < Date.now() ? `Overdue · ${format(due, 'MMM d')}`
    : daysOut === 0 ? 'Due today'
    : daysOut === 1 ? 'Due tomorrow'
    : `Due ${format(due, 'EEE, MMM d')}`;

  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        <div className="rounded-2xl bg-gradient-to-br from-primary/[0.08] via-card to-card p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {cls && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: cls.color }} />{cls.name}</span>}
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span className={cn('font-medium', !assignment.completed && due.getTime() < Date.now() ? 'text-red-500' : 'text-muted-foreground')}>{dueText}</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">{assignment.title}</h1>
            {assignment.description && <p className="text-sm text-muted-foreground">{assignment.description}</p>}
            <div className="border-t pt-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10"><Sparkles className="h-4 w-4 text-primary" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Let's get this done</p>
                  <p className="mt-1 text-sm text-muted-foreground">I'll break this into steps and walk you through each one. No vague advice — specific coaching for this assignment.</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {!showRubricInput ? (
                <button onClick={() => setShowRubricInput(true)} className="w-full rounded-lg border border-dashed p-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/30">
                  + Have a rubric or specific directions? Paste them here for a sharper plan.
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rubric, prompt, or directions</label>
                  <Textarea rows={6} value={rubricInput} onChange={(e) => setRubricInput(e.target.value)} placeholder="Paste the essay prompt, project requirements, worksheet directions…" className="text-sm" />
                  <button onClick={() => { setShowRubricInput(false); setRubricInput(''); }} className="text-xs text-muted-foreground underline hover:text-foreground">Hide</button>
                </div>
              )}
            </div>
            {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2 border-t pt-5">
              <Button onClick={() => buildPlan(!!rubricInput.trim())} disabled={buildingPlan} variant="gradient" size="lg">
                {buildingPlan ? <><Loader2 className="h-4 w-4 animate-spin" />Building your plan…</> : <><Sparkles className="h-4 w-4" />Build my plan</>}
              </Button>
              {rubricInput.trim() && <Button onClick={() => buildPlan(false)} disabled={buildingPlan} variant="ghost" size="lg">Skip rubric</Button>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = plan.steps;
  const completed = new Set(progress?.completed || []);
  const currentStep = steps[activeIndex];
  const totalDone = completed.size;
  const isLast = activeIndex === steps.length - 1;
  const allDone = totalDone === steps.length;
  const stepIsDone = completed.has(activeIndex);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        <div className="flex gap-1">
          {totalDone > 0 && <Button variant="ghost" size="sm" onClick={resetAll} title="Restart plan"><RotateCcw className="h-3.5 w-3.5" /></Button>}
          <Button variant="outline" size="sm" onClick={startFocus}><Flame className="h-3.5 w-3.5" />Focus</Button>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {cls && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: cls.color }} />{cls.name}</span>}
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span className={cn('font-medium', assignment.completed ? 'text-emerald-500' : due.getTime() < Date.now() ? 'text-red-500' : 'text-muted-foreground')}>{dueText}</span>
          {assignment.weight > 1 && <><span className="h-1 w-1 rounded-full bg-muted-foreground/40" /><span className="font-medium text-amber-600 dark:text-amber-400">×{assignment.weight} weight</span></>}
        </div>
        <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight md:text-2xl">{assignment.title}</h1>
        {plan.goal && <p className="mt-1.5 text-sm text-muted-foreground">{plan.goal}</p>}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="shrink-0 lg:w-72">
          <div className="rounded-2xl bg-card p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Your plan</p>
                <p className="mt-0.5 text-sm font-semibold leading-tight">{totalDone} of {steps.length} done</p>
              </div>
            </div>
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(totalDone / steps.length) * 100}%` }} /></div>
            <nav className="space-y-0.5">
              {steps.map((s, i) => {
                const done = completed.has(i);
                const active = i === activeIndex;
                return (
                  <button key={i} onClick={() => setActiveIndex(i)} className={cn('group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', active ? 'bg-primary/10' : 'hover:bg-accent')}>
                    <span className="mt-0.5 shrink-0">
                      {done ? <CheckCircle2 className={cn('h-4 w-4', active ? 'text-primary' : 'text-emerald-500')} /> : <Circle className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground/50')} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] font-medium leading-tight', active ? 'text-primary' : done ? 'text-foreground/60 line-through decoration-muted-foreground/30' : 'text-foreground')}>{s.title}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {loadingStep ? (
            <div className="flex h-96 items-center justify-center rounded-2xl bg-card"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /><p className="mt-3 text-xs text-muted-foreground">Loading this step…</p></div></div>
          ) : coaching ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-card p-6">
                <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>Step {activeIndex + 1} of {steps.length}</span>
                  {stepIsDone && <><span className="h-1 w-1 rounded-full bg-muted-foreground/40" /><span className="text-emerald-500">done</span></>}
                </div>
                <h2 className="text-xl font-bold leading-tight tracking-tight">{currentStep.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{currentStep.task}</p>
                <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="mb-2 flex items-center gap-2"><Lightbulb className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-semibold uppercase tracking-widest text-primary">How to do this</span></div>
                  <div className="prose-editor text-sm leading-relaxed [&_p]:my-1.5 [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: coaching.coaching || '' }} />
                  {coaching.prompts?.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {coaching.prompts.map((p, i) => <li key={i} className="flex gap-2"><span className="text-primary">·</span><span>{p}</span></li>)}
                    </ul>
                  )}
                </div>
                {currentStep.doneWhen && (
                  <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span><span className="font-medium text-foreground">Done when:</span> {currentStep.doneWhen}</span>
                  </p>
                )}
                <div className="mt-6 border-t pt-5">
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your work</label>
                  <Textarea
                    rows={currentStep.workType === 'scratch' ? 10 : 6}
                    value={work}
                    onChange={(e) => { setWork(e.target.value); if (feedback) setFeedback(null); }}
                    placeholder={currentStep.workType === 'scratch' ? 'Show your work here — equations, steps, reasoning…' : 'Write your response for this step…'}
                    className={cn('text-sm', currentStep.workType === 'scratch' && 'font-mono')}
                    disabled={checking}
                  />
                  {!feedback ? (
                    <div className="mt-3 flex justify-end">
                      <Button onClick={submitWork} disabled={checking || work.trim().length < 2} variant="gradient" size="sm">
                        {checking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking…</> : <><Sparkles className="h-3.5 w-3.5" />Check my work</>}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className={cn('rounded-lg p-3.5 text-sm', feedback.status === 'done' ? 'bg-emerald-500/10' : feedback.status === 'needs_work' ? 'bg-amber-500/10' : 'bg-red-500/10')}>
                        <p className={cn('mb-1.5 text-[10px] font-semibold uppercase tracking-widest', feedback.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : feedback.status === 'needs_work' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                          {feedback.status === 'done' ? 'Good — step complete' : feedback.status === 'needs_work' ? 'Almost — fix one thing' : 'Needs a redirect'}
                        </p>
                        <div className="leading-relaxed [&_p]:my-1 [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: feedback.feedback || '' }} />
                      </div>
                      {feedback.status !== 'done' && <button onClick={() => setFeedback(null)} className="text-xs text-muted-foreground underline hover:text-foreground">Edit and try again</button>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0} size="sm"><ArrowLeft className="h-4 w-4" />Previous</Button>
                {isLast ? (
                  <Button variant="gradient" onClick={() => navigate('/')}>{allDone ? 'All done — nice work' : 'Back to Dashboard'} <ArrowRight className="h-4 w-4" /></Button>
                ) : (
                  <Button variant="gradient" onClick={() => setActiveIndex(Math.min(activeIndex + 1, steps.length - 1))}>Next step <ArrowRight className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
