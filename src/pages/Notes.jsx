import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Layers, Trash2, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Textarea, Label } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';

export default function Notes() {
  const { toast } = useApp();
  const nav = useNavigate();
  const [sets, setSets] = useState([]);
  const [title, setTitle] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const load = () => api('/sets').then(setSets).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const s = await api('/sets', { method: 'POST', body: { title } });
      setTitle('');
      nav(`/notes/${s.id}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  const remove = async (s) => {
    if (!confirm(`Delete "${s.title}" and its flashcards?`)) return;
    try { await api(`/sets/${s.id}`, { method: 'DELETE' }); load(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Notes & Flashcards</h1>
          <p className="text-sm text-muted-foreground">Write notes, generate flashcards, share sets with a link.</p>
        </div>
        <Button variant="outline" onClick={() => setAiOpen(true)}>
          <Sparkles className="h-4 w-4" />AI notes maker
        </Button>
      </div>

      <form onSubmit={create} className="flex gap-2">
        <Input placeholder="New study set title…" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} aria-label="New study set title" />
        <Button type="submit" variant="gradient"><Plus className="h-4 w-4" />Create</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((s) => (
          <Card key={s.id} className="group relative">
            <Link to={`/notes/${s.id}`} className="block focus-visible:ring-2 rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />{s.title}</CardTitle>
                <CardDescription>{s._count.cards} cards · updated {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: s.content ? s.content.replace(/<[^>]+>/g, ' ').slice(0, 160) : 'No notes yet' }} />
              </CardContent>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label={`Delete ${s.title}`} className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </Card>
        ))}
        {!sets.length && <p className="text-sm text-muted-foreground col-span-full py-10 text-center">Create your first study set above.</p>}
      </div>

      <AINotesDialog open={aiOpen} onClose={() => setAiOpen(false)} onCreated={(set) => { setAiOpen(false); nav(`/notes/${set.id}`); }} />
    </div>
  );
}

function AINotesDialog({ open, onClose, onCreated }) {
  const { toast } = useApp();
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => { if (open) { setSource(''); setResult(null); setTitle(''); setBusy(false); } }, [open]);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api('/ai/notes', { method: 'POST', body: { text: source } });
      setResult(r);
      setTitle(r.title);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const save = async () => {
    try {
      const s = await api('/sets', { method: 'POST', body: { title: title || 'AI notes' } });
      await api(`/sets/${s.id}`, { method: 'PUT', body: { content: result.html } });
      toast('Study set created');
      onCreated(s);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="AI notes maker" description="Paste an article, textbook section, or transcript. AI turns it into an organized study guide." className="max-w-2xl">
        {!result ? (
          <div className="space-y-3">
            <Textarea rows={10} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Paste your source material here…" aria-label="Source text" />
            <Button onClick={generate} disabled={busy || source.trim().length < 50} variant="gradient" className="w-full">
              <Sparkles className="h-4 w-4" />{busy ? 'Reading…' : 'Generate notes'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Needs at least a paragraph of source text.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ai-title">Title</Label>
              <Input id="ai-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-md border bg-card p-4 prose-editor text-sm" dangerouslySetInnerHTML={{ __html: result.html }} />
            <p className="text-xs text-muted-foreground">Source: {result.source === 'ai' ? 'AI' : 'offline extractor'}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>Start over</Button>
              <Button variant="gradient" className="flex-1" onClick={save}>Save as new study set</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
