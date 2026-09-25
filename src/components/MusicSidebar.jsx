import { useState } from 'react';
import { Play, Pause, Search, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, MOODS } from '@/lib/musicCatalog.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

const GLASS_CARD =
  'overflow-hidden rounded-xl ' +
  'border border-white/25 dark:border-amber-200/15 ' +
  'bg-gradient-to-br from-white/30 via-white/15 to-amber-100/20 ' +
  'dark:from-slate-900/40 dark:via-slate-900/25 dark:to-amber-950/20 ' +
  'backdrop-blur-3xl backdrop-saturate-200 ' +
  'shadow-[0_20px_60px_-15px_rgba(217,119,6,0.25),0_8px_24px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.5)] ' +
  'dark:shadow-[0_20px_60px_-15px_rgba(217,119,6,0.15),0_8px_24px_-8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]';

const AMBER_BTN =
  'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900 ' +
  'shadow-[0_4px_14px_-2px_rgba(245,158,11,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] ' +
  'hover:from-amber-300 hover:to-yellow-400';

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
    <Card className={GLASS_CARD}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Study music</CardTitle>
          <button
            onClick={() => m.setMasterEnabled(false)}
            className="rounded-full px-2 py-0.5 text-[10px] text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10"
          >
            Turn off
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracks…"
            className="w-full rounded-full border border-white/30 bg-white/30 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-foreground/40 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 dark:border-white/10 dark:bg-black/20 backdrop-blur-sm"
            aria-label="Search tracks"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {MOODS.map((mo) => (
            <button
              key={mo}
              onClick={() => setMood(mo)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] transition-all',
                mood === mo
                  ? 'border-amber-400/50 bg-gradient-to-br from-amber-400/25 to-yellow-500/20 text-amber-700 dark:text-amber-200'
                  : 'border-white/30 bg-white/20 text-foreground/70 hover:bg-white/40 dark:border-white/10 dark:bg-white/5'
              )}
            >
              {mo}
            </button>
          ))}
        </div>

        <div className="max-h-[44vh] space-y-0.5 overflow-y-auto">
          {visible.length === 0 && (
            <p className="py-6 text-center text-xs text-foreground/50">No tracks match.</p>
          )}
          {visible.map((t) => {
            const isCurrent = t.id === m.currentId;
            return (
              <button
                key={t.id}
                onClick={() => m.selectTrack(t.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors',
                  isCurrent
                    ? 'bg-gradient-to-r from-amber-400/25 to-yellow-500/15 text-amber-700 dark:text-amber-200'
                    : 'hover:bg-white/40 dark:hover:bg-white/5'
                )}
              >
                <span className="grid h-6 w-6 place-items-center">
                  {isCurrent && m.playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-[10px] text-foreground/50">{t.mood}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-white/20 pt-2 dark:border-white/10">
          <button
            onClick={m.toggleShuffle}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full transition-colors',
              m.shuffle ? 'bg-amber-400/15 text-amber-600 dark:text-amber-300' : 'text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10'
            )}
            aria-label="Shuffle"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            onClick={m.toggle}
            className={cn(
              'grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-[1.04] active:scale-95',
              AMBER_BTN
            )}
            aria-label={m.playing ? 'Pause' : 'Play'}
          >
            {m.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            onClick={m.cycleLoop}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full transition-colors',
              m.loopMode !== 'none' ? 'bg-amber-400/15 text-amber-600 dark:text-amber-300' : 'text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10'
            )}
            aria-label={`Loop: ${m.loopMode}`}
          >
            {m.loopMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
