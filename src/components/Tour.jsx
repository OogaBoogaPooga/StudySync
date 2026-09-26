import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useApp } from '@/lib/store.jsx';

/**
 * Tour steps. Each step:
 *  - route: page to navigate to before showing the step (null = stay put)
 *  - target: CSS selector for the element to spotlight (null = centered card)
 * The tour navigates to `route`, waits up to 4s for `target` to appear, then
 * highlights it. If the target never appears, the step renders as a centered
 * card so the tour can never break on a page whose DOM changed.
 */
const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to StudySync',
    body: "Let's take a 30-second tour. I'll walk you through each section and show you what it does. Use the arrows or ← / → keys to move.",
    route: null,
    target: null,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    body: "Your home base: today's assignments, upcoming work, and quick stats at a glance.",
    route: '/',
    target: 'main h1',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    body: 'Every assignment laid out by due date. Add, edit, and mark things complete right from here.',
    route: '/calendar',
    target: 'main h1',
  },
  {
    id: 'focus',
    title: 'Focus',
    body: 'A Pomodoro timer that keeps running as you switch pages. Study music, session notes, and your activity streak live on this screen too.',
    route: '/focus',
    target: 'main .grid',
  },
  {
    id: 'notes',
    title: 'Notes',
    body: 'Rich-text notes that turn into flashcards, quizzes, and AI study sets. Upload a PDF or paste text and AI writes the notes for you.',
    route: '/notes',
    target: 'main h1',
  },
  {
    id: 'grades',
    title: 'Grades',
    body: 'Paste grades from your school portal and StudySync tracks them. GPA, per-class breakdown, what-if scenarios — all here.',
    route: '/grades',
    target: 'main h1',
  },
  {
    id: 'rooms',
    title: 'Study Rooms',
    body: 'Real-time collaborative study rooms. Shared whiteboard, chat, polls, and synced note editing with anyone who has the room code.',
    route: '/rooms',
    target: 'main h1',
  },
  {
    id: 'done',
    title: "You're all set",
    body: "That's the tour. Two things you might miss: the music player pill at the bottom center, and the 'Ask my notes' AI chat at bottom right. Replay this tour any time from the help icon in the sidebar.",
    route: null,
    target: null,
  },
];

const TOUR_KEY = 'studysync_tour_done_v1';
const WAIT_TIMEOUT_MS = 4000;

export default function Tour() {
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const active = stepIndex >= 0 && stepIndex < STEPS.length;
  const step = active ? STEPS[stepIndex] : null;

  const close = useCallback(() => {
    setStepIndex(-1);
    setRect(null);
    setWaiting(false);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
  }, []);

  const start = useCallback(() => {
    setRect(null);
    setWaiting(false);
    setStepIndex(0);
  }, []);

  // Auto-start for the demo account on first login only
  useEffect(() => {
    if (!user) return;
    let seen = false;
    try { seen = localStorage.getItem(TOUR_KEY) === '1'; } catch { seen = true; }
    if (seen) return;
    const isDemo = String(user.email || '').toLowerCase() === 'demo@studysync.app';
    if (!isDemo) return;
    const t = setTimeout(() => setStepIndex(0), 900);
    return () => clearTimeout(t);
  }, [user]);

  // Restart via global event (from the help icon)
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener('studysync:startTour', onStart);
    return () => window.removeEventListener('studysync:startTour', onStart);
  }, [start]);

  // Navigate when the step changes
  useEffect(() => {
    if (!step || !step.route) return;
    if (location.pathname === step.route) return;
    navigate(step.route);
  }, [step, navigate, location.pathname]);

  // Reset rect/waiting whenever the step changes so we don't paint stale highlights
  useEffect(() => {
    setRect(null);
    setWaiting(!!(step && step.target));
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for the target element. Gives up after WAIT_TIMEOUT_MS; the step
  // then falls back to a centered card.
  useLayoutEffect(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      setWaiting(false);
      return;
    }

    let cancelled = false;
    const startTime = Date.now();
    let intervalId;

    const measure = () => {
      if (cancelled) return;
      const els = document.querySelectorAll(step.target);
      let found = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { found = r; break; }
      }
      if (found) {
        setRect({ top: found.top, left: found.left, width: found.width, height: found.height });
        setWaiting(false);
        clearInterval(intervalId);
        return;
      }
      if (Date.now() - startTime > WAIT_TIMEOUT_MS) {
        // Give up — the step will render as a centered card
        setWaiting(false);
        clearInterval(intervalId);
      }
    };

    measure();
    intervalId = setInterval(measure, 200);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setStepIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  if (!active) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIndex((i) => Math.max(i - 1, 0));

  const common = {
    step,
    isFirst,
    isLast,
    index: stepIndex,
    total: STEPS.length,
    onPrev: prev,
    onNext: next,
    onClose: close,
  };

  // Waiting for the target to load — show a small "Loading" tooltip
  if (waiting && !rect) {
    return <LoadingCard step={step} onClose={close} />;
  }

  // Spotlight + tooltip
  if (rect) {
    return (
      <>
        <div
          className="fixed z-[80] rounded-lg transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            outline: '2px solid hsl(var(--primary))',
            outlineOffset: 0,
          }}
          onClick={close}
          aria-hidden="true"
        />
        <TooltipNearRect rect={rect} {...common} />
      </>
    );
  }

  // Centered fallback
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60" onClick={close} />
      <CenteredCard {...common} />
    </>
  );
}

function LoadingCard({ step, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60" />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm font-medium">{step.title}…</p>
          <button onClick={onClose} className="ml-2 text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
        </div>
      </div>
    </>
  );
}

function TooltipNearRect({ rect, step, isFirst, isLast, index, total, onPrev, onNext, onClose }) {
  const W = 340;
  const H = 200;
  const gap = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left;
  if (rect.left > vw * 0.6) {
    left = rect.left - W - gap;
  } else if (rect.left + rect.width + gap + W <= vw - 16) {
    left = rect.left + rect.width + gap;
  } else {
    left = Math.max(16, (vw - W) / 2);
  }

  let top;
  if (rect.top > vh * 0.55) {
    top = rect.top - H - gap;
  } else {
    top = rect.top + rect.height / 2 - H / 2;
  }

  left = Math.max(16, Math.min(left, vw - W - 16));
  top = Math.max(16, Math.min(top, vh - H - 16));

  return (
    <div
      className="fixed z-[90] w-[340px] rounded-xl border bg-card p-4 shadow-2xl"
      style={{ top, left }}
      role="dialog"
      aria-label={step.title}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </span>
        <p className="text-sm font-semibold">{step.title}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">
            Skip
          </button>
          <span className="text-[10px] text-muted-foreground">{index + 1} / {total}</span>
        </div>
        <div className="flex gap-1.5">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={onPrev} aria-label="Previous step">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {isLast ? (
            <Button variant="gradient" size="sm" onClick={onClose}>Done</Button>
          ) : (
            <Button variant="gradient" size="sm" onClick={onNext} aria-label="Next step">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredCard({ step, isFirst, isLast, index, total, onPrev, onNext, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </span>
            <p className="text-base font-semibold">{step.title}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Close tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{index + 1} / {total}</span>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={onPrev}>
                <ChevronLeft className="h-3.5 w-3.5" />Back
              </Button>
            )}
            {isLast ? (
              <Button variant="gradient" size="sm" onClick={onClose}>Got it</Button>
            ) : (
              <Button variant="gradient" size="sm" onClick={onNext}>
                {isFirst ? 'Start tour' : 'Next'}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
