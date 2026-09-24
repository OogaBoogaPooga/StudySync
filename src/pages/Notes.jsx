import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';

export default function Notes() {
  const { toast } = useApp();
  const [sets, setSets] = useState([]);
  const [title, setTitle] = useState('');

  const load = () => api('/sets').then(setSets).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try { await api('/sets', { method: 'POST', body: { title } }); setTitle(''); load(); } catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (s) => {
    if (!confirm(`Delete "${s.title}" and its flashcards?`)) return;
    try { await api(`/sets/${s.id}`, { method: 'DELETE' }); load(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Notes & Flashcards</h1><p className="text-sm text-muted-foreground">Notes, flashcards, and shareable links. No account needed to view.</p></div>
      <form onSubmit={create} className="flex gap-2"><Input placeholder="New study set title…" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} aria-label="New study set title" /><Button type="submit" variant="gradient"><Plus className="h-4 w-4" />Create</Button></form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((s) => (
          <Card key={s.id} className="group relative">
            <Link to={`/notes/${s.id}`} className="block focus-visible:ring-2 rounded-lg">
              <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />{s.title}</CardTitle><CardDescription>{s._count.cards} cards · updated {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}</CardDescription></CardHeader>
              <CardContent><div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: s.content ? s.content.replace(/<[^>]+>/g, ' ').slice(0, 160) : 'No notes yet' }} /></CardContent>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label={`Delete ${s.title}`} className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </Card>
        ))}
        {!sets.length && <p className="text-sm text-muted-foreground col-span-full py-10 text-center">Create your first study set above.</p>}
      </div>
    </div>
  );
}
