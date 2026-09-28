import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Plus, Pencil, Trash2, CalendarPlus, AlertTriangle, CheckCircle2, Bell, ArrowRight, Flame, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { assignmentStatus, googleCalendarUrl, SUBJECT_COLORS } from '@/lib/utils';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Label, Select, Textarea } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';

const STATUS_LABEL = { late: 'Late', soon: 'Due soon', done: 'Done', upcoming: 'Upcoming' };
const toLocalInput = (d) => format(new Date(d), "yyyy-MM-dd'T'HH:mm");

const DAY_MS = 24 * 60 * 60 * 1000;
const POPUP_DISMISS_KEY = 'studysync_heroDismissed';

function scoreAssignment(a) {
  const due = new Date(a.dueDate).getTime();
  const daysOut = (due - Date.now()) / DAY_MS;
  const progress = (a.progress || 0) / 100;
  const weight = Number(a.weight) || 1;

  const urgency =
    daysOut < 0 ? 3 :
    daysOut < 1 ? 2.5 :
    daysOut < 2 ? 2 :
    daysOut < 7 ? 1.5 :
    1;

  return weight * urgency * (1 - progress) * 10;
}

export default function Dashboard() {
  const { toast, user } = useApp();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [classDialog, setClassDialog] = useState(false);
  const [heroPopupOpen, setHeroPopupOpen] = useState(false);

  const load = async () => {
    try {
      const [a, c] = await Promise.all([api('/assignments'), api('/classes')]);
      setAssignments(a); setClasses(c);
    } catch (e) { toast(e.message, 'error'); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    for (const a of assignments) {
      if (assignmentStatus(a) === 'soon' && !sessionStorage.getItem(`notified:${a.id}`)) {
        new Notification('StudySync — due soon', { body: `${a.title} is due ${formatDistanceToNow(new Date(a.dueDate), { addSuffix: true })}` });
        sessionStorage.setItem(`notified:${a.id}`, '1');
      }
    }
  }, [assignments]);

  const stats = useMemo(() => ({
    late: assignments.filter((a) => assignmentStatus(a) === 'late').length,
    soon: assignments.filter((a) => assignmentStatus(a) === 'soon').length,
    done: assignments.filter((a) => a.completed).length,
    total: assignments.length,
  }), [assignments]);

  const nextUp = useMemo(() => {
    const open = assignments.filter((a) => !a.completed);
    if (!open.length) return null;
    return open.slice().sort((a, b) => scoreAssignment(b) - scoreAssignment(a))[0];
  }, [assignments]);

  // Show the popup once per session, and only if we have something to show
  useEffect(() => {
    if (!nextUp) return;
    const dismissed = sessionStorage.getItem(POPUP_DISMISS_KEY) === '1';
    if (dismissed) return;
    const t = setTimeout(() => setHeroPopupOpen(true), 350);
    return () => clearTimeout(t);
  }, [nextUp?.id]);

  const dismissHeroPopup = () => {
    setHeroPopupOpen(false);
    try { sessionStorage.setItem(POPUP_DISMISS_KEY, '1'); } catch {}
  };

  const startFromPopup = () => {
    dismissHeroPopup();
    if (nextUp) navigate(`/work/${nextUp.id}`);
  };

  const visible = assignments.filter((a) => filter === 'all' ? true : filter === 'open' ? !a.completed : assignmentStatus(a) === filter);

  const updateProgress = async (a, progress) => {
    setAssignments((list) => list.map((x) => (x.id === a.id ? { ...x, progress, completed: progress === 100 } : x)));
    try { await api(`/assignments/${a.id}`, { method: 'PUT', body: { progress, completed: progress === 100 } }); }
    catch (e) { toast(e.message, 'error'); load(); }
  };

  const remove = async (a) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    try { await api(`/assignments/${a.id}`, { method: 'DELETE' }); setAssignments((l) => l.filter((x) => x.id !== a.id)); toast('Assignment deleted'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const askNotifications = () => Notification.requestPermission().then((p) => toast(p === 'granted' ? 'Deadline reminders enabled' : 'Notifications blocked'));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="text-muted-foreground text-sm">{stats.late ? `${stats.late} late · ` : ''}{stats.soon} due in 24h · {stats.done}/{stats.total} complete</p>
        </div>
        <div className="flex gap-2">
          {'Notification' in window && Notification.permission === 'default' && (
            <Button variant="outline" size="sm" onClick={askNotifications}><Bell className="h-4 w-4" />Reminders</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setClassDialog(true)}>Manage classes</Button>
          <Button variant="gradient" onClick={() => setEditing({})}><Plus className="h-4 w-4" />New assignment</Button>
        </div>
      </div>

      {nextUp && (
        <HeroCard assignment={nextUp} onStart={() => navigate(`/work/${nextUp.id}`)} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Late" value={stats.late} tone="text-red-500" icon={AlertTriangle} />
        <Stat label="Due in 24h" value={stats.soon} tone="text-amber-500" />
        <Stat label="Completed" value={stats.done} tone="text-emerald-500" icon={CheckCircle2} />
        <Stat label="Overall" value={`${stats.total ? Math.round(assignments.reduce((s, a) => s + a.progress, 0) / stats.total) : 0}%`} tone="text-primary" />
      </div>

      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name} <span className="text-muted-foreground">({c._count?.assignments ?? 0})</span></span>
        ))}
        {!classes.length && <p className="text-sm text-muted-foreground">No classes yet — add one under "Manage classes".</p>}
      </div>

      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter assignments">
        {['all', 'open', 'late', 'soon', 'done'].map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{f === 'soon' ? 'Due soon' : f}</button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((a) => {
          const status = assignmentStatus(a);
          const isNextUp = nextUp && nextUp.id === a.id;
          return (
            <Card key={a.id} className={`relative overflow-hidden ${isNextUp ? 'ring-1 ring-primary/30' : ''}`}>
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: a.class?.color || '#94a3b8' }} aria-hidden />
              <CardHeader className="pl-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className={a.completed ? 'line-through text-muted-foreground' : ''}>{a.title}</CardTitle>
                    <CardDescription>{a.class?.name || 'No class'} · due {format(new Date(a.dueDate), 'EEE, MMM d · h:mm a')}</CardDescription>
                  </div>
                  <Badge variant={status}>{STATUS_LABEL[status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pl-6 space-y-3">
                {status === 'late' && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Overdue by {formatDistanceToNow(new Date(a.dueDate))}</p>}
                {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                <div className="flex items-center gap-3">
                  <Progress value={a.progress} color={a.class?.color} label={`${a.title} progress`} className="flex-1" />
                  <span className="text-xs font-medium w-9 text-right">{a.progress}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={a.progress} onChange={(e) => updateProgress(a, Number(e.target.value))} aria-label={`Set progress for ${a.title}`} className="w-full accent-indigo-500" />
                <div className="flex flex-wrap gap-1 justify-end">
                  {!a.completed && (
                    <Button variant="gradient" size="sm" onClick={() => navigate(`/work/${a.id}`)} className="mr-auto">
                      <Sparkles className="h-3.5 w-3.5" />Open workspace
                    </Button>
                  )}
                  <a href={googleCalendarUrl(a)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent" title="Add to Google Calendar"><CalendarPlus className="h-3.5 w-3.5" />Calendar</a>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(a)} aria-label={`Delete ${a.title}`} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!visible.length && <p className="text-muted-foreground text-sm col-span-full py-10 text-center">Nothing here. Enjoy the free time.</p>}
      </div>

      {/* Hero popup — fires once per session when there's something urgent */}
      {heroPopupOpen && nextUp && (
        <HeroPopup assignment={nextUp} onStart={startFromPopup} onClose={dismissHeroPopup} />
      )}

      <AssignmentDialog editing={editing} classes={classes} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      <ClassDialog open={classDialog} classes={classes} onClose={() => setClassDialog(false)} onChanged={load} />
    </div>
  );
}

/**
 * Centered modal that pops up on first Dashboard visit each session.
 * Shows the top-priority assignment and gives one clear action.
 */
function HeroPopup({ assignment, onStart, onClose }) {
  const status = assignmentStatus(assignment);
  const due = new Date(assignment.dueDate);
  const daysOut = Math.round((due - Date.now()) / DAY_MS);

  let headline = 'Do this next';
  if (status === 'late') headline = "You're behind on this one";
  else if (status === 'soon') headline = 'Due very soon';
  else if (daysOut <= 3) headline = 'Coming up';

  let dueText;
  if (status === 'late') dueText = `Overdue · ${format(due, 'MMM d')}`;
  else if (daysOut === 0) dueText = 'Due today';
  else if (daysOut === 1) dueText = 'Due tomorrow';
  else dueText = `Due in ${daysOut} days`;

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Next up"
        className="relative z-10 w-full max-w-lg animate-fade-in overflow-hidden rounded-2xl border bg-card shadow-2xl"
      >
        <div className="h-1.5 w-full" style={{ background: assignment.class?.color || 'hsl(var(--primary))' }} />

        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Flame className="h-3 w-3" />{headline}
            </span>
            {assignment.class?.name && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
                <span className="h-2 w-2 rounded-full" style={{ background: assignment.class.color }} />
                {assignment.class.name}
              </span>
            )}
            <span className={`text-[11px] font-medium ${status === 'late' ? 'text-red-500' : status === 'soon' ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {dueText}
            </span>
            {assignment.weight > 1 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                ×{assignment.weight} weight
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold leading-tight sm:text-2xl">{assignment.title}</h2>
            {assignment.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{assignment.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <Button variant="gradient" size="lg" onClick={onStart} className="sm:flex-shrink-0">
              Let's do it <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Opens a workspace with AI help, notes, and the right tools for this assignment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroCard({ assignment, onStart }) {
  const status = assignmentStatus(assignment);
  const due = new Date(assignment.dueDate);
  const daysOut = Math.round((due - Date.now()) / DAY_MS);

  let headline = 'Do this next';
  if (status === 'late') headline = "You're behind on this one";
  else if (status === 'soon') headline = 'Due very soon';
  else if (daysOut <= 3) headline = 'Coming up';

  let dueText;
  if (status === 'late') dueText = `Overdue · ${format(due, 'MMM d')}`;
  else if (daysOut === 0) dueText = 'Due today';
  else if (daysOut === 1) dueText = 'Due tomorrow';
  else dueText = `Due in ${daysOut} days`;

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: assignment.class?.color || 'hsl(var(--primary))' }} aria-hidden />
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6 pl-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Flame className="h-3 w-3" />{headline}
          </span>
          {assignment.class?.name && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
              <span className="h-2 w-2 rounded-full" style={{ background: assignment.class.color }} />
              {assignment.class.name}
            </span>
          )}
          <span className={`text-[11px] font-medium ${status === 'late' ? 'text-red-500' : status === 'soon' ? 'text-amber-500' : 'text-muted-foreground'}`}>
            {dueText}
          </span>
          {assignment.weight > 1 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              ×{assignment.weight} weight
            </span>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold leading-tight sm:text-2xl">{assignment.title}</h2>
          {assignment.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{assignment.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="gradient" size="lg" onClick={onStart}>
            Let's do it <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Opens a workspace with notes, AI help, and the right tools for this assignment
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone, icon: Icon }) {
  return (
    <Card className="bg-gradient-to-br from-card to-accent/40">
      <CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-xs text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${tone}`}>{value}</p></div>
        {Icon && <Icon className={`h-6 w-6 ${tone} opacity-70`} aria-hidden />}
      </CardContent>
    </Card>
  );
}

function AssignmentDialog({ editing, classes, onClose, onSaved }) {
  const { toast } = useApp();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const isNew = editing && !editing.id;

  useEffect(() => {
    if (!editing) return setForm(null);
    setForm({
      title: editing.title || '',
      description: editing.description || '',
      dueDate: editing.dueDate ? toLocalInput(editing.dueDate) : toLocalInput(Date.now() + 86400000),
      classId: editing.classId || '',
      weight: editing.weight ?? 1,
      maxScore: editing.maxScore ?? 100,
      score: editing.score ?? '',
      type: editing.type || '',
    });
  }, [editing]);

  if (!form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = {
      ...form,
      classId: form.classId || null,
      dueDate: new Date(form.dueDate).toISOString(),
      score: form.score === '' ? null : Number(form.score),
      type: form.type || null,
    };
    try {
      await api(isNew ? '/assignments' : `/assignments/${editing.id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? 'Assignment created' : 'Saved'); onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={isNew ? 'New assignment' : 'Edit assignment'} description="Fill in the details. Grade fields are optional.">
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="a-title">Title</Label><Input id="a-title" required maxLength={120} value={form.title} onChange={set('title')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="a-class">Class</Label>
              <Select id="a-class" value={form.classId} onChange={set('classId')}><option value="">None</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
            <div className="space-y-1"><Label htmlFor="a-due">Due</Label><Input id="a-due" type="datetime-local" required value={form.dueDate} onChange={set('dueDate')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="a-type">Type</Label>
              <Select id="a-type" value={form.type} onChange={set('type')}>
                <option value="">Homework</option>
                <option value="homework">Homework</option>
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
                <option value="exam">Exam</option>
                <option value="project">Project</option>
                <option value="reading">Reading</option>
              </Select>
            </div>
            <div className="space-y-1"><Label htmlFor="a-weight">Weight</Label><Input id="a-weight" type="number" min={0.1} step="0.5" value={form.weight} onChange={set('weight')} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="a-desc">Description</Label><Textarea id="a-desc" value={form.description} onChange={set('description')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="a-score">Score</Label><Input id="a-score" type="number" min={0} step="0.5" placeholder="—" value={form.score} onChange={set('score')} /></div>
            <div className="space-y-1"><Label htmlFor="a-max">Out of</Label><Input id="a-max" type="number" min={1} step="0.5" value={form.maxScore} onChange={set('maxScore')} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="gradient" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassDialog({ open, classes, onClose, onChanged }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ name: '', color: SUBJECT_COLORS[0], credits: 3 });

  const add = async (e) => {
    e.preventDefault();
    try { await api('/classes', { method: 'POST', body: form }); setForm({ name: '', color: SUBJECT_COLORS[(classes.length + 1) % SUBJECT_COLORS.length], credits: 3 }); onChanged(); toast('Class added'); }
    catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (c) => {
    if (!confirm(`Delete ${c.name}? Assignments will be kept without a class.`)) return;
    try { await api(`/classes/${c.id}`, { method: 'DELETE' }); onChanged(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Classes" description="Each class gets a color used across the app. Credits are used for GPA weighting.">
        <ul className="space-y-2 mb-4">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-md border p-2 text-sm"><span className="h-4 w-4 rounded-full" style={{ background: c.color }} /><span className="flex-1">{c.name}</span><span className="text-xs text-muted-foreground">{c.credits} cr</span><Button variant="ghost" size="icon" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>
          ))}
        </ul>
        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="c-credits">Credits</Label><Input id="c-credits" type="number" min={0} max={10} step="0.5" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} /></div>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {SUBJECT_COLORS.map((col) => (
              <button type="button" key={col} role="radio" aria-checked={form.color === col} aria-label={col} onClick={() => setForm({ ...form, color: col })} className={`h-7 w-7 rounded-full transition ${form.color === col ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`} style={{ background: col }} />
            ))}
          </div>
          <Button type="submit" variant="gradient" className="w-full"><Plus className="h-4 w-4" />Add class</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
