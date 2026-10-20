import { useState, useEffect } from 'react';
import { Play, Pause, Search, Shuffle, Repeat, Repeat1, Music2, Youtube, Cloud, Settings2 } from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, MOODS } from '@/lib/musicCatalog.js';
import { readSourcePref } from '@/components/MusicSourcesDialog.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const GLASS_CARD =
  'overflow-hidden rounded-xl ' +
  'border border-border/60 ' +
  'bg-card/60 ' +
  'backdrop-blur-xl shadow-sm';

export default function MusicSidebar() {
  const m = useMusic();
  const [search, setSearch] = useState('');
  const [mood, setMood] = useState('All');
  const [source, setSource] = useState(() => readSourcePref());

  useEffect(() => {
    const refresh = () => setSource(readSourcePref());
    window.addEventListener('studysync:musicSourceChanged', refresh);
    return () => window.removeEventListener('studysync:musicSourceChanged', refresh);
  }, []);

  if (!m.enabled) return null;

  const isExternal = source.type !== 'builtin';

  // Filter tracks if we are on the built-in player
  const visible = TRACKS.filter((t) => {
    if (mood !== 'All' && t.mood !== mood) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
  });

  const SourceIcon = source.type === 'youtube' ? Youtube : source.type === 'soundcloud' ? Cloud : Music2;

  return (
    <Card className={GLASS_CARD}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Music2 className="h-4 w-4 text-primary" />
            Study music
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.dispatchEvent(new CustomEvent('studysync:openMusicSources'))}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Source
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {isExternal ? (
          // External Source View
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
              <SourceIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Connected to {source.type}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the player at the bottom of the screen to control playback.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.dispatchEvent(new CustomEvent('studysync:openMusicSources'))}
              className="mt-2"
            >
              Change Source
            </Button>
          </div>
        ) : (
          // Built-in Lo-Fi View
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tracks…"
                className="w-full rounded-full border border-border/60 bg-background/50 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                aria-label="Search tracks"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {MOODS.map((mo) => (
                <button
                  key={mo}
                  onClick={() => setMood(mo)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                    mood === mo
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-accent'
                  )}
                >
                  {mo}
                </button>
              ))}
            </div>

            <div className="max-h-[35vh] space-y-0.5 overflow-y-auto pr-1">
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
                      'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                      isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
                    )}
                  >
                    <span className="grid h-5 w-5 place-items-center">
                      {isCurrent && m.playing ? (
                        <span className="flex items-end gap-[2px] h-2.5 text-primary">
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.8s_ease-in-out_infinite]" style={{ height: '100%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_1.1s_ease-in-out_infinite_0.15s]" style={{ height: '70%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.9s_ease-in-out_infinite_0.3s]" style={{ height: '90%' }} />
                        </span>
                      ) : (
                        <Play className={cn("h-3 w-3", isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{t.mood}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4 border-t border-border/60 pt-3 mt-1">
              <button
                onClick={m.toggleShuffle}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full transition-colors',
                  m.shuffle ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
                )}
                aria-label="Shuffle"
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                onClick={m.toggle}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
                aria-label={m.playing ? 'Pause' : 'Play'}
              >
                {m.playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
              </button>
              <button
                onClick={m.cycleLoop}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full transition-colors',
                  m.loopMode !== 'none' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
                )}
                aria-label={`Loop: ${m.loopMode}`}
              >
                {m.loopMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
