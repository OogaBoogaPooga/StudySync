import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useApp } from '@/lib/store.jsx';

const TOUR_STYLE = `
@keyframes tour-pulse {
  0%   { transform: scale(1);     box-shadow: 0 0 0 0   hsl(var(--primary) / 0.55); }
  45%  { transform: scale(0.96);  box-shadow: 0 0 0 8px hsl(var(--primary) / 0.28); }
  100% { transform: scale(1);     box-shadow: 0 0 0 0   hsl(var(--primary) / 0); }
}
.tour-click-pulse {
  animation: tour-pulse 520ms cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 8px;
}
`;

/**
 * Tour steps.
 *  - route:     static route to navigate to when the step activates (optional)
 *  - navRoute:  if set, the step is a "sidebar click" step: the nav item is
 *               highlighted, Next pulses it, then navigates here
 *  - target:    CSS selector string OR { tag, text } to match by text content.
 *               If null, or if nothing is found, the step is a centered card.
 */
const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to StudySync',
    body: "Let's take a short tour. I'll visit each section and point out the features you might miss. Use ← / → to move, or click Next.",
    route: null,
    target: null,
  },
  {
    id: 'nav-focus',
    title: 'Focus',
    body: 'First, Focus — a Pomodoro timer that keeps running even when you switch pages.',
    target: 'aside nav a[href="/focus"]',
    navRoute: '/focus',
    navLabel: 'Focus',
  },
  {
    id: 'focus-timer',
    title: 'The Pomodoro timer',
    body: 'Start, pause, or reset from here. The gear icon at the top customizes your focus / short break / long break durations. Below the timer, session notes auto-save and attach to your session when the round finishes.',
    route: '/focus',
    target: '[role="timer"]',
  },
  {
    id: 'nav-notes',
    title: 'Notes',
    body: 'Next up: Notes — where AI turns your sources into study material.',
    target: 'aside nav a[href="/notes"]',
    navRoute: '/notes',
    navLabel: 'Notes',
  },
  {
    id: 'notes-actions',
    title: 'Create study sets',
    body: 'Two ways to start: "New set" for a blank one, or "AI notes" to paste text or upload a PDF / DOCX and have AI write the notes for you.',
    route: '/notes',
    target: { tag: 'button', text: 'AI notes' },
  },
  {
    id: 'nav-grades',
    title: 'Grades',
    body: 'Now Grades — where you track your GPA and import your report card.',
    target: 'aside nav a[href="/grades"]',
    navRoute: '/grades',
    navLabel: 'Grades',
  },
  {
    id: 'grades-import',
    title: 'Import your grades',
    body: 'Copy the grade list from your school portal (Infinite Campus, PowerSchool, etc.), click here, and paste. AI parses it into classes with correct percentages, and your GPA updates automatically.',
    route: '/grades',
    target: { tag: 'button', text: 'Import grades' },
  },
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    body: 'Dashboard is your overview page.',
    target: 'aside nav a[href="/"]',
    navRoute: '/',
    navLabel: 'Dashboard',
  },
  {
    id: 'dashboard-main',
    title: 'At a glance',
    body: "Assignments, progress, and everything due soon. Add assignments here and they'll show up on your Calendar.",
    route: '/',
    target: 'main',
  },
  {
    id: 'nav-calendar',
    title: 'Calendar',
    body: 'Calendar shows your assignments by due date.',
    target: 'aside nav a[href="/calendar"]',
    navRoute: '/calendar',
    navLabel: 'Calendar',
  },
  {
    id: 'calendar-main',
    title: 'Plan your week',
    body: 'Every assignment on the day it is due. Click any to edit, mark complete, or see details.',
    route: '/calendar',
    target: 'main',
  },
  {
    id: 'nav-rooms',
    title: 'Study Rooms',
    body: 'Last section: Rooms — real-time collaborative study with friends.',
    target: 'aside nav a[href="/rooms"]',
    navRoute: '/rooms',
    navLabel: 'Rooms',
  },
  {
    id: 'rooms-main',
    title: 'Study together',
    body: 'Create a room, share the code, and you get a shared whiteboard, chat, polls, and synced note editing. Everyone sees changes instantly.',
    route: '/rooms',
    target: 'main',
  },
  {
    id: 'done',
    title: "That's the tour",
    body: "Two things you might miss: the music player pill at the bottom-center of the screen (25 lo-fi tracks), and the 'Ask my notes' AI chat at bottom-right — it answers questions using only YOUR notes. Replay this tour anytime from the help icon in the sidebar.",
    route: null,
    target: null,
  },
];

const TOUR_KEY = 'studysync_tour_done_v1';
const WAIT_TIMEOUT_MS = 5000;
const PAD = 6;
const TOOLTIP_W = 340;
const TOOLTIP_H = 210;

function findTargetEl(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    const els = document.querySelectorAll(target);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }
  if (target.tag && target.text) {
    const els = document.querySelectorAll(target.tag);
    for (const el of els) {
      if (el.textContent && el.textContent.includes(target.text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
    }
  }
  return null;
}

function computeTooltipPosition(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 16;
  const margin = 16;

  const fits = {
    below: rect.top + rect.height + gap + TOOLTIP_H <= vh - margin,
    above: rect.top - gap - TOOLTIP_H >= margin,
    right: rect.left + rect.width + gap + TOOLTIP_W <= vw - margin,
    left: rect.left - gap - TOOLTIP_W >= margin,
  };

  // WIDE targets (like <main>) → always go below or above
  // TALL targets (like <aside>) → always go left or right
  // Small targets → try below, right, above, left
  let side;
  if (rect.width > vw * 0.65) {
    side = fits.below ? 'below' : fits.above ? 'above' : 'below';
  } else if (rect.height > vh * 0.5) {
    side = fits.right ? 'right' : fits.left ? 'left' : 'below';
  } else {
    side = fits.below ? 'below'
         : fits.right ? 'right'
         : fits.above ? 'above'
         : fits.left ? 'left'
         : 'below';
  }

  let left, top;
  switch (side) {
    case 'below':
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case 'above':
      top = rect.top - gap - TOOLTIP_H;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case 'right':
      left = rect.left + rect.width + gap;
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      break;
    case 'left':
    default:
      left = rect.left - gap - TOOLTIP_W;
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      break;
  }

  left = Math.max(margin, Math.min(left, vw - TOOLTIP_W - margin));
  top = Math.max(margin, Math.min(top, vh - TOOLTIP_H - margin));
  return { left, top };
}

export default function Tour() {
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const pulseLock = useRef(false);

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

  // Restart via global event
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener('studysync:startTour', onStart);
    return () => window.removeEventListener('studysync:startTour', onStart);
  }, [start]);

  // If the step has a static route and we're not there yet, navigate
  useEffect(() => {
    if (!step || !step.route) return;
    if (location.pathname === step.route) return;
    navigate(step.route);
  }, [step, navigate, location.pathname]);

  // Reset measurement state on step change
  useEffect(() => {
    setRect(null);
    setWaiting(!!(step && step.target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Poll for the target element
  useLayoutEffect(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      setWaiting(false);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();
    let intervalId;

    const measure = () => {
      if (cancelled) return;
      const el = findTargetEl(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({
          top: r.top - PAD,
          left: r.left - PAD,
          width: r.width + PAD * 2,
          height: r.height + PAD * 2,
        });
        setWaiting(false);
        clearInterval(intervalId);
        return;
      }
      if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
        setWaiting(false);
        clearInterval(intervalId);
      }
    };

    measure();
    intervalId = setInterval(measure, 150);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  // Navigation between steps
  const goNext = useCallback(() => {
    if (!step) return;
    if (step.navRoute) {
      // Sidebar-click simulation: pulse the nav item, then navigate + advance
      if (pulseLock.current) return;
      pulseLock.current = true;
      const el = findTargetEl(step.target);
      if (el) {
        el.classList.add('tour-click-pulse');
        setTimeout(() => el.classList.remove('tour-click-pulse'), 520);
      }
      setTimeout(() => {
        navigate(step.navRoute);
        setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
        pulseLock.current = false;
      }, 300);
    } else {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [step, navigate]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Keep a live ref for the keydown handler
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  const closeRef = useRef(close);
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;
  closeRef.current = close;

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'ArrowRight') goNextRef.current();
      if (e.key === 'ArrowLeft') goPrevRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  if (!active) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      <style>{TOUR_STYLE}</style>

      {waiting && !rect && <LoadingCard step={step} onClose={close} />}

      {!waiting && rect && (
        <>
          <div
            className="fixed z-[80] rounded-lg transition-all duration-200"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
              outline: '2px solid hsl(var(--primary))',
              outlineOffset: 0,
            }}
            onClick={close}
            aria-hidden="true"
          />
          <Tooltip
            rect={rect}
            step={step}
            isFirst={isFirst}
            isLast={isLast}
            index={stepIndex}
            total={STEPS.length}
            onPrev={goPrev}
            onNext={goNext}
            onClose={close}
          />
        </>
      )}

      {!waiting && !rect && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/62" onClick={close} />
          <CenteredCard
            step={step}
            isFirst={isFirst}
            isLast={isLast}
            index={stepIndex}
            total={STEPS.length}
            onPrev={goPrev}
            onNext={goNext}
            onClose={close}
          />
        </>
      )}
    </>
  );
}

function LoadingCard({ step, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/62" />
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

function Tooltip({ rect, step, isFirst, isLast, index, total, onPrev, onNext, onClose }) {
  const { left, top } = computeTooltipPosition(rect);
  const isNavStep = !!step.navRoute;

  return (
    <div
      className="fixed z-[90] rounded-xl border bg-card p-4 shadow-2xl"
      style={{ top, left, width: TOOLTIP_W }}
      role="dialog"
      aria-label={step.title}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </span>
        <p className="text-sm font-semibold">{step.title}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">
            Skip tour
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
          ) : isNavStep ? (
            <Button variant="gradient" size="sm" onClick={onNext}>
              Go to {step.navLabel}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="gradient" size="sm" onClick={onNext} aria-label="Next step">
              Next
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
