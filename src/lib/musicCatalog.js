/**
 * 25 study tracks from Open Lo-Fi (github.com/btahir/open-lofi).
 * CC0 1.0 Universal — public domain, no attribution required.
 * Files served from /api/music/<filename> on the Railway volume.
 */
export const TRACKS = [
  { id: 't01', title: '2 AM Debug Loop',          artist: 'Open Lo-Fi', url: '2-am-debug-loop.mp3',          mood: 'Focus' },
  { id: 't02', title: 'Brushstrokes and Rain',     artist: 'Open Lo-Fi', url: 'brushstrokes-and-rain.mp3',     mood: 'Rain' },
  { id: 't03', title: 'Butter and Windowlight',    artist: 'Open Lo-Fi', url: 'butter-and-windowlight.mp3',    mood: 'Morning' },
  { id: 't04', title: 'Chapter By Lamplight',      artist: 'Open Lo-Fi', url: 'chapter-by-lamplight.mp3',      mood: 'Reading' },
  { id: 't05', title: 'Coffee Ring Notebook',      artist: 'Open Lo-Fi', url: 'coffee-ring-notebook.mp3',      mood: 'Focus' },
  { id: 't06', title: 'Continue Screen Dreams',    artist: 'Open Lo-Fi', url: 'continue-screen-dreams.mp3',    mood: 'Chill' },
  { id: 't07', title: 'Cursor After Midnight',     artist: 'Open Lo-Fi', url: 'cursor-after-midnight.mp3',     mood: 'Late night' },
  { id: 't08', title: 'Dog Eared Pages',           artist: 'Open Lo-Fi', url: 'dog-eared-pages.mp3',           mood: 'Reading' },
  { id: 't09', title: 'Exhale the Morning',        artist: 'Open Lo-Fi', url: 'exhale-the-morning.mp3',        mood: 'Morning' },
  { id: 't10', title: 'Faded Corners of the Page', artist: 'Open Lo-Fi', url: 'faded-corners-of-the-page.mp3', mood: 'Reading' },
  { id: 't11', title: 'First Coffee Thoughts',     artist: 'Open Lo-Fi', url: 'first-coffee-thoughts.mp3',     mood: 'Morning' },
  { id: 't12', title: 'Graphite Mornings',         artist: 'Open Lo-Fi', url: 'graphite-mornings.mp3',         mood: 'Focus' },
  { id: 't13', title: 'Hour Between Clicks',       artist: 'Open Lo-Fi', url: 'hour-between-clicks.mp3',       mood: 'Focus' },
  { id: 't14', title: 'Kettle Before Work',        artist: 'Open Lo-Fi', url: 'kettle-before-work.mp3',        mood: 'Morning' },
  { id: 't15', title: 'Margin Notes at Dusk',      artist: 'Open Lo-Fi', url: 'margin-notes-at-dusk.mp3',      mood: 'Reading' },
  { id: 't16', title: 'Morning Pages',             artist: 'Open Lo-Fi', url: 'morning-pages.mp3',             mood: 'Morning' },
  { id: 't17', title: 'Morning in the Hiss',       artist: 'Open Lo-Fi', url: 'morning-in-the-hiss.mp3',       mood: 'Morning' },
  { id: 't18', title: 'Penciled Sunbeams',         artist: 'Open Lo-Fi', url: 'penciled-sunbeams.mp3',         mood: 'Chill' },
  { id: 't19', title: 'Pixel Quest Save Point',    artist: 'Open Lo-Fi', url: 'pixel-quest-save-point.mp3',    mood: 'Chill' },
  { id: 't20', title: 'Quiet Lungs Quiet Light',   artist: 'Open Lo-Fi', url: 'quiet-lungs-quiet-light.mp3',   mood: 'Ambient' },
  { id: 't21', title: 'Stacks of Quiet Hours',     artist: 'Open Lo-Fi', url: 'stacks-of-quiet-hours.mp3',     mood: 'Focus' },
  { id: 't22', title: 'Sunday Light Through Lace', artist: 'Open Lo-Fi', url: 'sunday-light-through-lace.mp3', mood: 'Chill' },
  { id: 't23', title: 'Sunrise Stretch Flow',      artist: 'Open Lo-Fi', url: 'sunrise-stretch-flow.mp3',      mood: 'Morning' },
  { id: 't24', title: 'Terminal Rain',             artist: 'Open Lo-Fi', url: 'terminal-rain.mp3',             mood: 'Rain' },
  { id: 't25', title: 'Watercolors By the Window', artist: 'Open Lo-Fi', url: 'watercolors-by-the-window.mp3', mood: 'Chill' },
];

export const MOODS = ['All', 'Focus', 'Morning', 'Reading', 'Chill', 'Rain', 'Ambient', 'Late night'];

export const trackUrl = (track) => `/api/music/${track.url}`;
