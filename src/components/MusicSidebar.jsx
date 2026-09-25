import { useState } from 'react';
import { Play, Pause, Search, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, MOODS } from '@/lib/musicCatalog.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

const STYLES = `
.music-sidebar-glass {
  background: hsl(var(--card) / 0.82);
  border: 1px solid hsl(var(--border) / 0.9);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  box-shadow:
    0 12px 40px -12px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.dark .music-sidebar-glass {
  background: hsl(var(--card) / 0.72);
  border-color: hsl(var(--border) / 0.8);
  box-shadow:
    0 16px 48px -14px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
.music-btn-primary {
  background: hsl(110 22% 42%);
  color: #fff;
  box-shadow:
    0 4px 14px -3px rgba(85, 107, 47, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: background 160ms ease, transform 120ms ease;
}
.music-btn-primary:hover { background: hsl(110 22% 37%); }
.music-btn-primary:active { transform: scale(0.95); }
.dark .music-btn-primary {
  background: hsl(110 24% 50%);
  box-shadow:
    0 4px 14px -3px rgba(85, 107, 47, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
.dark .music-btn-primary:hover { background: hsl(110 24% 55%); }
.music-active {
  background: hsl(110 22% 42% / 0.14);
  color: hsl(110 25% 32%);
}
.dark .music-active {
  background: hsl(110 25% 50% / 0.18);
  color: hsl(110 30% 78%);
}
.music-chip-active {
  background: hsl(110 22% 42% / 0.14);
  border-color: hsl(110 22% 42% / 0.45);
  color: hsl(110 25% 32%);
}
.dark .music-chip-active {
  background: hsl(110 25% 50% / 0.18);
  border-color: hsl(110 25% 50% / 0.45);
  color: hsl(110 30% 78%);
}
.music-icon-active {
  background: hsl(110 22% 42% / 0.14);
  color: hsl(110 25% 32%);
}
.dark .music-icon-active {
  background: hsl(110 25% 50% / 0.18);
  color: hsl(110 30% 78%);
}
`;

export default function MusicSidebar() {
  const m = useMusic();
  const [search, setSearch] = useState('');
  const [mood, setMood] = useState('All');

  if (!m.enabled) return null;

  const visible = TRACKS.filter((t) => {
    if (mood !== 'All' && t.mood !== mood) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
  });

  return (
    <>
      <style>{STYLES}</style>
      <Card className="music-sidebar-glass">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Study music</CardTitle>
            <button
              onClick={() => m.setMasterEnabled(false)}
              className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Turn off
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracks…"
              className="w-full rounded-full border border-border/70 bg-background/60 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              aria-label="Search tracks"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {MOODS.map((mo) => (
              <button
                key={mo}
                onClick={() => setMood(mo)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
                  mood === mo
                    ? 'music-chip-active'
                    : 'border-border/70 bg-background/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {mo}
              </button>
            ))}
          </div>

          <div className="max-h-[44vh] space-y-0.5 overflow-y-auto">
            {visible.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No tracks match.</p>
            )}
            {visible.map((t) => {
              const isCurrent = t.id === m.currentId;
              return (
                <button
                  key={t.id}
                  onClick={() => m.selectTrack(t.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors',
                    isCurrent ? 'music-active' : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className="grid h-6 w-6 place-items-center">
                    {isCurrent && m.playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-[10px] opacity-60">{t.mood}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-border/60 pt-2">
            <button
              onClick={m.toggleShuffle}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full transition-colors',
                m.shuffle ? 'music-icon-active' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-label="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              onClick={m.toggle}
              className="music-btn-primary grid h-11 w-11 place-items-center rounded-full"
              aria-label={m.playing ? 'Pause' : 'Play'}
            >
              {m.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <button
              onClick={m.cycleLoop}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full transition-colors',
                m.loopMode !== 'none' ? 'music-icon-active' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-label={`Loop: ${m.loopMode}`}
            >
              {m.loopMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
