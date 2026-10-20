export const TRACKS = [
  { id: 't01', title: '2 AM Debug Loop',          artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3', mood: 'Focus' },
  { id: 't02', title: 'Brushstrokes and Rain',     artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', mood: 'Rain' },
  { id: 't03', title: 'Butter and Windowlight',    artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', mood: 'Morning' },
  { id: 't04', title: 'Chapter By Lamplight',      artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', mood: 'Reading' },
  { id: 't05', title: 'Coffee Ring Notebook',      artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', mood: 'Focus' },
];

export const MOODS = ['All', 'Focus', 'Morning', 'Reading', 'Chill', 'Rain', 'Ambient', 'Late night'];

// If the URL starts with http, use it directly. Otherwise, prepend the base URL.
export const trackUrl = (track) => track.url.startsWith('http') ? track.url : track.url;

export function getTrackGradient(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 60%, 45%), hsl(${h2}, 60%, 20%))`;
}
