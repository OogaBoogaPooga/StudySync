import { useLocation, useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { useTimer } from '@/lib/timer.jsx';
import { cn } from '@/lib/utils';

export default function TimerBadge() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useTimer();

  // Only show on other pages, when a session is running
  if (!t.running) return null;
  if (pathname === '/focus') return null;

  const mins = Math.floor(t.remaining / 60);
  const secs = t.remaining % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const label = t.mode === 'focus' ? 'Focus' : 'Break';

  return (
    <button
      onClick={() => navigate('/focus')}
      className={cn(
        'fixed top-20 right-4 md:top-6 md:right-6 z-40',
        'flex items-center gap-2 rounded-full px-3 py-2',
        'border border-border/70 bg-card/85 backdrop-blur-xl shadow-lg',
        'transition-transform hover:scale-[1.02] active:scale-[0.98]'
      )}
      aria-label={`${display} remaining · tap to open Focus`}
      title="Open Focus"
    >
      <span
        className={cn(
          'grid h-6 w-6 place-items-center rounded-full',
          t.mode === 'focus' ? 'bg-primary/15 text-primary' : 'bg-accent text-accent-foreground'
        )}
      >
        <Timer className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-semibold tabular-nums">{display}</span>
      <span className="hidden sm:inline text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </button>
  );
}
