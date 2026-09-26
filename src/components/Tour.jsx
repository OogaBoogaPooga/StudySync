import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useApp } from '@/lib/store.jsx';

const TOUR_STYLE = `
@keyframes tour-pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0   hsl(var(--primary) / 0.55); }
  45%  { transform: scale(0.96); box-shadow: 0 0 0 10px hsl(var(--primary) / 0.22); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0   hsl(var(--primary) / 0); }
}
@keyframes tour-fade-content {
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: none; }
}
.tour-spotlight {
  transition:
    top 420ms cubic-bezier(0.22, 1, 0.36, 1),
    left 420ms cubic-bezier(0.22, 1, 0.36, 1),
    width 420ms cubic-bezier(0.22, 1, 0.36, 1),
    height 420ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}
.tour-tooltip-anchor {
  transition:
    top 420ms cubic-bezier(0.22, 1, 0.36, 1),
    left 420ms cubic-bezier(0.22, 1, 0.36, 1),
    right 420ms cubic-bezier(0.22, 1, 0.36, 1),
    bottom 420ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}
.tour-tooltip-content { animation: tour-fade-content 320ms cubic-bezier(0.22, 1, 0.36, 1); }
.tour-click-pulse {
  animation: tour-pulse 520ms cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 8px;
}
`;

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to StudySync',
    body: "A short guided tour. I'll walk through the sections and actually open a few features so you can see them in action. Use ← / → or the buttons to move.",
    route: null,
    target: null,
  },
  {
    id: 'focus-nav',
    title: 'Focus',
    body: 'Starting with Focus — a Pomodoro timer that keeps running across pages.',
    target: 'aside nav a[href="/focus"]',
    navRoute: '/focus',
    navLabel: 'Focus',
  },
  {
    id: 'focus-timer',
    title: 'The timer',
    body: 'Start, pause, or reset from here. The gear icon lets you customize focus and break durations.',
    route: '/focus',
    target: '[role="timer"]',
  },
  {
    id: 'focus-start',
    title: 'Start a session',
    body: "Click Next and I'll start the timer for you so you can see it running.",
    route: '/focus',
    target: { tag: 'button', text: 'Start' },
    clickOnNext: { tag: 'button', text: 'Start' },
  },
  {
    id: 'focus-running',
    title: 'Timer is running',
    body: "Notice it counts down. It keeps going even if you switch tabs or leave the page entirely. Next, I'll pause it for you.",
    route: '/focus',
    target: '[role="timer"]',
    clickOnNext: { tag: 'button', text: 'Pause' },
  },
  {
    id: 'notes-nav',
    title: 'Notes',
    body: 'Now Notes — where AI turns your sources into study material.',
    target: 'aside nav a[href="/notes"]',
    navRoute: '/notes',
    navLabel: 'Notes',
  },
  {
    id: 'notes-ai',
    title: 'AI notes',
    body: "Click Next and I'll open this. You can paste text or upload a PDF / DOCX, and AI writes structured notes for you.",
    route: '/notes',
    target: { tag: 'button', text: 'AI notes' },
    clickOnNext: { tag: 'button', text: 'AI notes' },
  },
  {
    id: 'notes-dialog',
    title: 'Upload or paste',
    body: 'Two options: drop a file in the top button, or paste lecture notes in the box. Everything gets converted into concise study notes.',
    route: '/notes',
    target: '[role="dialog"]',
    modal: true,
    closeDialog: true,
  },
  {
    id: 'grades-nav',
    title: 'Grades',
    body: 'Next, Grades — tracking GPA and importing from your school portal.',
    target: 'aside nav a[href="/grades"]',
    navRoute: '/grades',
    navLabel: 'Grades',
  },
  {
    id: 'grades-import',
    title: 'Import grades',
    body: "Click Next and I'll open the import dialog. You copy grades from your portal, paste, and AI parses them.",
    route: '/grades',
    target: { tag: 'button', text: 'Import grades' },
    clickOnNext: { tag: 'button', text: 'Import grades' },
  },
  {
    id: 'grades-dialog',
    title: 'Paste from your portal',
    body: 'Just copy the grade list from Infinite Campus, PowerSchool, or similar, and paste it here. The parser handles it and updates your GPA.',
    route: '/grades',
    target: '[role="dialog"]',
    modal: true,
    closeDialog: true,
  },
  {
    id: 'rooms-nav',
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
    body: "Two things you might miss: the music player pill at bottom-center (25 lo-fi tracks), and 'Ask my notes' at bottom-right — an AI chat grounded only in YOUR study sets. Replay this tour anytime from the help icon.",
    route: null,
    target: null,
  },
];

const TOUR_KEY = 'studysync_tour_done_v1';
const WAIT_TIMEOUT_MS = 5000;
const PAD = 6;
const TOOLTIP_W = 340;
const TOOLTIP_H = 210;
const CORNER_MARGIN = 24;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  return { top, left };
}

export default function Tour() {
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  const [rectReady, setRectReady] = useState(false);
  const [spotlightOpacity, setSpotlightOpacity] = useState(0);
  const [tooltipOpacity, setTooltipOpacity] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  const step = stepIndex >= 0 && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const active = !!step;

  const close = useCallback(() => {
    setStepIndex(-1);
    setRect(null);
    setRectReady(false);
    setSpotlightOpacity(0);
    setTooltipOpacity(0);
    setTransitioning(false);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
  }, []);

  const start = useCallback(() => {
    setRect(null);
    setRectReady(false);
    setSpotlightOpacity(0);
    setTooltipOpacity(0);
    setStepIndex(0);
  }, []);

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

  useEffect(() => {
    const onStart = () => start();
    window.addEventListener('studysync:startTour', onStart);
    return () => window.removeEventListener('studysync:startTour', onStart);
  }, [start]);

  // Step arrival: navigate if needed, wait for target, fade in
  useLayoutEffect(() => {
    if (!step) return;
    let cancelled = false;

    const run = async () => {
      setRectReady(false);

      const needsNav = step.route && locationRef.current !== step.route;

      if (needsNav) {
        setSpotlightOpacity(0);
        setTooltipOpacity(0);
        await sleep(160);
        if (cancelled) return;
        navigate(step.route);
        await sleep(200);
        if (cancelled) return;
      }

      if (step.target) {
        const started = Date.now();
        while (!cancelled && Date.now() - started < WAIT_TIMEOUT_MS) {
          const el = findTargetEl(step.target);
          if (el) {
            const r = el.getBoundingClientRect();
            if (cancelled) return;
            setRect({
              top: r.top - PAD,
              left: r.left - PAD,
              width: r.width + PAD * 2,
              height: r.height + PAD * 2,
            });
            setRectReady(true);
            await sleep(70);
            if (cancelled) return;
            setSpotlightOpacity(1);
            setTooltipOpacity(1);
            return;
          }
          await sleep(90);
        }
        if (!cancelled) {
          setRect(null);
          setRectReady(true);
          setSpotlightOpacity(1);
          setTooltipOpacity(1);
        }
      } else {
        if (cancelled) return;
        setRect(null);
        setRectReady(true);
        await sleep(60);
        if (cancelled) return;
        setSpotlightOpacity(1);
        setTooltipOpacity(1);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuous re-measure
  useEffect(() => {
    if (!step || !rect || !rectReady) return;
    const interval = setInterval(() => {
      const el = findTargetEl(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect((prev) => {
        if (!prev) return prev;
        const next = {
          top: r.top - PAD,
          left: r.left - PAD,
          width: r.width + PAD * 2,
          height: r.height + PAD * 2,
        };
        const changed =
          Math.abs(prev.top - next.top) > 1 ||
          Math.abs(prev.left - next.left) > 1 ||
          Math.abs(prev.width - next.width) > 1 ||
          Math.abs(prev.height - next.height) > 1;
        return changed ? next : prev;
      });
    }, 350);
    return () => clearInterval(interval);
  }, [step, rectReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(async () => {
    if (!step || transitioning) return;
    setTransitioning(true);
    try {
      if (step.navRoute) {
        const el = findTargetEl(step.target);
        if (el) {
          el.classList.add('tour-click-pulse');
          setTimeout(() => el.classList.remove('tour-click-pulse'), 540);
        }
        await sleep(280);
        setSpotlightOpacity(0);
        setTooltipOpacity(0);
        await sleep(140);
        navigate(step.navRoute);
        setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
        return;
      }

      if (step.closeDialog) {
        const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Close"], [role="dialog"] button[aria-label="close"]');
        if (closeBtn) closeBtn.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(220);
      }

      if (step.clickOnNext) {
        const el = findTargetEl(step.clickOnNext);
        if (el) {
          el.classList.add('tour-click-pulse');
          setTimeout(() => el.classList.remove('tour-click-pulse'), 540);
          el.click();
          await sleep(380);
        }
      }

      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    } finally {
      setTransitioning(false);
    }
  }, [step, transitioning, navigate]);

  const goPrev = useCallback(() => {
    if (transitioning) return;
    setStepIndex((i) => Math.max(i - 1, 0));
  }, [transitioning]);

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
  const isModal = !!step.modal;

  // Compute tooltip position. Modal steps use a fixed corner so the tooltip
  // never overlaps the centered dialog.
  let tooltipStyle = null;
  if (rectReady) {
    if (rect && !isModal) {
      const pos = computeTooltipPosition(rect);
      tooltipStyle = { top: pos.top, left: pos.left, width: TOOLTIP_W, transform: 'none' };
    } else if (rect && isModal) {
      // Fixed bottom-right corner
      tooltipStyle = {
        bottom: CORNER_MARGIN,
        right: CORNER_MARGIN,
        width: TOOLTIP_W,
        top: 'auto',
        left: 'auto',
        transform: 'none',
      };
    } else {
      // No rect → centered card
      tooltipStyle = {
        top: '50%',
        left: '50%',
        width: Math.min(TOOLTIP_W + 40, window.innerWidth - 32),
        transform: 'translate(-50%, -50%)',
      };
    }
  }

  return (
    <>
      <style>{TOUR_STYLE}</style>

      {/* Spotlight — hidden for modal steps (dialog is centered, dim would hurt) */}
      {!isModal && (
        <div
          className="tour-spotlight fixed z-[200]"
          style={{
            top: rect && rectReady ? rect.top : window.innerHeight / 2 - 20,
            left: rect && rectReady ? rect.left : window.innerWidth / 2 - 20,
            width: rect && rectReady ? rect.width : 40,
            height: rect && rectReady ? rect.height : 40,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.68)',
            outline: rect && rectReady ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            outlineOffset: 0,
            borderRadius: '8px',
            opacity: spotlightOpacity,
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Modal steps: subtle ring around the dialog, no dim */}
      {isModal && rect && rectReady && (
        <div
          className="tour-spotlight fixed z-[200] pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35), 0 0 0 2px hsl(var(--primary))',
            outline: 'none',
            borderRadius: '12px',
            opacity: spotlightOpacity,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      {rectReady && tooltipStyle && (
        <div
          className="tour-tooltip-anchor fixed z-[210]"
          style={{ ...tooltipStyle, opacity: tooltipOpacity, pointerEvents: tooltipOpacity > 0.5 ? 'auto' : 'none' }}
          role="dialog"
          aria-label={step.title}
        >
          <div key={step.id} className="tour-tooltip-content rounded-xl border bg-card p-4 shadow-2xl">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </span>
              <p className="text-sm font-semibold">{step.title}</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <button onClick={close} className="text-[11px] text-muted-foreground hover:text-foreground">
                  Skip tour
                </button>
                <span className="text-[10px] text-muted-foreground">
                  {stepIndex + 1} / {STEPS.length}
                </span>
              </div>
              <div className="flex gap-1.5">
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={goPrev} disabled={transitioning} aria-label="Previous step">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isLast ? (
                  <Button variant="gradient" size="sm" onClick={close}>Done</Button>
                ) : step.navRoute ? (
                  <Button variant="gradient" size="sm" onClick={goNext} disabled={transitioning}>
                    Go to {step.navLabel}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="gradient" size="sm" onClick={goNext} disabled={transitioning} aria-label="Next step">
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for the first-step centered card */}
      {isFirst && (
        <div
          className="fixed inset-0 z-[205]"
          style={{ pointerEvents: 'auto' }}
          onClick={close}
          aria-hidden="true"
        />
      )}
    </>
  );
}
