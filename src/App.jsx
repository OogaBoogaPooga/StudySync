import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, ShieldOff, Settings2 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { format } from 'date-fns';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { useMusic } from '@/lib/music.jsx';
import { useTimer } from '@/lib/timer.jsx';
import MusicSidebar from '@/components/MusicSidebar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Textarea } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

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
  const music = useMusic();
  const timer = useTimer();
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES_KEY) || '');
  const [savedAt, setSavedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadHistory = () =>
    Promise.all([api('/sessions'), api('/sessions/stats')])
      .then(([h, s]) => { setHistory(h); setStats(s); })
      .catch(() => {});

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { loadHistory(); }, [timer.round]);

  // Auto-start music on Focus page
  useEffect(() => {
    if (music.enabled && !music.playing) music.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save notes
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(NOTES_KEY, notes);
      setSavedAt(new Date());
    }, 600);
    return () => clearTimeout(t);
  }, [notes]);

  // Surface timer toasts
  useEffect(() => {
    if (timer.toast) toast(timer.toast.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.toast?.id]);

  // Tab title
  useEffect(() => {
    const label = timer.mode === 'focus' ? 'Focus' : 'Break';
    document.title = timer.running ? `${fmt(timer.remaining)} · ${label} — StudySync` : 'StudySync';
    return () => { document.title = 'StudySync'; };
  }, [timer.remaining, timer.running, timer.mode]);

  const progress = ((timer.total - timer.remaining) / timer.total) * 100;
  const ring = 2 * Math.PI * 88;

  const chartData = stats && {
    labels: Object.keys(stats.byDay).map((d) => format(new Date(d + 'T00:00:00'), 'EEE')),
    datasets: [{ data: Object.values(stats.byDay), backgroundColor: '#8b5cf6', borderRadius: 6 }],
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <Card className={`text-center overflow-hidden ${timer.mode === 'focus' ? 'bg-gradient-to-br from-slate-500/10 to-slate-400/10' : 'bg-gradient-to-br from-slate-500/10 to-slate-400/10'}`}>
          <CardContent className="p-8 flex flex-col items-center gap-5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-full bg-muted p-1 text-xs" role="tablist">
                {[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([m, l]) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={timer.mode === m}
                    onClick={() => timer.selectMode(m)}
                    className={`rounded-full px-3 py-1 font-medium ${timer.mode === m ? 'bg-card shadow' : 'text-muted-foreground'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Customize durations"
                title="Customize durations"
                className="rounded-full p-2 hover:bg-muted"
              >
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            <div className="relative h-56 w-56" role="timer" aria-live="off" aria-label={`${fmt(timer.remaining)} remaining`}>
              <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                <circle cx="100" cy="100" r="88" className="stroke-muted" strokeWidth="10" fill="none" />
                <circle cx="100" cy="100" r="88" stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring - (ring * progress) / 100} className="transition-all duration-1000" />
                <defs><linearGradient id="g"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div>
                  <p className="text-5xl font-bold tabular-nums">{fmt(timer.remaining)}</p>
                  <p className="text-xs text-muted-foreground">Round {timer.round}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={timer.reset} aria-label="Reset timer"><RotateCcw className="h-4 w-4" /></Button>
              <Button variant="gradient" size="lg" onClick={timer.toggle} className="w-36">
                {timer.running ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />Start</>}
              </Button>
              <Button variant="outline" size="icon" onClick={timer.skip} aria-label="Skip phase"><SkipForward className="h-4 w-4" /></Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Timer keeps running in the background — switch tabs or pages freely.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session notes</CardTitle>
            <CardDescription>
              Auto-saved locally{savedAt ? ` · saved ${format(savedAt, 'h:mm:ss a')}` : ''}. Attached to your session when the round ends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea rows={5} placeholder="What are you working on? Key takeaways…" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Session notes" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <MusicSidebar />

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldOff className="h-4 w-4 text-primary" />Distraction blockers</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">{DISTRACTION_TIPS.map((t) => <li key={t}>{t}</li>)}</ul></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <CardDescription>{stats ? `${Math.round(stats.totalMin / 60 * 10) / 10}h focused across ${stats.sessionCount} sessions total` : 'Loading…'}</CardDescription>
          </CardHeader>
          <CardContent className="h-40">
            {chartData && <Bar data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 25 } } } }} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {history.slice(0, 15).map((s) => (
              <div key={s.id} className="rounded-md border p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{s.durationMin} min</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(s.startedAt), 'MMM d, h:mm a')}</span>
                </div>
                {s.notes && <p className="text-xs text-muted-foreground line-clamp-2">{s.notes}</p>}
              </div>
            ))}
            {!history.length && <p className="text-sm text-muted-foreground">No sessions yet. Start your first focus round!</p>}
          </CardContent>
        </Card>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} config={timer.config} onSave={timer.updateConfig} />
    </div>
  );
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function SettingsDialog({ open, onClose, config, onSave }) {
  const [focus, setFocus] = useState(config.focus);
  const [short, setShort] = useState(config.short);
  const [long, setLong] = useState(config.long);

  useEffect(() => {
    if (open) {
      setFocus(config.focus);
      setShort(config.short);
      setLong(config.long);
    }
  }, [open, config]);

  const save = () => {
    onSave({
      focus: clamp(Number(focus), 1, 180, 25),
      short: clamp(Number(short), 1, 60, 5),
      long: clamp(Number(long), 1, 120, 15),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Customize durations"
        description="Set how long each phase lasts. Changes apply the next time a phase starts."
      >
        <div className="space-y-4">
          <NumberRow label="Focus" value={focus} setValue={setFocus} min={1} max={180} />
          <NumberRow label="Short break" value={short} setValue={setShort} min={1} max={60} />
          <NumberRow label="Long break" value={long} setValue={setLong} min={1} max={120} />
          <Button onClick={save} variant="gradient" className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberRow({ label, value, setValue, min, max }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 text-right"
          aria-label={`${label} minutes`}
        />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
    </div>
  );
}

function clamp(n, min, max, fallback) {
  if (!Number.isFinite(n) || n < min) return Number.isFinite(n) ? min : fallback;
  if (n > max) return max;
  return Math.round(n);
}
