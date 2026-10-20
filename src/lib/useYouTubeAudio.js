import { useYTAudio } from 'use-ytaudio';
import { useState, useEffect } from 'react';

export function useYouTubeAudio(urlOrPlaylist) {
  const isPlaylist = Array.isArray(urlOrPlaylist);
  
  // Use a try/catch to prevent the whole app from crashing if the library fails
  let audio = {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    audio = useYTAudio(
      isPlaylist
        ? { playlist: urlOrPlaylist, autoplay: false, initialVolume: 50 }
        : { url: urlOrPlaylist || '', autoplay: false, initialVolume: 50 }
    );
  } catch (err) {
    console.warn("YouTube Audio failed to load safely:", err);
  }

  const [image, setImage] = useState('');
  const [title, setTitle] = useState('YouTube Playlist');
  const [artist, setArtist] = useState('YouTube');

  useEffect(() => {
    if (!urlOrPlaylist) return;
    // Generic fallback for YouTube
    setImage('https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg');
  }, [urlOrPlaylist]);

  return {
    playing: false,
    toggle: () => {},
    next: () => {},
    prev: () => {},
    ...audio, // spread the audio object safely
    image,
    title,
    artist,
  };
}
