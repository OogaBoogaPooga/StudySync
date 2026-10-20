/**
 * 25 study tracks. Original names preserved, mapped to working public domain CDN URLs.
 */
export const TRACKS = [
  { id: 't01', title: '2 AM Debug Loop',          artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3', mood: 'Focus' },
  { id: 't02', title: 'Brushstrokes and Rain',     artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', mood: 'Rain' },
  { id: 't03', title: 'Butter and Windowlight',    artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', mood: 'Morning' },
  { id: 't04', title: 'Chapter By Lamplight',      artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', mood: 'Reading' },
  { id: 't05', title: 'Coffee Ring Notebook',      artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', mood: 'Focus' },
  { id: 't06', title: 'Continue Screen Dreams',    artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3', mood: 'Chill' },
  { id: 't07', title: 'Cursor After Midnight',     artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', mood: 'Late night' },
  { id: 't08', title: 'Dog Eared Pages',           artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', mood: 'Reading' },
  { id: 't09', title: 'Exhale the Morning',        artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', mood: 'Morning' },
  { id: 't10', title: 'Faded Corners of the Page', artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', mood: 'Reading' },
  { id: 't11', title: 'First Coffee Thoughts',     artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3', mood: 'Morning' },
  { id: 't12', title: 'Graphite Mornings',         artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', mood: 'Focus' },
  { id: 't13', title: 'Hour Between Clicks',       artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', mood: 'Focus' },
  { id: 't14', title: 'Kettle Before Work',        artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', mood: 'Morning' },
  { id: 't15', title: 'Margin Notes at Dusk',      artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', mood: 'Reading' },
  { id: 't16', title: 'Morning Pages',             artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3', mood: 'Morning' },
  { id: 't17', title: 'Morning in the Hiss',       artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', mood: 'Morning' },
  { id: 't18', title: 'Penciled Sunbeams',         artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', mood: 'Chill' },
  { id: 't19', title: 'Pixel Quest Save Point',    artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', mood: 'Chill' },
  { id: 't20', title: 'Quiet Lungs Quiet Light',   artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', mood: 'Ambient' },
  { id: 't21', title: 'Stacks of Quiet Hours',     artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3', mood: 'Focus' },
  { id: 't22', title: 'Sunday Light Through Lace', artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', mood: 'Chill' },
  { id: 't23', title: 'Sunrise Stretch Flow',      artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', mood: 'Morning' },
  { id: 't24', title: 'Terminal Rain',             artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', mood: 'Rain' },
  { id: 't25', title: 'Watercolors By the Window', artist: 'Open Lo-Fi', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', mood: 'Chill' },
];

export const MOODS = ['All', 'Focus', 'Morning', 'Reading', 'Chill', 'Rain', 'Ambient', 'Late night'];

// If the URL starts with http, use it directly.
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
