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
    const payload =
      type === 'spotify' ? { type, spotify } :
      type === 'soundcloud' ? { type, soundcloud } :
      type === 'youtube' ? { type, youtube } :
      { type: 'builtin' };
    
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
            <Input placeholder="https://open.spotify.com/playlist/…" value={spotify} onChange={(e) => setSpotify(e.target.value)} />
          )}
          {type === 'soundcloud' && (
            <Input placeholder="https://soundcloud.com/…/sets/…" value={soundcloud} onChange={(e) => setSoundcloud(e.target.value)} />
          )}
          {type === 'youtube' && (
            <Input placeholder="https://www.youtube.com/playlist?list=…" value={youtube} onChange={(e) => setYoutube(e.target.value)} />
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="gradient" onClick={save}>Use this source</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
