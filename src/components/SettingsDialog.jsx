import { useEffect, useState } from 'react';
import { Palette, Accessibility, User, ExternalLink, Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const THEMES = [
  {
    id: 'nordic',
    name: 'Nordic',
    tag: 'Dusty blue · sage',
    swatches: ['hsl(207 25% 45%)', 'hsl(110 20% 90%)', 'hsl(228 40% 98%)'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    tag: 'Teal · cyan',
    swatches: ['hsl(195 65% 42%)', 'hsl(180 45% 90%)', 'hsl(195 40% 98%)'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    tag: 'Warm orange · peach',
    swatches: ['hsl(25 80% 50%)', 'hsl(35 70% 92%)', 'hsl(30 40% 98%)'],
  },
  {
    id: 'forest',
    name: 'Forest',
    tag: 'Deep green · moss',
    swatches: ['hsl(145 42% 36%)', 'hsl(100 35% 90%)', 'hsl(130 30% 98%)'],
  },
  {
    id: 'rose',
    name: 'Rose',
    tag: 'Dusty pink · blush',
    swatches: ['hsl(345 55% 50%)', 'hsl(340 65% 94%)', 'hsl(350 40% 98%)'],
  },
  {
    id: 'slate',
    name: 'Slate',
    tag: 'Neutral · cool gray',
    swatches: ['hsl(220 15% 42%)', 'hsl(220 20% 92%)', 'hsl(220 25% 98%)'],
  },
];

const THEME_KEY = 'studysync_theme_v2';
const MOTION_KEY = 'studysync_reduce_motion';

function readTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'nordic'; } catch { return 'nordic'; }
}

function readMotion() {
  try { return localStorage.getItem(MOTION_KEY) === '1'; } catch { return false; }
}

function applyTheme(id) {
  const root = document.documentElement;
  if (id === 'nordic') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
}

function applyMotion(on) {
  document.documentElement.classList.toggle('reduce-motion', !!on);
}

// Apply saved preferences as early as possible (called on module load)
if (typeof document !== 'undefined') {
  applyTheme(readTheme());
  applyMotion(readMotion());
}

export default function SettingsDialog({ open, onClose }) {
  const [theme, setTheme] = useState(readTheme);
  const [reduceMotion, setReduceMotion] = useState(readMotion);

  // Re-apply any time the dialog opens (in case localStorage changed in another tab)
  useEffect(() => {
    if (!open) return;
    const t = readTheme();
    const m = readMotion();
    setTheme(t);
    setReduceMotion(m);
    applyTheme(t);
    applyMotion(m);
  }, [open]);

  const chooseTheme = (id) => {
    setTheme(id);
    applyTheme(id);
    try { localStorage.setItem(THEME_KEY, id); } catch {}
  };

  const toggleMotion = (on) => {
    setReduceMotion(on);
    applyMotion(on);
    try { localStorage.setItem(MOTION_KEY, on ? '1' : '0'); } catch {}
  };

  const reset = () => {
    chooseTheme('nordic');
    toggleMotion(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Settings"
        description="Customize how StudySync looks and behaves."
        className="max-w-2xl"
      >
        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">

          {/* ---------- Appearance ---------- */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <Palette className="h-3.5 w-3.5 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">Theme</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEMES.map((t) => {
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => chooseTheme(t.id)}
                    className={cn(
                      'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/40 hover:bg-accent/40'
                    )}
                  >
                    <div className="flex gap-1.5">
                      {t.swatches.map((c, i) => (
                        <span
                          key={i}
                          className="h-5 w-5 rounded-full ring-1 ring-black/5 dark:ring-white/10"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">{t.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{t.tag}</p>
                    </div>
                    {selected && (
                      <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Light/dark mode is separate — toggle it from the sidebar footer.
            </p>
          </section>

          {/* ---------- Accessibility ---------- */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <Accessibility className="h-3.5 w-3.5 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">Accessibility</h3>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Reduce motion</p>
                <p className="text-[11px] text-muted-foreground">
                  Disable animations and transitions across the site.
                </p>
              </div>
              <Toggle checked={reduceMotion} onChange={toggleMotion} label="Reduce motion" />
            </div>
          </section>

          {/* ---------- Credits ---------- */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <User className="h-3.5 w-3.5 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">Credits</h3>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Built by</p>
              <a
                href="https://about.me/shifyee"
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-foreground hover:text-primary"
              >
                shifyee
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                StudySync is a personal study companion — assignments, focus sessions,
                AI-powered notes, collaborative rooms, and more, all in one place.
              </p>
            </div>
          </section>

          {/* ---------- Reset ---------- */}
          <div className="flex justify-end border-t pt-3">
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tiny inline toggle switch ---------- */

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}
