import { useEffect, useState } from 'react';
import { Palette, Accessibility, User, ExternalLink, Check, LayoutTemplate } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const THEMES = [
  { id: 'nordic', name: 'Nordic', tag: 'Dusty blue · sage', swatches: ['hsl(207 25% 45%)', 'hsl(110 20% 90%)', 'hsl(228 40% 98%)'] },
  { id: 'ocean', name: 'Ocean', tag: 'Teal · cyan', swatches: ['hsl(195 65% 42%)', 'hsl(180 45% 90%)', 'hsl(195 40% 98%)'] },
  { id: 'sunset', name: 'Sunset', tag: 'Warm orange · peach', swatches: ['hsl(25 80% 50%)', 'hsl(35 70% 92%)', 'hsl(30 40% 98%)'] },
  { id: 'forest', name: 'Forest', tag: 'Deep green · moss', swatches: ['hsl(145 42% 36%)', 'hsl(100 35% 90%)', 'hsl(130 30% 98%)'] },
  { id: 'rose', name: 'Rose', tag: 'Dusty pink · blush', swatches: ['hsl(345 55% 50%)', 'hsl(340 65% 94%)', 'hsl(350 40% 98%)'] },
  { id: 'slate', name: 'Slate', tag: 'Neutral · cool gray', swatches: ['hsl(220 15% 42%)', 'hsl(220 20% 92%)', 'hsl(220 25% 98%)'] },
];

const STYLES = [
  {
    id: 'nordic',
    name: 'Nordic',
    tag: 'Serif headings · balanced',
    preview: { radius: '12px', heading: 'Georgia, serif', headingWeight: 700 },
  },
  {
    id: 'studio',
    name: 'Studio',
    tag: 'Sharp · dense · modern',
    preview: { radius: '6px', heading: 'Inter Tight, sans-serif', headingWeight: 700 },
  },
  {
    id: 'paper',
    name: 'Paper',
    tag: 'Rounded · soft · bookish',
    preview: { radius: '20px', heading: 'Georgia, serif', headingWeight: 700 },
  },
];

const THEME_KEY = 'studysync_theme_v2';
const STYLE_KEY = 'studysync_ui_style';
const MOTION_KEY = 'studysync_reduce_motion';

function readTheme() { try { return localStorage.getItem(THEME_KEY) || 'nordic'; } catch { return 'nordic'; } }
function readStyle() { try { return localStorage.getItem(STYLE_KEY) || 'nordic'; } catch { return 'nordic'; } }
function readMotion() { try { return localStorage.getItem(MOTION_KEY) === '1'; } catch { return false; } }

function applyTheme(id) {
  const root = document.documentElement;
  if (id === 'nordic') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
}

function applyStyle(id) {
  const root = document.documentElement;
  if (id === 'nordic') root.removeAttribute('data-style');
  else root.setAttribute('data-style', id);
}

function applyMotion(on) {
  document.documentElement.classList.toggle('reduce-motion', !!on);
}

// Apply all prefs immediately on module load — before React mounts — no flash.
if (typeof document !== 'undefined') {
  applyTheme(readTheme());
  applyStyle(readStyle());
  applyMotion(readMotion());
}

export default function SettingsDialog({ open, onClose }) {
  const [theme, setTheme] = useState(readTheme);
  const [style, setStyle] = useState(readStyle);
  const [reduceMotion, setReduceMotion] = useState(readMotion);

  useEffect(() => {
    if (!open) return;
    const t = readTheme();
    const s = readStyle();
    const m = readMotion();
    setTheme(t); setStyle(s); setReduceMotion(m);
    applyTheme(t); applyStyle(s); applyMotion(m);
  }, [open]);

  const chooseTheme = (id) => {
    setTheme(id);
    applyTheme(id);
    try { localStorage.setItem(THEME_KEY, id); } catch {}
  };

  const chooseStyle = (id) => {
    setStyle(id);
    applyStyle(id);
    try { localStorage.setItem(STYLE_KEY, id); } catch {}
  };

  const toggleMotion = (on) => {
    setReduceMotion(on);
    applyMotion(on);
    try { localStorage.setItem(MOTION_KEY, on ? '1' : '0'); } catch {}
  };

  const reset = () => {
    chooseTheme('nordic');
    chooseStyle('nordic');
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

          {/* ---------- UI Style ---------- */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">Layout style</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STYLES.map((s) => {
                const selected = style === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => chooseStyle(s.id)}
                    className={cn(
                      'group relative flex flex-col gap-3 rounded-lg border p-3 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/40 hover:bg-accent/40'
                    )}
                  >
                    {/* Mini preview */}
                    <div className="flex h-16 items-center justify-center rounded-md bg-muted/40">
                      <div
                        className="rounded-md border bg-card px-3 py-2 shadow-sm"
                        style={{ borderRadius: s.preview.radius }}
                      >
                        <div
                          className="text-sm"
                          style={{ fontFamily: s.preview.heading, fontWeight: s.preview.headingWeight }}
                        >
                          Aa
                        </div>
                        <div className="mt-1 h-1 w-10 rounded-full bg-muted-foreground/30" />
                        <div className="mt-0.5 h-1 w-6 rounded-full bg-muted-foreground/20" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">{s.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{s.tag}</p>
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
              Changes corner radius, heading font, and shadow depth across the whole app.
            </p>
          </section>

          {/* ---------- Color theme ---------- */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10">
                <Palette className="h-3.5 w-3.5 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">Color theme</h3>
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
