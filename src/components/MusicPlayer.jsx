import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ChevronUp, Music2, X
} from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { TRACKS } from '@/lib/musicCatalog.js';
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
  
  const title = usingExternal ? (source.type === 'youtube' ? 'YouTube Playlist' : source.type === 'spotify' ? 'Spotify Playlist' : 'SoundCloud Set') : m.currentTrack.title;
  const artist = usingExternal ? 'Connected Source' : m.currentTrack.artist;

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
        className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(560px,calc(100vw-2rem))] flex flex-col items-center"
      >
        {/* Expanded Track List */}
        <div
          className={cn(
            'mb-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a24]/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out',
            expanded ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0 pointer-events-none border-transparent'
          )}
        >
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold text-white/70">Up Next</p>
              <button onClick={() => setExpanded(false)} className="text-white/50 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-0.5 pr-1">
              {usingExternal ? (
                <p className="px-2 py-4 text-xs text-white/50 text-center">
                  External playlists are controlled via the buttons below.
                </p>
              ) : (
                TRACKS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => m.selectTrack(t.id)}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      t.id === m.currentId ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <span className="grid h-5 w-5 place-items-center">
                      {t.id === m.currentId && m.playing ? (
                        <span className="flex items-end gap-[2px] h-2.5 text-white">
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.8s_ease-in-out_infinite]" style={{ height: '100%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_1.1s_ease-in-out_infinite_0.15s]" style={{ height: '70%' }} />
                          <span className="w-[2px] bg-current animate-[eq-bounce_0.9s_ease-in-out_infinite_0.3s]" style={{ height: '90%' }} />
                        </span>
                      ) : (
                        <Play className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
                    <span className="text-[10px] text-white/40">{t.mood}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Collapsed Pill */}
        <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-black/80 px-2 py-2 pr-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronUp className={cn('h-4 w-4 transition-transform duration-300', expanded && 'rotate-180')} />
          </button>

          {/* Album Art */}
          <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/40 to-pink-500/40 flex items-center justify-center shadow-inner">
            <Music2 className="h-4 w-4 text-white/60" />
          </div>

          {/* Track Info */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h2 className="text-[13px] font-semibold text-white tracking-tight truncate leading-tight">{title}</h2>
            <p className="text-[11px] text-white/50 truncate leading-tight mt-0.5">{artist}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-white/80">
            <button onClick={handleShuffle} className={cn('hidden sm:block transition-colors hover:text-white', m.shuffle && !usingExternal ? 'text-white' : 'text-white/40')}>
              <Shuffle className="h-4 w-4" />
            </button>
            
            <button onClick={handlePrev} className="hover:text-white transition-colors">
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            
            <button onClick={handlePlayPause} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
              {isLoading ? (
                 <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button onClick={handleNext} className="hover:text-white transition-colors">
              <SkipForward className="h-4 w-4 fill-current" />
            </button>

            <button onClick={handleLoop} className={cn('hidden sm:block transition-colors hover:text-white', m.loopMode !== 'none' && !usingExternal ? 'text-white' : 'text-white/40')}>
              {m.loopMode === 'one' && !usingExternal ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('studysync:openMusicSources'))}
            className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title="Change music source"
          >
            <Music2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hidden Iframes for External Players */}
      {source.type === 'spotify' && <div ref={spotify.containerRef} style={{ display: 'none' }} />}
      {source.type === 'soundcloud' && <iframe ref={soundcloud.iframeRef} title="SoundCloud" style={{ display: 'none' }} allow="autoplay" />}
      {source.type === 'youtube' && <div ref={youtube.containerRef} style={{ display: 'none' }} />}
    </>
  );
}
