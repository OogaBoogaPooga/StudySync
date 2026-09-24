import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, ShieldOff } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { format } from 'date-fns';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Textarea } from '@/components/ui/input.jsx';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Pomodoro configuration (minutes). Long break after every 4 focus rounds.
const FOCUS = 25, SHORT = 5, LONG = 15;
const NOTES_KEY = 'studysync_session_notes';

const DISTRACTION_TIPS = [
  'Put your phone in another room or enable Do Not Disturb.',
  'Close every tab that is not for this task.',
  'Use a site blocker (e.g., LeechBlock, Cold Turkey, or built-in Focus modes).',
  'Write intrusive thoughts on a “later list” instead of acting on them.',
  'Tell people nearby you are unavailable for the next 25 minutes.',
];

export default function Focus() {
  const { toast } = useApp();
  const [mode, setMode] = useState('focus'); // focus | short | long
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(FOCUS * 60);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES_KEY) || '');
  const [savedAt, setSavedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const tickRef = useRef(null);

  const total = (mode === 'focus' ? FOCUS : mode === 'short' ? SHORT : LONG) * 60;

  const loadHistory = () => Promise.all([api('/sessions'), api('/sessions/stats')]).then(([h, s]) => { setHistory(h); setStats(s); }).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  // Auto-save notes to localStorage (debounced 600ms)
  useEffect(() => {
    const t = setTimeout(() => { localStorage.setItem(NOTES_KEY, notes); setSavedAt(new Date()); }, 600);
    return () => clearTimeout(t);
  }, [notes]);

  // Timer tick
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  // Handle completion
  useEffect(() => {
    if (secondsLeft > 0) return;
    setRunning(false);
    finishPhase(true);
  }, [secondsLeft]);

  useEffect(() => { document.title = running ? `${fmt(secondsLeft)} · ${mode === 'focus' ? 'Focus' : 'Break'} — StudySync` : 'StudySync'; return () => { document.title = 'StudySync'; }; }, [secondsLeft, running, mode]);

  const finishPhase = async (completed) => {
    const elapsedMin = Math.round((total - secondsLeft) / 60);
    if (mode === 'focus' && elapsedMin >= 1) {
      try { await api('/sessions', { method: 'POST', body: { type: 'focus', durationMin: elapsedMin, notes } }); loadHistory(); }
      catch (e) { toast(e.message, 'error'); }
    }
    if (completed) {
      const msg = mode === 'focus' ? 'Focus round done — take a break!' : 'Break over — back to it!';
      toast(msg);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('StudySync', { body: msg });
      try { new AudioContext().resume(); beep(); } catch {}
    }
    // Advance cycle: focus → short (or long every 4th) → focus
    if (mode === 'focus') {
      const next = round % 4 === 0 ? 'long' : 'short';
      setMode(next); setSecondsLeft((next === 'long' ? LONG : SHORT) * 60);
    } else {
      setMode('focus'); setRound((r) => r + 1); setSecondsLeft(FOCUS * 60);
      if (mode === 'focus') setNotes('');
    }
  };

  const reset = () => { setRunning(false); setSecondsLeft(total); };
  const progress = ((total - secondsLeft) / total) * 100;
  const ring = 2 * Math.PI * 88;

  const chartData = stats && {
    labels: Object.keys(stats.byDay).map((d) => format(new Date(d + 'T00:00:00'), 'EEE')),
    datasets: [{ data: Object.values(stats.byDay), backgroundColor: '#8b5cf6', borderRadius: 6 }],
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <Card className={`text-center overflow-hidden ${mode === 'focus' ? 'bg-gradient-to-br from-slate-500/10 to-slate-400/10' : 'bg-gradient-to-br from-slate-500/10 to-slate-400/10'}`}>
          <CardContent className="p-8 flex flex-col items-center gap-5">
            <div className="flex gap-1 rounded-full bg-muted p-1 text-xs" role="tablist">
              {[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([m, l]) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setRunning(false); setSecondsLeft((m === 'focus' ? FOCUS : m === 'short' ? SHORT : LONG) * 60); }} className={`rounded-full px-3 py-1 font-medium ${mode === m ? 'bg-card shadow' : 'text-muted-foreground'}`}>{l}</button>
              ))}
            </div>

            {/* Circular progress ring */}
            <div className="relative h-56 w-56" role="timer" aria-live="off" aria-label={`${fmt(secondsLeft)} remaining`}>
              <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                <circle cx="100" cy="100" r="88" className="stroke-muted" strokeWidth="10" fill="none" />
                <circle cx="100" cy="100" r="88" stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring - (ring * progress) / 100} className="transition-all duration-1000" />
                <defs><linearGradient id="g"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div><p className="text-5xl font-bold tabular-nums">{fmt(secondsLeft)}</p><p className="text-xs text-muted-foreground">Round {round}</p></div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={reset} aria-label="Reset timer"><RotateCcw className="h-4 w-4" /></Button>
              <Button variant="gradient" size="lg" onClick={() => setRunning(!running)} className="w-36">{running ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />Start</>}</Button>
              <Button variant="outline" size="icon" onClick={() => { setRunning(false); finishPhase(false); }} aria-label="Skip phase"><SkipForward className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Session notes</CardTitle><CardDescription>Auto-saved locally{savedAt ? ` · saved ${format(savedAt, 'h:mm:ss a')}` : ''}. Attached to your session when the round ends.</CardDescription></CardHeader>
          <CardContent><Textarea rows={5} placeholder="What are you working on? Key takeaways…" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Session notes" /></CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldOff className="h-4 w-4 text-primary" />Distraction blockers</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">{DISTRACTION_TIPS.map((t) => <li key={t}>{t}</li>)}</ul></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>This week</CardTitle><CardDescription>{stats ? `${Math.round(stats.totalMin / 60 * 10) / 10}h focused across ${stats.sessionCount} sessions total` : 'Loading…'}</CardDescription></CardHeader>
          <CardContent className="h-40">{chartData && <Bar data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 25 } } } }} />}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {history.slice(0, 15).map((s) => (
              <div key={s.id} className="rounded-md border p-2 text-sm"><div className="flex justify-between"><span className="font-medium">{s.durationMin} min</span><span className="text-xs text-muted-foreground">{format(new Date(s.startedAt), 'MMM d, h:mm a')}</span></div>{s.notes && <p className="text-xs text-muted-foreground line-clamp-2">{s.notes}</p>}</div>
            ))}
            {!history.length && <p className="text-sm text-muted-foreground">No sessions yet. Start your first focus round!</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Short two-tone chime using the Web Audio API (no asset files needed) */
function beep() {
  const ctx = new AudioContext();
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.value = freq; osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.start(t); osc.stop(t + 0.17);
  });
}
