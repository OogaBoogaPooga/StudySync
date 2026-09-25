import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { TRACKS, trackUrl } from './musicCatalog.js';

const MusicCtx = createContext(null);
const LS_KEY = 'studysync_music_v2';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MusicProvider({ children }) {
  const prefs = useMemo(loadPrefs, []);
  const audioRef = useRef(null);

  const [enabled, setEnabled] = useState(prefs.enabled ?? true);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState(prefs.currentId || TRACKS[0].id);
  const [queue, setQueue] = useState(TRACKS.map((t) => t.id));
  const [shuffle, setShuffle] = useState(prefs.shuffle ?? false);
  const [loopMode, setLoopMode] = useState(prefs.loopMode || 'all');
  const [volume, setVolume] = useState(prefs.volume ?? 0.5);
  const [muted, setMuted] = useState(prefs.muted ?? false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = useMemo(
    () => TRACKS.find((t) => t.id === currentId) || TRACKS[0],
    [currentId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        enabled, currentId, shuffle, loopMode, volume, muted,
      }));
    } catch {}
  }, [enabled, currentId, shuffle, loopMode, volume, muted]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const playTrackById = useCallback((id, autoplay = true) => {
    const track = TRACKS.find((t) => t.id === id) || TRACKS[0];
    setCurrentId(track.id);
    const a = audioRef.current;
    if (!a) return;
    a.src = trackUrl(track);
    a.load();
    if (autoplay && enabled) {
      setLoading(true);
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)).finally(() => setLoading(false));
    }
  }, [enabled]);

  const play = useCallback(() => {
    if (!enabled) return;
    const a = audioRef.current;
    if (!a) return;
    if (!a.src) a.src = trackUrl(currentTrack);
    setLoading(true);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)).finally(() => setLoading(false));
  }, [enabled, currentTrack]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  const next = useCallback(() => {
    const idx = queue.indexOf(currentId);
    if (idx === -1) return playTrackById(queue[0]);
    if (loopMode === 'one') return playTrackById(currentId);
    if (idx === queue.length - 1) {
      if (loopMode === 'all') return playTrackById(queue[0]);
      pause();
      return;
    }
    playTrackById(queue[idx + 1]);
  }, [queue, currentId, loopMode, playTrackById, pause]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const idx = queue.indexOf(currentId);
    if (idx <= 0) return playTrackById(queue[queue.length - 1]);
    playTrackById(queue[idx - 1]);
  }, [queue, currentId, playTrackById]);

  const selectTrack = useCallback((id) => playTrackById(id), [playTrackById]);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const on = !s;
      setQueue(on ? shuffleArray(TRACKS.map((t) => t.id)) : TRACKS.map((t) => t.id));
      return on;
    });
  }, []);

  const cycleLoop = useCallback(() => {
    setLoopMode((m) => (m === 'all' ? 'one' : m === 'one' ? 'none' : 'all'));
  }, []);

  const setMasterEnabled = useCallback((on) => {
    setEnabled(on);
    if (!on) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => next();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => { setLoading(false); setError(''); };
    const onErr = () => { setError('Track failed to load.'); setLoading(false); setPlaying(false); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('error', onErr);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('error', onErr);
    };
  }, [next]);

  const seek = useCallback((seconds) => {
    const a = audioRef.current;
    if (a) a.currentTime = seconds;
  }, []);

  const value = {
    enabled, setMasterEnabled,
    playing, loading, error,
    currentTrack, currentId,
    queue, shuffle, loopMode,
    volume, muted, progress, duration,
    play, pause, toggle, next, prev, selectTrack,
    toggleShuffle, cycleLoop, seek,
    setVolume, setMuted,
  };

  return (
    <MusicCtx.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" hidden />
    </MusicCtx.Provider>
  );
}

export const useMusic = () => useContext(MusicCtx);
