import { useState } from 'react';
import { Play, Pause, Search, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, MOODS } from '@/lib/musicCatalog.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

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
    <Card className="overflow-hidden border-white/20 bg-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/50">
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
            className="w-full rounded-full border border-white/20 bg-white/40 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-foreground/40 focus:border-primary/40 dark:border-white/10 dark:bg-black/20"
            aria-label="Search tracks"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {MOODS.map((mo) => (
            <button
              key={mo}
              onClick={() => setMood(mo)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px]',
                mood === mo
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-white/20 bg-white/30 text-foreground/70 hover:bg-white/50 dark:border-white/10 dark:bg-white/5'
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
                  isCurrent ? 'bg-primary/15 text-primary' : 'hover:bg-white/40 dark:hover:bg-white/5'
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

        <div className="flex items-center justify-center gap-2 border-t border-white/15 pt-2 dark:border-white/10">
          <button
            onClick={m.toggleShuffle}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full',
              m.shuffle ? 'bg-primary/15 text-primary' : 'text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10'
            )}
            aria-label="Shuffle"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            onClick={m.toggle}
            className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
            aria-label={m.playing ? 'Pause' : 'Play'}
          >
            {m.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            onClick={m.cycleLoop}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full',
              m.loopMode !== 'none' ? 'bg-primary/15 text-primary' : 'text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10'
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
