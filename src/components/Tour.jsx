import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useApp } from '@/lib/store.jsx';

/**
 * Steps. `target` is a CSS selector; if null or not found, the step is
 * rendered as a centered card. Multiple matches: the first VISIBLE one wins
 * (so desktop nav steps still work when the mobile nav is what's on screen).
 */
const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to StudySync',
    body: "A quick tour of what you can do. Take your time — you can replay this any time from the help icon in the sidebar.",
    target: null,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    body: "Your home base: today's assignments, upcoming work, and quick stats.",
    target: 'nav[aria-label="Main"] a[href="/"], nav[aria-label="Main mobile"] a[href="/"]',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    body: 'See every assignment by due date. Add, edit, and mark complete.',
    target: 'nav[aria-label="Main"] a[href="/calendar"], nav[aria-label="Main mobile"] a[href="/calendar"]',
  },
  {
    id: 'focus',
    title: 'Focus',
    body: 'Pomodoro timer that keeps running across pages. Session notes, study music, and your activity streak live here.',
    target: 'nav[aria-label="Main"] a[href="/focus"], nav[aria-label="Main mobile"] a[href="/focus"]',
  },
  {
    id: 'notes',
    title: 'Notes',
    body: 'Rich-text notes that become flashcards and study sets. Upload a PDF or paste text and AI will generate the notes for you.',
    target: 'nav[aria-label="Main"] a[href="/notes"], nav[aria-label="Main mobile"] a[href="/notes"]',
  },
  {
    id: 'grades',
    title: 'Grades',
    body: 'Import grades by pasting from your school portal, track GPA, and run what-if scenarios.',
    target: 'nav[aria-label="Main"] a[href="/grades"], nav[aria-label="Main mobile"] a[href="/grades"]',
  },
  {
    id: 'rooms',
    title: 'Study Rooms',
    body: 'Real-time collaborative rooms — shared whiteboard, chat, polls, and synced note editing.',
    target: 'nav[aria-label="Main"] a[href="/rooms"], nav[aria-label="Main mobile"] a[href="/rooms"]',
  },
  {
    id: 'extras',
    title: 'A few things you might miss',
    body: 'Bottom-center: the study music player (25 lo-fi tracks). Bottom-right: "Ask my notes" — an AI chat grounded only in your own study sets. Sidebar footer: dark mode, high contrast, music toggle, and this help button.',
    target: null,
  },
  {
    id: 'done',
    title: "You're all set",
    body: 'Replay this tour anytime from the help icon in the sidebar footer.',
    target: null,
  },
];

const TOUR_KEY = 'studysync_tour_done_v1';

export default function Tour() {
  const { user } = useApp();
  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState(null);

  const active = stepIndex >= 0 && stepIndex < STEPS.length;
  const step = active ? STEPS[stepIndex] : null;

  const close = useCallback(() => {
    setStepIndex(-1);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
  }, []);

  const start = useCallback(() => {
    setRect(null);
    setStepIndex(0);
  }, []);

  // Auto-start for the demo account on first login
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

  // Manual restart via global event
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener('studysync:startTour', onStart);
    return () => window.removeEventListener('studysync:startTour', onStart);
  }, [start]);

  // Measure the target rect (finds the first visible match)
  useLayoutEffect(() => {
    if (!step) return;
    if (!step.target) { setRect(null); return; }

    const measure = () => {
      const els = document.querySelectorAll(step.target);
      let found = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { found = r; break; }
      }
      if (!found) { setRect(null); return; }
      setRect({ top: found.top, left: found.left, width: found.width, height: found.height });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const interval = setInterval(measure, 300);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      clearInterval(interval);
    };
  }, [step]);

  // Keyboard
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

  return (
    <>
      {rect ? (
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
          <TooltipNearRect rect={rect} step={step} isFirst={isFirst} isLast={isLast} index={stepIndex} total={STEPS.length} onPrev={prev} onNext={next} onClose={close} />
        </>
      ) : (
        <>
          <div className="fixed inset-0 z-[80] bg-black/60" onClick={close} />
          <CenteredCard step={step} isFirst={isFirst} isLast={isLast} index={stepIndex} total={STEPS.length} onPrev={prev} onNext={next} onClose={close} />
        </>
      )}
    </>
  );
}

function TooltipNearRect({ rect, step, isFirst, isLast, index, total, onPrev, onNext, onClose }) {
  const W = 320;
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
      className="fixed z-[90] w-[320px] rounded-xl border bg-card p-4 shadow-2xl"
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
