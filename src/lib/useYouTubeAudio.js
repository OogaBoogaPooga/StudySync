import { useYTAudio } from 'use-ytaudio';

export function useYouTubeAudio(urlOrPlaylist) {
  const isPlaylist = Array.isArray(urlOrPlaylist);
  return useYTAudio(
    isPlaylist
      ? { playlist: urlOrPlaylist, autoplay: false, initialVolume: 50 }
      : { url: urlOrPlaylist || '', autoplay: false, initialVolume: 50 }
  );
}
