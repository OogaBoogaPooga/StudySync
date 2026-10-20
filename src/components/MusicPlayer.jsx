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

// Shared styles so the Pill and the Panel match perfectly
const GLASS_BASE = "bg-white/10 dark:bg-black/40 backdrop-blur-[40px] backdrop-saturate-[180%] border border-white/20 dark:border-white/10 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.3)] relative overflow-hidden";

const LIGHTING_ORBS = (
  <>
    <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-blue-500/30 blur-[50px] pointer-events-none" />
    <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-purple-500/20 blur-[50px] pointer-events-none" />
  </>
);

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
  const isSpotify = source.type === 'spotify';

  const isPlaying = usingExternal ? external.playing : m.playing;
  const isLoading = usingExternal ? false : m.loading;
  
  const title = usingExternal ? (isSpotify ? 'Spotify Playlist' : external.title || 'Connecting...') : m.currentTrack.title;
  const artist = usingExternal ? (isSpotify ? 'Spotify' : external.artist || source.type) : m.currentTrack.artist;
  
  const coverImage = usingExternal ? (isSpotify ? '' : external.image) : m.currentTrack.image;
  const coverGradient = isSpotify 
    ? 'linear-gradient(135deg, #1DB954, #121212)'
    : getTrackGradient(title);

  const handlePlayPause = () => usingExternal ? external.toggle() : m.toggle();
  const handleNext = () => usingExternal ? external.next() : m.next();
  const handlePrev = () => usingExternal ? external.prev() : m.prev();

  if (!m.enabled && !usingExternal) return null;

  return (
    <>
      {/* Reduced width from 400px to 340px */}
      <div
        ref={wrapperRef}
        className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(340px,calc(100vw-2rem))] flex flex-col items-center"
      >
        {/* Expanded Track List */}
        <div
          className={cn(
            'mb-2 w-full rounded-[1.5rem] transition-all duration-300 ease-out',
            GLASS_BASE,
            expanded ? 'max-h-[50vh] opacity-100 scale-100 translate-y-0' : 'max-h-0 opacity-0 pointer-events-none scale-95 translate-y-4 border-transparent shadow-none'
          )}
        >
          {LIGHTING_ORBS}
          <div className="p-2.5 space-y-1 relative z-10">
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="text-[10px] font-bold text-white/60 tracking-wider uppercase drop-shadow-sm">Up Next</p>
              <button onClick={() => setExpanded(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="max-h-[35vh] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
              {usingExternal ? (
                <p className="px-2 py-6 text-xs text-white/50 text-center">
                  External playlists are controlled via the player below.
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
                        'group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors',
                        t.id === m.currentId ? 'bg-white/20 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <div 
                        className="h-6 w-6 shrink-0 rounded-md overflow-hidden shadow-sm flex items-center justify-center border border-white/10"
                        style={{ background: tCover ? undefined : tGradient }}
                      >
                        {tCover ? (
                          <img src={tCover} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Music2 className="h-3 w-3 text-white/70" />
                        )}
                      </div>
                      
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{t.title}</span>
                      
                      {t.id === m.currentId && m.playing ? (
                        <span className="flex items-end gap-[2px] h-2 text-white shrink-0 mr-1">
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.8s_ease-in-out_infinite]" style={{ height: '100%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_1.1s_ease-in-out_infinite_0.15s]" style={{ height: '70%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.9s_ease-in-out_infinite_0.3s]" style={{ height: '90%' }} />
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/40 shrink-0 mr-1">{t.mood}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Collapsed Pill (Reduced height from 64px to 56px) */}
        <div 
          className={cn(
            "flex h-[56px] w-full items-center gap-2.5 rounded-full px-2 pr-3 transition-all duration-300",
            GLASS_BASE
          )}
        >
          {LIGHTING_ORBS}

          <button
            onClick={() => setExpanded(!expanded)}
            className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronUp className={cn('h-3.5 w-3.5 transition-transform duration-300', expanded && 'rotate-180')} />
          </button>

          {/* Smaller Pop-out Album Art */}
          <div 
            className="relative z-10 h-10 w-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center 
            shadow-[0_6px_16px_rgba(0,0,0,0.5)] ring-2 ring-white/30 border border-black/20 
            transition-transform duration-300 hover:scale-105"
            style={{ background: coverImage ? undefined : coverGradient }}
          >
            {coverImage ? (
              <img src={coverImage} alt={title} className="h-full w-full object-cover" />
            ) : (
              <Music2 className="h-4 w-4 text-white drop-shadow-md" />
            )}
          </div>

          <div className="relative z-10 min-w-0 flex-1 flex flex-col justify-center">
            <h2 className="text-[12px] font-semibold text-white tracking-tight truncate leading-tight drop-shadow-sm">{title}</h2>
            <p className="text-[10px] text-white/70 truncate leading-tight mt-0.5">{artist}</p>
          </div>

          <div className="relative z-10 flex items-center gap-2 shrink-0 text-white/90">
            {!isSpotify && (
              <button onClick={handlePrev} className="hover:text-white transition-colors drop-shadow-sm">
                <SkipBack className="h-3 w-3 fill-current" />
              </button>
            )}
            
            <button onClick={handlePlayPause} className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/20 hover:scale-105 active:scale-95">
              {isLoading ? (
                 <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isPlaying ? (
                <Pause className="h-3 w-3 fill-current" />
              ) : (
                <Play className="h-3 w-3 fill-current ml-0.5" />
              )}
            </button>

            {!isSpotify && (
              <button onClick={handleNext} className="hover:text-white transition-colors drop-shadow-sm">
                <SkipForward className="h-3 w-3 fill-current" />
              </button>
            )}
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('studysync:openMusicSources'))}
            className="relative z-10 ml-0.5 grid h-6 w-6 place-items-center rounded-full bg-white/10 border border-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors shadow-sm"
            title="Change music source"
          >
            <Music2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {source.type === 'spotify' && <div ref={spotify.containerRef} style={{ display: 'none' }} />}
      {source.type === 'soundcloud' && <iframe ref={soundcloud.iframeRef} title="SoundCloud" style={{ display: 'none' }} allow="autoplay" />}
      {source.type === 'youtube' && <div ref={youtube.containerRef} style={{ display: 'none' }} />}
    </>
  );
}
