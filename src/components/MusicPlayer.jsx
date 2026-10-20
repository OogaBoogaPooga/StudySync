import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ChevronUp, Music2, X
} from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS, getTrackGradient } from '@/lib/musicCatalog.js';
import { readSourcePref } from '@/components/MusicSourcesDialog.jsx';
import { useSpotifyEmbed } from '@/lib/useSpotifyEmbed.js';
import { useSoundCloudWidget } from '@/lib/useSoundCloudWidget.js';
import { useYouTubeAudio } from '@/lib/useYouTubeAudio.js';
import { cn } from '@/lib/utils';

export default function MusicPlayer() {
  const m = useMusic();
  const [source, setSource] = useState(() => readSourcePref());
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const refresh = () => setSource(readSourcePref());
    window.addEventListener('studysync:musicSourceChanged', refresh);
    return () => window.removeEventListener('studysync:musicSourceChanged', refresh);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [expanded]);

  const spotify = useSpotifyEmbed(source.type === 'spotify' ? source.spotify : null, { hidden: true });
  const soundcloud = useSoundCloudWidget(source.type === 'soundcloud' ? source.soundcloud : null, { hidden: true });
  const youtube = useYouTubeAudio(source.type === 'youtube' ? source.youtube : null);

  const external =
    source.type === 'spotify' ? spotify :
    source.type === 'soundcloud' ? soundcloud :
    source.type === 'youtube' ? youtube : null;

  const usingExternal = !!external;

  const isPlaying = usingExternal ? external.playing : m.playing;
  const isLoading = usingExternal ? false : m.loading;
  
  const title = usingExternal ? (external.title || 'Connecting...') : m.currentTrack.title;
  const artist = usingExternal ? (external.artist || source.type) : m.currentTrack.artist;
  
  const coverImage = usingExternal ? external.image : m.currentTrack.image;
  const coverGradient = getTrackGradient(title);

  const handlePlayPause = () => usingExternal ? external.toggle() : m.toggle();
  const handleNext = () => usingExternal ? external.next() : m.next();
  const handlePrev = () => usingExternal ? external.prev() : m.prev();
  const handleShuffle = () => usingExternal ? null : m.toggleShuffle();
  const handleLoop = () => usingExternal ? null : m.cycleLoop();

  if (!m.enabled && !usingExternal) return null;

  return (
    <>
      <div
        ref={wrapperRef}
        className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(540px,calc(100vw-2rem))] flex flex-col items-center"
      >
        {/* Expanded Track List */}
        <div
          className={cn(
            'mb-3 w-full overflow-hidden rounded-[2rem] transition-all duration-300 ease-out',
            expanded ? 'max-h-[60vh] opacity-100 scale-100' : 'max-h-0 opacity-0 pointer-events-none scale-95',
            'bg-black/60 backdrop-blur-[40px] backdrop-saturate-[180%] border border-white/20 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)]'
          )}
        >
          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold text-white/70 tracking-wide uppercase">Up Next</p>
              <button onClick={() => setExpanded(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {usingExternal ? (
                <p className="px-2 py-6 text-xs text-white/50 text-center">
                  External playlists are controlled via the buttons below.
                </p>
              ) : (
                TRACKS.map((t) => {
                  const tCover = t.image;
                  const tGradient = getTrackGradient(t.title);
                  return (
                    <button
                      key={t.id}
                      onClick={() => m.selectTrack(t.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                        t.id === m.currentId ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <div 
                        className="h-9 w-9 shrink-0 rounded-lg overflow-hidden shadow-sm flex items-center justify-center border border-white/10"
                        style={{ background: tCover ? undefined : tGradient }}
                      >
                        {tCover ? (
                          <img src={tCover} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Music2 className="h-4 w-4 text-white/50" />
                        )}
                      </div>
                      
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</span>
                      
                      {t.id === m.currentId && m.playing ? (
                        <span className="flex items-end gap-[2px] h-2.5 text-white shrink-0 mr-2">
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.8s_ease-in-out_infinite]" style={{ height: '100%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_1.1s_ease-in-out_infinite_0.15s]" style={{ height: '70%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.9s_ease-in-out_infinite_0.3s]" style={{ height: '90%' }} />
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/40 shrink-0 mr-2">{t.mood}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Ultra-Realistic Glass Pill */}
        <div 
          className="relative flex w-full items-center gap-3 rounded-full px-3 py-2.5 pr-5 transition-all duration-300
          bg-white/10 dark:bg-black/40 backdrop-blur-[40px] backdrop-saturate-[180%] 
          border border-white/30 dark:border-white/10 
          shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]"
        >
          {/* Subtle inner highlight for extra 3D glass feel */}
          <div className="absolute inset-0 rounded-full border border-white/10 mix-blend-overlay pointer-events-none" />

          <button
            onClick={() => setExpanded(!expanded)}
            className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronUp className={cn('h-4 w-4 transition-transform duration-300', expanded && 'rotate-180')} />
          </button>

          <div 
            className="relative z-10 h-12 w-12 shrink-0 rounded-full overflow-hidden shadow-md flex items-center justify-center border border-white/20"
            style={{ background: coverImage ? undefined : coverGradient }}
          >
            {coverImage ? (
              <img src={coverImage} alt={title} className="h-full w-full object-cover" />
            ) : (
              <Music2 className="h-5 w-5 text-white/80" />
            )}
          </div>

          <div className="relative z-10 min-w-0 flex-1 flex flex-col justify-center">
            <h2 className="text-[13px] font-semibold text-white tracking-tight truncate leading-tight drop-shadow-sm">{title}</h2>
            <p className="text-[11px] text-white/60 truncate leading-tight mt-0.5">{artist}</p>
          </div>

          <div className="relative z-10 flex items-center gap-3 sm:gap-5 shrink-0 text-white/90">
            <button onClick={handleShuffle} className={cn('hidden sm:block transition-colors hover:text-white drop-shadow-sm', m.shuffle && !usingExternal ? 'text-white' : 'text-white/40')}>
              <Shuffle className="h-[18px] w-[18px]" />
            </button>
            
            <button onClick={handlePrev} className="hover:text-white transition-colors drop-shadow-sm">
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            
            <button onClick={handlePlayPause} className="grid h-10 w-10 place-items-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-white/20">
              {isLoading ? (
                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>

            <button onClick={handleNext} className="hover:text-white transition-colors drop-shadow-sm">
              <SkipForward className="h-4 w-4 fill-current" />
            </button>

            <button onClick={handleLoop} className={cn('hidden sm:block transition-colors hover:text-white drop-shadow-sm', m.loopMode !== 'none' && !usingExternal ? 'text-white' : 'text-white/40')}>
              {m.loopMode === 'one' && !usingExternal ? <Repeat1 className="h-[18px] w-[18px]" /> : <Repeat className="h-[18px] w-[18px]" />}
            </button>
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('studysync:openMusicSources'))}
            className="relative z-10 ml-1 grid h-8 w-8 place-items-center rounded-full bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors shadow-sm"
            title="Change music source"
          >
            <Music2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {source.type === 'spotify' && <div ref={spotify.containerRef} style={{ display: 'none' }} />}
      {source.type === 'soundcloud' && <iframe ref={soundcloud.iframeRef} title="SoundCloud" style={{ display: 'none' }} allow="autoplay" />}
      {source.type === 'youtube' && <div ref={youtube.containerRef} style={{ display: 'none' }} />}
    </>
  );
}
