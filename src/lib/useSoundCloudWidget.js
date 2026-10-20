import { useEffect, useRef, useState } from 'react';

let scApiPromise = null;

function loadSoundCloudApi() {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  if (scApiPromise) return scApiPromise;
  scApiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.async = true;
    s.onload = () => resolve(window.SC);
    s.onerror = () => reject(new Error('SoundCloud Widget API failed to load'));
    document.body.appendChild(s);
  });
  return scApiPromise;
}

export function useSoundCloudWidget(url, { hidden = true } = {}) {
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    loadSoundCloudApi().then((SC) => {
      if (cancelled || !iframeRef.current) return;
      const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&show_artwork=false`;
      iframeRef.current.src = src;
      const widget = SC.Widget(iframeRef.current);
      widgetRef.current = widget;
      widget.bind(SC.Widget.Events.READY, () => setReady(true));
      widget.bind(SC.Widget.Events.PLAY, () => setPlaying(true));
      widget.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
      widget.bind(SC.Widget.Events.FINISH, () => setPlaying(false));
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [url]);

  return {
    iframeRef, ready, playing,
    play: () => widgetRef.current?.play(),
    pause: () => widgetRef.current?.pause(),
    toggle: () => widgetRef.current?.toggle(),
    next: () => widgetRef.current?.next(),
    prev: () => widgetRef.current?.prev(),
    seek: (sec) => widgetRef.current?.seekTo(sec * 1000),
    setVolume: (v) => widgetRef.current?.setVolume(Math.round(v * 100)),
  };
}
