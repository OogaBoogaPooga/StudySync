import { useEffect, useState } from 'react';
import { Music2, Youtube, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';

const KEY = 'studysync_music_source';

export function readSourcePref() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{"type":"builtin"}');
  } catch {
    return { type: 'builtin' };
  }
}

// Helper to make sure pasted URLs work with the APIs
function parseSpotifyUrl(url) {
  if (!url) return '';
  if (url.startsWith('spotify:')) return url;
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return match ? `spotify:playlist:${match[1]}` : url;
}

function parseYouTubeUrl(url) {
  if (!url) return '';
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? `https://www.youtube.com/playlist?list=${match[1]}` : url;
}

export default function MusicSourcesDialog({ open, onClose }) {
  const [type, setType] = useState('builtin');
  const [spotify, setSpotify] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [youtube, setYoutube] = useState('');

  useEffect(() => {
    if (!open) return;
    const p = readSourcePref();
    setType(p.type || 'builtin');
    setSpotify(p.spotify || '');
    setSoundcloud(p.soundcloud || '');
    setYoutube(p.youtube || '');
  }, [open]);

  const save = () => {
    let payload = { type: 'builtin' };
    
    if (type === 'spotify') {
      payload = { type, spotify: parseSpotifyUrl(spotify) };
    } else if (type === 'youtube') {
      payload = { type, youtube: parseYouTubeUrl(youtube) };
    } else if (type === 'soundcloud') {
      payload = { type, soundcloud };
    }
    
    localStorage.setItem(KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('studysync:musicSourceChanged'));
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Music source" description="Choose where your study audio comes from." className="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['builtin', Music2, 'Built-in lo-fi'],
              ['spotify', Music2, 'Spotify'],
              ['soundcloud', Cloud, 'SoundCloud'],
              ['youtube', Youtube, 'YouTube'],
            ].map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setType(id)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  type === id ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {type === 'spotify' && (
            <div className="space-y-2">
              <Input placeholder="Paste Spotify Playlist Link..." value={spotify} onChange={(e) => setSpotify(e.target.value)} />
              <p className="text-[10px] text-muted-foreground px-1">We'll automatically extract the playlist ID.</p>
            </div>
          )}
          {type === 'soundcloud' && (
            <div className="space-y-2">
              <Input placeholder="Paste SoundCloud Set Link..." value={soundcloud} onChange={(e) => setSoundcloud(e.target.value)} />
            </div>
          )}
          {type === 'youtube' && (
            <div className="space-y-2">
              <Input placeholder="Paste YouTube Playlist Link..." value={youtube} onChange={(e) => setYoutube(e.target.value)} />
              <p className="text-[10px] text-muted-foreground px-1">Make sure the link contains a playlist (list=...).</p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="gradient" onClick={save}>Save Source</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
