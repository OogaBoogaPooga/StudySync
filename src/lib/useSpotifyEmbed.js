import { useEffect, useRef, useState } from 'react';

let spotifyApiPromise = null;

function loadSpotifyApi() {
  if (spotifyApiPromise) return spotifyApiPromise;
  spotifyApiPromise = new Promise((resolve, reject) => {
    if (window.SpotifyIframeApi) return resolve(window.SpotifyIframeApi);
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => reject(new Error('Spotify iFrame API failed to load'));
    document.body.appendChild(s);
  });
  return spotifyApiPromise;
}

export function useSpotifyEmbed(uriOrUrl, { hidden = true } = {}) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!uriOrUrl || !containerRef.current) return;
    let cancelled = false;

    loadSpotifyApi().then((IFrameAPI) => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      IFrameAPI.createController(
        containerRef.current,
        { uri: uriOrUrl, width: hidden ? '0' : '100%', height: hidden ? '0' : '152' },
        (controller) => {
          if (cancelled) return;
          controllerRef.current = controller;
          controller.addListener('playback_update', (e) => setPlaying(!e.data.isPaused));
          setReady(true);
        }
      );
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [uriOrUrl, hidden]);

  return {
    containerRef, ready, playing,
    play: () => controllerRef.current?.togglePlay(),
    pause: () => controllerRef.current?.togglePlay(),
    toggle: () => controllerRef.current?.togglePlay(),
    next: () => {}, prev: () => {}, seek: () => {}, setVolume: () => {},
  };
}
