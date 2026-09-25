import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Sparkles, Upload, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Textarea } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';

export default function Notes() {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [sets, setSets] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const load = () =>
    api('/sets')
      .then((d) => setSets(Array.isArray(d) ? d : []))
      .catch((e) => { toast(e.message, 'error'); setSets([]); });

  useEffect(() => { load(); }, []);

  const cardCount = (s) => s._count?.cards ?? s.cards?.length ?? 0;

  const removeSet = async (s) => {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    try {
      await api(`/sets/${s.id}`, { method: 'DELETE' });
      setSets((list) => list.filter((x) => x.id !== s.id));
      toast('Set deleted');
    } catch (e) { toast(e.message, 'error'); }
  };

  const createBlank = async (title) => {
    try {
      const created = await api('/sets', { method: 'POST', body: { title, content: '' } });
      navigate(`/notes/${created.id}`);
    } catch (e) { toast(e.message, 'error'); }
  };

  const createFromAI = async (result) => {
    try {
      const created = await api('/sets', {
        method: 'POST',
        body: { title: result.title || 'AI notes', content: result.html || '' },
      });
      toast('Notes created');
      navigate(`/notes/${created.id}`);
    } catch (e) { toast(e.message, 'error'); }
  };

  if (sets === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground">
            {sets.length} study {sets.length === 1 ? 'set' : 'sets'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4 text-violet-500" />AI notes
          </Button>
          <Button variant="gradient" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />New set
          </Button>
        </div>
      </div>

      {sets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium">No study sets yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first set, or generate notes from a PDF, DOCX, or pasted text.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setAiOpen(true)}>
                <Sparkles className="h-4 w-4 text-violet-500" />AI notes
              </Button>
              <Button variant="gradient" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" />New set
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <Card key={s.id} className="group transition-all hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    <Link to={`/notes/${s.id}`} className="hover:underline">{s.title}</Link>
                  </CardTitle>
                  <button
                    onClick={() => removeSet(s)}
                    className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/10"
                    aria-label="Delete set"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
                <CardDescription className="text-xs">
                  {cardCount(s)} card{cardCount(s) === 1 ? '' : 's'}
                  {s.updatedAt && ` · ${format(new Date(s.updatedAt), 'MMM d')}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Link
                  to={`/notes/${s.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewSetDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={createBlank} />
      <AINotesDialog open={aiOpen} onClose={() => setAiOpen(false)} onCreated={createFromAI} />
    </div>
  );
}

function NewSetDialog({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  useEffect(() => { if (open) setTitle(''); }, [open]);
  const submit = () => { if (title.trim()) { onCreate(title.trim()); onClose(); } };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="New study set" description="Give your notes a title. You can rename it later.">
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="e.g. APUSH Chapter 5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-label="Set title"
          />
          <Button onClick={submit} disabled={!title.trim()} variant="gradient" className="w-full">Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AINotesDialog({ open, onClose, onCreated }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (open) setText(''); }, [open]);

  const generateFromText = async () => {
    setBusy(true);
    try {
      const result = await api('/ai/notes', { method: 'POST', body: { text } });
      await onCreated(result);
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('studysync_token');
      const res = await fetch('/api/ai/notes/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      await onCreated(data);
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="AI notes" description="Paste source text or upload a .docx, .pdf, .pptx, or .txt file.">
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.pdf,.pptx,.txt"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Reading file…</> : <><Upload className="h-4 w-4" />Upload file</>}
          </Button>
          <div className="relative text-center">
            <span className="relative z-10 bg-card px-2 text-xs text-muted-foreground">or paste text</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste lecture notes, textbook passages, etc."
            aria-label="Source text"
          />
          <Button onClick={generateFromText} disabled={busy || text.trim().length < 50} variant="gradient" className="w-full">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate notes</>}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Generates 1–2 sentence entries per term in APUSH-style format.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
