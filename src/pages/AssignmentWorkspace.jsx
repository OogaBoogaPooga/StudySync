import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calculator, FileText, StickyNote, Sparkles, Send, CheckCircle2, Loader2, Flame } from 'lucide-react';
import { format } from 'date-fns';
import { api, chatWithNotes } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { useTimer } from '@/lib/timer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Textarea } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils';

const SCRATCH_KEY = (id) => `studysync_scratch_${id}`;
const CHAT_KEY = (id) => `studysync_wsChat_${id}`;

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
  const [tab, setTab] = useState('calculator');
  const [scratch, setScratch] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [setDetails, setSetDetails] = useState({});
  const [expandedSetId, setExpandedSetId] = useState(null);
  const chatEndRef = useRef(null);

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
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!assignment) return;
    try {
      const s = localStorage.getItem(SCRATCH_KEY(id));
      if (s) setScratch(s);
      const c = localStorage.getItem(CHAT_KEY(id));
      if (c) setMessages(JSON.parse(c));
    } catch {}
  }, [assignment, id]);

  useEffect(() => {
    if (!assignment) return;
    try { localStorage.setItem(SCRATCH_KEY(id), scratch); } catch {}
  }, [scratch, id, assignment]);

  useEffect(() => {
    if (!assignment) return;
    try { localStorage.setItem(CHAT_KEY(id), JSON.stringify(messages.slice(-30))); } catch {}
  }, [messages, id, assignment]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
  }, [messages, busy]);

  const cls = assignment?.classId ? classes.find((c) => c.id === assignment.classId) : null;

  const classSets = useMemo(() => {
    if (!cls) return [];
    return sets.filter((s) => s.classId === cls.id);
  }, [sets, cls]);

  const chatSetId = classSets[0]?.id || null;

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
      api(`/sets/${s.id}`)
        .then((d) => setSetDetails((prev) => ({ ...prev, [s.id]: d })))
        .catch(() => {});
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const contextPrefix = assignment
        ? `[I'm working on the assignment "${assignment.title}"${cls ? ` for ${cls.name}` : ''}. Description: ${assignment.description || 'none'}]\n\n`
        : '';
      const res = await chatWithNotes(contextPrefix + text, chatSetId);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message || 'Chat failed'}` }]);
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Dashboard
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {cls && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
              <span className="h-2 w-2 rounded-full" style={{ background: cls.color }} />
              {cls.name}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight">{assignment.title}</h1>
            <p className="text-xs text-muted-foreground">{dueLabel}</p>
          </div>
          {assignment.weight > 1 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              ×{assignment.weight} weight
            </span>
          )}
          <Button variant="outline" size="sm" onClick={startFocus}>
            <Flame className="h-3.5 w-3.5" />Focus
          </Button>
          <Button variant="gradient" size="sm" onClick={markComplete} disabled={assignment.completed}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {assignment.completed ? 'Done' : 'Mark complete'}
          </Button>
        </CardContent>
      </Card>

      {assignment.description && (
        <Card>
          <CardContent className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{assignment.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Two-column: workspace + AI chat */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Workspace */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex gap-1 rounded-lg border bg-card/60 p-1 text-xs">
            <button
              onClick={() => setTab('calculator')}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition', tab === 'calculator' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Calculator className="h-3.5 w-3.5" />Calculator
            </button>
            <button
              onClick={() => setTab('scratchpad')}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition', tab === 'scratchpad' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <StickyNote className="h-3.5 w-3.5" />Scratchpad
            </button>
            <button
              onClick={() => setTab('notes')}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition', tab === 'notes' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <FileText className="h-3.5 w-3.5" />Notes
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            {tab === 'calculator' && (
              <iframe
                src="https://www.desmos.com/calculator"
                title="Desmos calculator"
                className="block h-[640px] w-full border-0"
                allow="clipboard-write"
              />
            )}
            {tab === 'scratchpad' && (
              <Textarea
                value={scratch}
                onChange={(e) => setScratch(e.target.value)}
                placeholder="Work through it here. Autosaves locally."
                className="min-h-[640px] w-full resize-none rounded-none border-0 bg-transparent p-4 text-sm focus-visible:ring-0"
              />
            )}
            {tab === 'notes' && (
              <div className="p-4 space-y-3 min-h-[640px]">
                {classSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No study sets linked to {cls?.name || 'this class'} yet. Create one on the Notes page and link it to this class.
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
          </div>
        </div>

        {/* AI chat */}
        <div className="flex h-[640px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:w-[360px] lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">AI help</p>
                <p className="text-[10px] text-muted-foreground">
                  {chatSetId ? `Using your ${cls?.name || 'class'} notes` : 'Ask anything'}
                </p>
              </div>
            </div>
          </div>

          <div ref={chatEndRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Ask anything about this assignment. Try:
                <ul className="mt-1.5 space-y-1 list-disc pl-4">
                  <li>"How do I start this?"</li>
                  <li>"Explain the concept step by step"</li>
                  <li>"Check my work: [paste]"</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={cn(
                  'max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-background'
                )}>
                  {m.content}
                </div>
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
