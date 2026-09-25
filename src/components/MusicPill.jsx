import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, Search, ChevronUp, Music2, X,
} from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, MOODS } from '@/lib/musicCatalog.js';
import { cn } from '@/lib/utils';

const STYLES = `
@keyframes sync-eq {
  0%, 100% { transform: scaleY(0.4); }
  50%      { transform: scaleY(1); }
}
.music-glass {
  background: hsl(var(--card) / 0.82);
  border: 1px solid hsl(var(--border) / 0.9);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  box-shadow:
    0 12px 40px -12px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.dark .music-glass {
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
      <style>{STYLES}</style>
      <div
        ref={wrapperRef}
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(440px,calc(100vw-2rem))]"
      >
        <div
          className={cn(
            'music-glass mb-2 overflow-hidden rounded-3xl transition-all duration-300 ease-out',
            expanded ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          )}
        >
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tracks…"
                  className="w-full rounded-full border border-border/70 bg-background/60 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  aria-label="Search tracks"
                />
              </div>
              <button
                onClick={() => m.setMasterEnabled(false)}
                title="Turn music off in the app"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
                      ? 'music-chip-active'
                      : 'border-border/70 bg-background/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {mo}
                </button>
              ))}
            </div>

            <div className="max-h-[42vh] overflow-y-auto -mx-1 px-1 space-y-0.5">
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
                      'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                      isCurrent ? 'music-active' : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold',
                        isCurrent
                          ? 'music-btn-primary'
                          : 'bg-muted/60 text-muted-foreground'
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
                      <span className="block truncate text-[10px] opacity-60">{t.mood}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
              <span>{TRACKS.length} tracks · CC0 public domain</span>
              <button
                onClick={() => m.setMasterEnabled(false)}
                className="rounded-full px-2 py-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                Turn off
              </button>
            </div>
          </div>
        </div>

        <div className="music-glass flex items-center gap-2 rounded-full px-3 py-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronUp className={cn('h-4 w-4 transition-transform duration-300', expanded && 'rotate-180')} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold leading-tight">{m.currentTrack.title}</div>
            <div className="truncate text-[10px] leading-tight text-muted-foreground">
              {m.error ? m.error : m.loading ? 'Buffering…' : m.currentTrack.mood}
            </div>
          </div>

          <button
            onClick={m.toggleShuffle}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full transition-colors',
              m.shuffle ? 'music-icon-active' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-label="Shuffle"
            title={m.shuffle ? 'Shuffle on' : 'Shuffle off'}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={m.prev}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Previous"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={m.toggle}
            className="music-btn-primary grid h-9 w-9 place-items-center rounded-full"
            aria-label={m.playing ? 'Pause' : 'Play'}
          >
            {m.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            onClick={m.next}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Next"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={m.cycleLoop}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full transition-colors',
              m.loopMode !== 'none' ? 'music-icon-active' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-label={`Loop: ${m.loopMode}`}
            title={`Loop: ${m.loopMode}`}
          >
            {m.loopMode === 'one' ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
          </button>

          <div className="relative flex items-center">
            <button
              onClick={() => setShowVolume((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={m.muted ? 'Unmute' : 'Mute'}
              title={`Volume ${Math.round((m.muted ? 0 : m.volume) * 100)}%`}
            >
              {m.muted || m.volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            {showVolume && (
              <div className="music-glass absolute bottom-full right-0 mb-2 rounded-2xl p-2">
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
