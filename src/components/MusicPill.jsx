import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, Search, ChevronUp, Music2, X,
} from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, MOODS } from '@/lib/musicCatalog.js';
import { cn } from '@/lib/utils';

const EQ_STYLE = `
@keyframes sync-eq {
  0%, 100% { transform: scaleY(0.4); }
  50%      { transform: scaleY(1); }
}
`;

const GLASS_PANEL =
  'border border-white/30 dark:border-white/15 ' +
  'bg-white/30 dark:bg-slate-900/40 ' +
  'backdrop-blur-3xl backdrop-saturate-200 ' +
  'shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.5)] ' +
  'dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]';

const GLASS_PILL =
  'border border-white/35 dark:border-white/15 ' +
  'bg-white/35 dark:bg-slate-900/45 ' +
  'backdrop-blur-3xl backdrop-saturate-200 ' +
  'shadow-[0_12px_36px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.55)] ' +
  'dark:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.14)]';

export default function MusicPill() {
  const m = useMusic();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [mood, setMood] = useState('All');
  const [showVolume, setShowVolume] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setExpanded(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  if (!m.enabled) return null;

  const visible = TRACKS.filter((t) => {
    if (mood !== 'All' && t.mood !== mood) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
  });

  return (
    <>
      <style>{EQ_STYLE}</style>
      <div
        ref={wrapperRef}
        className="fixed bottom-20 md:bottom-6 z-40 left-3 right-3 md:left-[264px] md:right-auto md:w-[440px] md:max-w-[calc(100vw-288px)]"
      >
        <div
          className={cn(
            'mb-2 overflow-hidden rounded-3xl transition-all duration-300 ease-out',
            GLASS_PANEL,
            expanded ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          )}
        >
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tracks…"
                  className="w-full rounded-full border border-white/30 bg-white/40 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-foreground/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-black/25"
                  aria-label="Search tracks"
                />
              </div>
              <button
                onClick={() => m.setMasterEnabled(false)}
                title="Turn music off in the app"
                className="grid h-7 w-7 place-items-center rounded-full text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10"
                aria-label="Turn music off"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((mo) => (
                <button
                  key={mo}
                  onClick={() => setMood(mo)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
                    mood === mo
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-white/30 bg-white/30 text-foreground/70 hover:bg-white/50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                  )}
                >
                  {mo}
                </button>
              ))}
            </div>

            <div className="max-h-[42vh] overflow-y-auto -mx-1 px-1 space-y-0.5">
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
                      'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                      isCurrent ? 'bg-primary/15 text-primary' : 'hover:bg-white/40 dark:hover:bg-white/5'
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold',
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-white/50 dark:bg-white/5 text-foreground/60'
                      )}
                    >
                      {isCurrent && m.playing ? (
                        <span className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 bg-current" style={{ height: '60%', animation: 'sync-eq 0.9s ease-in-out infinite' }} />
                          <span className="w-0.5 bg-current" style={{ height: '100%', animation: 'sync-eq 1.1s ease-in-out infinite 0.15s' }} />
                          <span className="w-0.5 bg-current" style={{ height: '45%', animation: 'sync-eq 0.8s ease-in-out infinite 0.3s' }} />
                        </span>
                      ) : (
                        <Music2 className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{t.title}</span>
                      <span className="block truncate text-[10px] text-foreground/50">{t.mood}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-white/20 dark:border-white/10 pt-2 text-[10px] text-foreground/60">
              <span>{TRACKS.length} tracks · CC0 public domain</span>
              <button
                onClick={() => m.setMasterEnabled(false)}
                className="rounded-full px-2 py-0.5 hover:bg-white/40 dark:hover:bg-white/10"
              >
                Turn off
              </button>
            </div>
          </div>
        </div>

        <div className={cn('flex items-center gap-2 rounded-full px-3 py-2', GLASS_PILL)}>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="grid h-7 w-7 place-items-center rounded-full text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronUp className={cn('h-4 w-4 transition-transform duration-300', expanded && 'rotate-180')} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold leading-tight">{m.currentTrack.title}</div>
            <div className="truncate text-[10px] leading-tight text-foreground/55">
              {m.error ? m.error : m.loading ? 'Buffering…' : m.currentTrack.mood}
            </div>
          </div>

          <button
            onClick={m.toggleShuffle}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full transition-colors',
              m.shuffle ? 'text-primary bg-primary/10' : 'text-foreground/50 hover:bg-white/40 dark:hover:bg-white/10'
            )}
            aria-label="Shuffle"
            title={m.shuffle ? 'Shuffle on' : 'Shuffle off'}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={m.prev}
            className="grid h-7 w-7 place-items-center rounded-full text-foreground/70 hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Previous"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={m.toggle}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-[1.04] active:scale-95"
            aria-label={m.playing ? 'Pause' : 'Play'}
          >
            {m.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            onClick={m.next}
            className="grid h-7 w-7 place-items-center rounded-full text-foreground/70 hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Next"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={m.cycleLoop}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full transition-colors',
              m.loopMode !== 'none' ? 'text-primary bg-primary/10' : 'text-foreground/50 hover:bg-white/40 dark:hover:bg-white/10'
            )}
            aria-label={`Loop: ${m.loopMode}`}
            title={`Loop: ${m.loopMode}`}
          >
            {m.loopMode === 'one' ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
          </button>

          <div className="relative flex items-center">
            <button
              onClick={() => setShowVolume((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-full text-foreground/60 hover:bg-white/40 dark:hover:bg-white/10"
              aria-label={m.muted ? 'Unmute' : 'Mute'}
              title={`Volume ${Math.round((m.muted ? 0 : m.volume) * 100)}%`}
            >
              {m.muted || m.volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            {showVolume && (
              <div className={cn('absolute bottom-full right-0 mb-2 rounded-2xl p-2', GLASS_PANEL)}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={m.muted ? 0 : m.volume}
                  onChange={(e) => { m.setMuted(false); m.setVolume(Number(e.target.value)); }}
                  className="h-1 w-28 accent-primary"
                  aria-label="Volume"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
