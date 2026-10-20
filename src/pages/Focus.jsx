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
import StreakCard from '@/components/StreakCard.jsx';
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
  useEffect(() => {
    if (music.enabled && !music.playing) music.play();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(NOTES_KEY, notes);
      setSavedAt(new Date());
    }, 600);
    return () => clearTimeout(t);
  }, [notes]);

  useEffect(() => {
    if (timer.toast) toast(timer.toast.message);
  }, [timer.toast?.id]);

  // Unlock Recess when a full focus round finishes
  useEffect(() => {
    if (timer.mode === 'focus' && timer.remaining === 0) {
      const already = localStorage.getItem('studysync_games_unlocked') === 'true';
      if (!already) {
        localStorage.setItem('studysync_games_unlocked', 'true');
        window.dispatchEvent(new CustomEvent('studysync:gamesUnlocked'));
      }
    }
  }, [timer.mode, timer.remaining]);

  useEffect(() => {
    const label = timer.mode === 'focus' ? 'Focus' : 'Break';
    document.title = timer.running
      ? `${fmt(timer.remaining)} · ${label} — StudySync`
      : 'StudySync';
    return () => { document.title = 'StudySync'; };
  }, [timer.remaining, timer.running, timer.mode]);

  const progress = ((timer.total - timer.remaining) / timer.total) * 100;
  const ring = 2 * Math.PI * 88;

  const chartData = stats && {
    labels: Object.keys(stats.byDay).map((d) => format(new Date(d + 'T00:00:00'), 'EEE')),
    datasets: [{
      data: Object.values(stats.byDay),
      backgroundColor: '#8b5cf6',
      borderRadius: 6,
    }],
  };

  const isFocus = timer.mode === 'focus';
  const unlocked = localStorage.getItem('studysync_games_unlocked') === 'true';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ... keep your existing timer UI JSX ... */}

      {/* Add this banner just below the timer card */}
      {isFocus && !unlocked && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm text-muted-foreground">
          🔒 Complete the full timer to unlock a cool bonus — the Recess arcade!
        </div>
      )}

      {/* ... keep the rest of your existing JSX ... */}
    </div>
  );
}

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ... keep your SettingsDialog, NumberRow, and clamp functions exactly as they are ... */
