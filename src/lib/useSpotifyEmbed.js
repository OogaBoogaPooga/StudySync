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
  const [playingURI, setPlayingURI] = useState('');
  const [image, setImage] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

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
          controller.addListener('playback_update', (e) => {
            setPlaying(!e.data.isPaused);
            if (e.data.playingURI) setPlayingURI(e.data.playingURI);
          });
          setReady(true);
        }
      );
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [uriOrUrl, hidden]);

  useEffect(() => {
    if (!playingURI) return;
    const match = playingURI.match(/track[:/]([a-zA-Z0-9]+)/);
    if (!match) return;
    const trackId = match[1];
    const url = `https://open.spotify.com/track/${trackId}`;
    
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        setImage(data.thumbnail_url || '');
        setTitle(data.title || '');
        setArtist(data.author_name || '');
      })
      .catch(() => {});
  }, [playingURI]);

  return {
    containerRef, ready, playing, image, title, artist,
    play: () => controllerRef.current?.togglePlay(),
    pause: () => controllerRef.current?.togglePlay(),
    toggle: () => controllerRef.current?.togglePlay(),
    next: () => {}, prev: () => {}, seek: () => {}, setVolume: () => {},
  };
}
