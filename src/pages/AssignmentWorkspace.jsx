import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Calculator, FileText, StickyNote, Sparkles, Send, CheckCircle2, Loader2,
  Flame, ListChecks, BookMarked, Layers, HelpCircle, Timer as TimerIcon, Plus, Trash2,
  RefreshCw, Upload, Wand2,
} from 'lucide-react';
import { format } from 'date-fns';
import { api, chatWithNotes, generateQuiz } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { useTimer } from '@/lib/timer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Textarea, Input } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils';

const SCRATCH_KEY = (id) => `studysync_scratch_${id}`;
const CHAT_KEY = (id) => `studysync_wsChat_${id}`;
const OUTLINE_KEY = (id) => `studysync_outline_${id}`;
const SOURCES_KEY = (id) => `studysync_sources_${id}`;

const KIND_LABEL = {
  math: 'Math',
  science: 'Science',
  english: 'English',
  history: 'History',
  reading: 'Reading',
  exam_prep: 'Exam prep',
  coding: 'Coding',
  project: 'Project',
  foreign_language: 'Language',
  other: 'Assignment',
};

const TOOL_META = {
  calculator:   { icon: Calculator,    label: 'Calculator' },
  scratchpad:   { icon: StickyNote,    label: 'Scratchpad' },
  outline:      { icon: ListChecks,    label: 'Outline' },
  sources:      { icon: BookMarked,    label: 'Sources' },
  notes:        { icon: FileText,      label: 'Notes' },
  flashcards:   { icon: Layers,        label: 'Flashcards' },
  quiz:         { icon: HelpCircle,    label: 'Quiz' },
  timer:        { icon: TimerIcon,     label: 'Timer' },
};

function renderMarkdown(text) {
  let html = String(text || '');
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, '');
  html = html.replace(/\n/g, '<br>');
  return html;
}

export default function AssignmentWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const timer = useTimer();

  const [assignment, setAssignment] = useState(null);
  const [classes, setClasses] = useState([]);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rubricInput, setRubricInput] = useState('');

  const [activeTool, setActiveTool] = useState(null);
  const [scratch, setScratch] = useState('');
  const [outline, setOutline] = useState({ intro: '', body1: '', body2: '', conclusion: '' });
  const [sources, setSources] = useState([]);
  const [setDetails, setSetDetails] = useState({});
  const [expandedSetId, setExpandedSetId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef(null);

  // Load assignment + related data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api('/assignments'), api('/classes'), api('/sets')])
      .then(([aList, cList, sList]) => {
        if (cancelled) return;
        const a = Array.isArray(aList) ? aList.find((x) => x.id === id) : null;
        if (!a) { setError('Assignment not found'); setLoading(false); return; }
        setAssignment(a);
        setClasses(Array.isArray(cList) ? cList : []);
        setSets(Array.isArray(sList) ? sList : []);

        if (a.aiAnalysis) {
          try {
            const parsed = JSON.parse(a.aiAnalysis);
            setAnalysis(parsed);
            setActiveTool(parsed.tools?.[0] || 'notes');
          } catch {}
        }
        if (a.rubricText) setRubricInput(a.rubricText);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  // Restore local state
  useEffect(() => {
    if (!assignment) return;
    try {
      const s = localStorage.getItem(SCRATCH_KEY(id));
      if (s) setScratch(s);
      const o = localStorage.getItem(OUTLINE_KEY(id));
      if (o) setOutline(JSON.parse(o));
      const src = localStorage.getItem(SOURCES_KEY(id));
      if (src) setSources(JSON.parse(src));
      const c = localStorage.getItem(CHAT_KEY(id));
      if (c) setMessages(JSON.parse(c));
    } catch {}
  }, [assignment, id]);

  useEffect(() => { try { localStorage.setItem(SCRATCH_KEY(id), scratch); } catch {} }, [scratch, id, assignment]);
  useEffect(() => { try { localStorage.setItem(OUTLINE_KEY(id), JSON.stringify(outline)); } catch {} }, [outline, id, assignment]);
  useEffect(() => { try { localStorage.setItem(SOURCES_KEY(id), JSON.stringify(sources)); } catch {} }, [sources, id, assignment]);
  useEffect(() => { try { localStorage.setItem(CHAT_KEY(id), JSON.stringify(messages.slice(-30))); } catch {} }, [messages, id, assignment]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
  }, [messages, busy]);

  const cls = assignment?.classId ? classes.find((c) => c.id === assignment.classId) : null;
  const classSets = useMemo(() => cls ? sets.filter((s) => s.classId === cls.id) : [], [sets, cls]);
  const chatSetId = classSets[0]?.id || null;

  const runAnalysis = async (rubricText) => {
    setAnalyzing(true);
    try {
      const res = await api(`/ai/workspace/${id}/analyze`, {
        method: 'POST',
        body: { rubric: rubricText || '' },
      });
      setAnalysis(res.analysis);
      setActiveTool(res.analysis.tools?.[0] || 'notes');
      toast('Assignment analyzed');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const reanalyze = async () => {
    if (!confirm('Redo the analysis? This clears the current tools.')) return;
    try {
      await api(`/ai/workspace/${id}/analyze`, { method: 'DELETE' });
      setAnalysis(null);
      setActiveTool(null);
    } catch (e) { toast(e.message, 'error'); }
  };

  const markComplete = async () => {
    try {
      await api(`/assignments/${id}`, { method: 'PUT', body: { completed: true, progress: 100 } });
      setAssignment((a) => ({ ...a, completed: true, progress: 100 }));
      toast('Marked complete');
    } catch (e) { toast(e.message, 'error'); }
  };

  const startFocus = () => {
    if (timer.running) { navigate('/focus'); return; }
    timer.selectMode('focus');
    timer.start();
    toast('Focus session started');
  };

  const toggleSet = (s) => {
    if (expandedSetId === s.id) { setExpandedSetId(null); return; }
    setExpandedSetId(s.id);
    if (!setDetails[s.id]) {
      api(`/sets/${s.id}`).then((d) => setSetDetails((p) => ({ ...p, [s.id]: d }))).catch(() => {});
    }
  };

  const takeQuiz = async () => {
    if (!chatSetId) return toast('No study set linked to this class', 'error');
    try {
      const res = await generateQuiz(chatSetId, 8, ['mcq', 'short']);
      navigate(`/quiz/${res.quiz?.id || res.id}`);
    } catch (e) { toast(e.message, 'error'); }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const prefix = assignment
        ? `[Working on "${assignment.title}"${cls ? ` for ${cls.name}` : ''}. ${analysis?.summary || ''}]\n\n`
        : '';
      const res = await chatWithNotes(prefix + text, chatSetId);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const addSource = () => {
    setSources((s) => [...s, { id: Date.now(), title: '', url: '', notes: '' }]);
  };
  const updateSource = (sid, patch) => {
    setSources((s) => s.map((x) => (x.id === sid ? { ...x, ...patch } : x)));
  };
  const removeSource = (sid) => setSources((s) => s.filter((x) => x.id !== sid));

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">{error || 'Assignment not found'}</p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to Dashboard
        </Link>
      </div>
    );
  }

  const due = new Date(assignment.dueDate);
  const dueLabel = assignment.completed ? 'Done'
    : due.getTime() < Date.now() ? `Overdue · ${format(due, 'MMM d')}`
    : `Due ${format(due, 'EEE, MMM d · h:mm a')}`;

  // -------- Onboarding (no analysis yet) --------
  if (!analysis) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Dashboard
        </Link>

        <Card>
          <CardContent className="space-y-4 p-6">
            {cls && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
                <span className="h-2 w-2 rounded-full" style={{ background: cls.color }} />
                {cls.name}
              </span>
            )}
            <h1 className="text-2xl font-bold leading-tight">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground">{dueLabel}</p>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10">
                  <Wand2 className="h-4 w-4 text-primary" />
                </span>
                <div className="text-sm">
                  <p className="font-medium">Let's set this up</p>
                  <p className="mt-1 text-muted-foreground">
                    I'll read the assignment and give you the right tools. Paste your rubric, directions,
                    or any requirements below — or skip and I'll work from the title and class.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rubric, directions, or requirements (optional)
              </label>
              <Textarea
                rows={7}
                value={rubricInput}
                onChange={(e) => setRubricInput(e.target.value)}
                placeholder="Paste anything your teacher gave you — essay prompt, problem set instructions, project rubric, exam topics…"
                className="text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="gradient" onClick={() => runAnalysis(rubricInput)} disabled={analyzing}>
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Sparkles className="h-4 w-4" />Analyze assignment</>}
              </Button>
              <Button variant="outline" onClick={() => runAnalysis('')} disabled={analyzing}>
                Skip · use title only
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- Main workspace --------
  const tools = (analysis.tools || []).filter((t) => TOOL_META[t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Dashboard
        </Link>
        <Button variant="ghost" size="sm" onClick={reanalyze} title="Redo analysis">
          <RefreshCw className="h-3.5 w-3.5" />Redo setup
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {cls && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
                <span className="h-2 w-2 rounded-full" style={{ background: cls.color }} />
                {cls.name}
              </span>
            )}
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              {KIND_LABEL[analysis.kind] || 'Assignment'}
            </span>
            <span className="text-xs text-muted-foreground">{dueLabel}</span>
            {assignment.weight > 1 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                ×{assignment.weight} weight
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold leading-tight">{assignment.title}</h1>
          {analysis.summary && <p className="text-sm text-muted-foreground">{analysis.summary}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={startFocus}>
              <Flame className="h-3.5 w-3.5" />Start focus
            </Button>
            <Button variant="gradient" size="sm" onClick={markComplete} disabled={assignment.completed}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {assignment.completed ? 'Completed' : 'Mark complete'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* First steps + tips */}
      {(analysis.firstSteps?.length > 0 || analysis.tips) && (
        <Card>
          <CardContent className="space-y-3 p-4">
            {analysis.firstSteps?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How to start
                </p>
                <ol className="space-y-1.5 text-sm">
                  {analysis.firstSteps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {analysis.tips && (
              <p className="rounded-md border-l-2 border-primary/40 bg-primary/5 py-2 pl-3 pr-2 text-xs italic text-muted-foreground">
                {analysis.tips}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Two-column: tools + chat */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Tool tabs */}
          <div className="flex flex-wrap gap-1 rounded-lg border bg-card/60 p-1 text-xs">
            {tools.map((t) => {
              const meta = TOOL_META[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTool(t)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition',
                    activeTool === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />{meta.label}
                </button>
              );
            })}
          </div>

          {/* Tool body */}
          <div className="overflow-hidden rounded-xl border bg-card">
            {activeTool === 'calculator' && (
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Desmos graphing calculator</span>
                  <a
                    href="https://www.desmos.com/calculator"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary hover:underline"
                  >
                    Open in new tab
                  </a>
                </div>
                <iframe
                  src="https://www.desmos.com/calculator"
                  title="Desmos"
                  className="block h-[700px] w-full rounded-md border-0 bg-white"
                />
              </div>
            )}

            {activeTool === 'scratchpad' && (
              <Textarea
                value={scratch}
                onChange={(e) => setScratch(e.target.value)}
                placeholder="Work through it here. Autosaves as you type."
                className="min-h-[600px] w-full resize-none rounded-none border-0 bg-transparent p-4 text-sm focus-visible:ring-0"
              />
            )}

            {activeTool === 'outline' && (
              <div className="space-y-3 p-4">
                <p className="text-xs text-muted-foreground">
                  Fill in each section. Autosaves as you type.
                </p>
                {[
                  ['intro', 'Introduction / Thesis'],
                  ['body1', 'Body — first point'],
                  ['body2', 'Body — second point'],
                  ['conclusion', 'Conclusion'],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
                    <Textarea
                      rows={4}
                      value={outline[key]}
                      onChange={(e) => setOutline((o) => ({ ...o, [key]: e.target.value }))}
                      placeholder={`Write your ${label.toLowerCase()} here…`}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTool === 'sources' && (
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Track sources and cite them later.</p>
                  <Button size="sm" variant="outline" onClick={addSource}>
                    <Plus className="h-3.5 w-3.5" />Add source
                  </Button>
                </div>
                {sources.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No sources yet. Add a book, article, or website you're using.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sources.map((s, i) => (
                      <div key={s.id} className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Source {i + 1}</span>
                          <button onClick={() => removeSource(s.id)} className="text-destructive hover:underline">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          placeholder="Title"
                          value={s.title}
                          onChange={(e) => updateSource(s.id, { title: e.target.value })}
                        />
                        <Input
                          placeholder="URL or publication"
                          value={s.url}
                          onChange={(e) => updateSource(s.id, { url: e.target.value })}
                        />
                        <Textarea
                          rows={2}
                          placeholder="Notes, quotes, page numbers…"
                          value={s.notes}
                          onChange={(e) => updateSource(s.id, { notes: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTool === 'notes' && (
              <div className="min-h-[500px] space-y-3 p-4">
                {classSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No study sets linked to {cls?.name || 'this class'}. Create one on the Notes page and link it to this class.
                  </p>
                ) : (
                  classSets.map((s) => {
                    const details = setDetails[s.id];
                    const isOpen = expandedSetId === s.id;
                    return (
                      <div key={s.id} className="rounded-lg border">
                        <button
                          onClick={() => toggleSet(s)}
                          className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-accent"
                        >
                          <span className="text-sm font-semibold">{s.title}</span>
                          <span className="text-[10px] text-muted-foreground">{isOpen ? 'Collapse' : 'Expand'}</span>
                        </button>
                        {isOpen && (
                          <div className="border-t p-3 text-sm [&_p]:my-1 [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:font-semibold">
                            {details ? (
                              <div dangerouslySetInnerHTML={{ __html: details.content || '<p class="text-muted-foreground"><i>Empty</i></p>' }} />
                            ) : (
                              <p className="text-muted-foreground">Loading…</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTool === 'flashcards' && (
              <div className="space-y-3 p-6 text-center">
                {classSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No flashcards for this class yet. Create a study set first.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Review your flashcards for {cls?.name}.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {classSets.map((s) => (
                        <Button key={s.id} variant="gradient" onClick={() => navigate(`/notes/${s.id}`)}>
                          Open "{s.title}"
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTool === 'quiz' && (
              <div className="space-y-3 p-6 text-center">
                {classSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No study sets for this class yet — the quiz pulls from your notes.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Generate a practice quiz from your {cls?.name} notes.
                    </p>
                    <Button variant="gradient" onClick={takeQuiz}>
                      <HelpCircle className="h-4 w-4" />Take a quiz
                    </Button>
                  </>
                )}
              </div>
            )}

            {activeTool === 'timer' && (
              <div className="space-y-4 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {timer.running
                    ? `Focus session running — ${Math.floor(timer.remaining / 60)} minutes left.`
                    : 'Start a 25-minute focus session for this assignment.'}
                </p>
                <Button variant="gradient" onClick={startFocus}>
                  <Flame className="h-4 w-4" />{timer.running ? 'Open Focus page' : 'Start focus session'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* AI chat sidebar */}
        <div className="flex h-[640px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)] lg:w-[360px]">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">AI help</p>
                <p className="text-[10px] text-muted-foreground">
                  {chatSetId ? `Uses your ${cls?.name} notes` : 'Ask anything'}
                </p>
              </div>
            </div>
          </div>

          <div ref={chatEndRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Ask anything about this assignment.
                <ul className="mt-1.5 space-y-1 list-disc pl-4">
                  <li>"How do I start this?"</li>
                  <li>"Explain the concept step by step"</li>
                  <li>"Check my work: [paste]"</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {m.role === 'user' ? (
                  <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div
                    className="max-w-[90%] rounded-2xl rounded-bl-md border bg-background px-3 py-2 text-sm leading-relaxed [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                  />
                )}
              </div>
            ))}
            {busy && <p className="text-xs italic text-muted-foreground">Thinking…</p>}
          </div>

          <div className="border-t p-2">
            <div className="flex items-center gap-2 rounded-full border bg-background pl-3 pr-1 py-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask for help…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={sendMessage}
                disabled={busy || !input.trim()}
                className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
