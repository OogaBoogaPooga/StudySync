import { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Heart, Music2, Youtube } from 'lucide-react';
import { useMusic } from '@/lib/music.jsx';
import { readSourcePref } from '@/components/MusicSourcesDialog.jsx';
import { useSpotifyEmbed } from '@/lib/useSpotifyEmbed.js';
import { useSoundCloudWidget } from '@/lib/useSoundCloudWidget.js';
import { useYouTubeAudio } from '@/lib/useYouTubeAudio.js';
import { cn } from '@/lib/utils';

export default function MusicPlayer() {
  const m = useMusic();
  const [source, setSource] = useState(() => readSourcePref());
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const refresh = () => setSource(readSourcePref());
    window.addEventListener('studysync:musicSourceChanged', refresh);
    return () => window.removeEventListener('studysync:musicSourceChanged', refresh);
  }, []);

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
  const progressPercent = usingExternal ? 0 : (m.progress / (m.duration || 1)) * 100;

  const handlePlayPause = () => usingExternal ? external.toggle() : m.toggle();
  const handleNext = () => usingExternal ? external.next() : m.next();
  const handlePrev = () => usingExternal ? external.prev() : m.prev();

  if (!m.enabled && !usingExternal) return null;

  return (
    <>
      <style>{`
        @keyframes eq-bounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>

      {/* Sleek, compact player */}
      <div className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] rounded-[1.5rem] border border-white/20 bg-white/10 dark:bg-[#1a1a24]/90 p-3 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur-3xl backdrop-saturate-150 flex items-center gap-4">
        
        {/* Album Art & Heart */}
        <div className="relative shrink-0">
          <div className="h-20 w-20 rounded-[1rem] overflow-hidden shadow-lg bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40 flex items-center justify-center">
             <Music2 className="h-8 w-8 text-white/50" />
          </div>
          <button onClick={() => setLiked(!liked)} className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-[#2a2a35] border border-white/10 shadow-md hover:bg-[#3a3a45] transition-colors">
            <Heart className={cn("h-3 w-3 transition-colors", liked ? "fill-white text-white" : "text-white/60")} />
          </button>
        </div>

        {/* Info & Controls */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="mb-2">
            <h2 className="text-[15px] font-bold text-white tracking-tight truncate leading-tight">{title}</h2>
            <p className="text-[11px] text-white/60 truncate mt-0.5">{artist}</p>
          </div>

          {/* Progress & Visualizer */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-end gap-[2px] h-2.5 text-white/60">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="w-[2px] bg-current rounded-full origin-bottom" style={{ height: '100%', animation: isPlaying ? `eq-bounce ${0.6 + (i * 0.15)}s ease-in-out infinite` : 'none', transform: isPlaying ? undefined : 'scaleY(0.3)' }} />
              ))}
            </div>
            <div className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white/90 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={handlePrev} className="text-white/60 hover:text-white transition-colors"><SkipBack className="h-4 w-4 fill-current" /></button>
              <button onClick={handlePlayPause} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:scale-105 active:scale-95 transition-all">
                {isLoading ? (
                   <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                )}
              </button>
              <button onClick={handleNext} className="text-white/60 hover:text-white transition-colors"><SkipForward className="h-4 w-4 fill-current" /></button>
            </div>
            
            <button onClick={() => window.dispatchEvent(new CustomEvent('studysync:openMusicSources'))} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors" title="Change music source">
              {source.type === 'youtube' ? <Youtube className="h-3.5 w-3.5" /> : <Music2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {source.type === 'spotify' && <div ref={spotify.containerRef} style={{ display: 'none' }} />}
      {source.type === 'soundcloud' && <iframe ref={soundcloud.iframeRef} title="SoundCloud" style={{ display: 'none' }} allow="autoplay" />}
      {source.type === 'youtube' && <div ref={youtube.containerRef} style={{ display: 'none' }} />}
    </>
  );
}
