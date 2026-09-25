import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, Share2, Plus, Trash2, ArrowLeft, Play } from 'lucide-react';
import { api, generateQuiz } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Textarea } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import CollabEditor from '@/components/CollabEditor.jsx';

export default function StudySet() {
  const { id } = useParams();
  const { toast } = useApp();
  const navigate = useNavigate();
  const [quizBusy, setQuizBusy] = useState(false);
  const [set, setSet] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState('');
  const [card, setCard] = useState({ front: '', back: '' });
  const [aiOpen, setAiOpen] = useState(false);
  const [study, setStudy] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    api(`/sets/${id}`)
      .then((data) => { if (!cancelled) setSet(data); })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e.message || 'Failed to load this set');
        toast(e.message, 'error');
      });
    return () => { cancelled = true; };
  }, [id, toast]);

  const handleContentChange = useCallback((html) => {
    clearTimeout(saveTimer.current);
    setSaving('Saving…');
    saveTimer.current = setTimeout(async () => {
      try {
        await api(`/sets/${id}`, { method: 'PUT', body: { content: html } });
        setSaving('Saved');
      } catch (e) {
        setSaving('Save failed');
        toast(e.message, 'error');
      }
    }, 800);
  }, [id, toast]);

  const addCard = async (e) => {
    e.preventDefault();
    try {
      const c = await api(`/sets/${id}/cards`, { method: 'POST', body: card });
      setSet({ ...set, cards: [...set.cards, c] });
      setCard({ front: '', back: '' });
    } catch (err) { toast(err.message, 'error'); }
  };
  const removeCard = async (c) => {
    try {
      await api(`/sets/${id}/cards/${c.id}`, { method: 'DELETE' });
      setSet({ ...set, cards: set.cards.filter((x) => x.id !== c.id) });
    } catch (err) { toast(err.message, 'error'); }
  };
  const takeQuiz = async () => {
    setQuizBusy(true);
    try {
      const res = await generateQuiz(id, 10, ['mcq', 'short']);
      const quizId = res.quiz?.id || res.id;
      navigate(`/quiz/${quizId}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setQuizBusy(false);
    }
  };
  const share = async () => {
    if (!set?.shareId) return;
    const url = `${location.origin}/share/${set.shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Share link copied!');
    } catch { prompt('Copy this link:', url); }
  };

  if (loadError) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Couldn't load this set</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        </div>
        <Link to="/notes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to notes
        </Link>
      </div>
    );
  }

  if (!set) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/notes" className="rounded-md p-1 hover:bg-accent" aria-label="Back to notes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <input
            aria-label="Set title"
            defaultValue={set.title}
            onBlur={(e) => e.target.value !== set.title && api(`/sets/${id}`, { method: 'PUT', body: { title: e.target.value } }).then(() => toast('Title saved')).catch((err) => toast(err.message, 'error'))}
            className="bg-transparent text-2xl font-bold outline-none focus:border-b border-primary"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />Share</Button>
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4 text-violet-500" />AI flashcards</Button>
          <Button variant="outline" size="sm" disabled={!set.cards.length || quizBusy} onClick={takeQuiz}>
            {quizBusy ? 'Generating…' : 'AI Quiz'}
          </Button>
          <Button variant="gradient" size="sm" disabled={!set.cards.length} onClick={() => setStudy(true)}>
            <Play className="h-4 w-4" />Study ({set.cards.length})
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <Card>
          <CardContent className="pt-6">
            <CollabEditor
              setId={id}
              initialContent={set.content}
              onContentChange={handleContentChange}
              extraToolbar={<span aria-live="polite">{saving}</span>}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add flashcard</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addCard} className="space-y-2">
                <Input required placeholder="Front (question)" value={card.front} onChange={(e) => setCard({ ...card, front: e.target.value })} aria-label="Card front" />
                <Textarea required rows={2} placeholder="Back (answer)" value={card.back} onChange={(e) => setCard({ ...card, back: e.target.value })} aria-label="Card back" />
                <Button type="submit" className="w-full" size="sm"><Plus className="h-4 w-4" />Add card</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cards</CardTitle><CardDescription>{set.cards.length} in this set</CardDescription></CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
              {set.cards.map((c) => (
                <div key={c.id} className="group rounded-md border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{c.front}</p>
                    <button onClick={() => removeCard(c)} aria-label="Delete card" className="opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                  <p className="text-muted-foreground mt-1">{c.back}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <AIDialog open={aiOpen} onClose={() => setAiOpen(false)} setId={id} initialText={() => ''} onAdded={(cards) => setSet((s) => ({ ...s, cards }))} />
      {study && <StudyMode cards={set.cards} onClose={() => setStudy(false)} />}
    </div>
  );
}

function AIDialog({ open, onClose, setId, initialText, onAdded }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setText(initialText()); setPreview(null); } }, [open]);

  const generate = async () => {
    setBusy(true);
    try { const r = await api('/ai/flashcards', { method: 'POST', body: { text } }); setPreview(r); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const save = async () => {
    try {
      const cards = await api(`/sets/${setId}/cards/bulk`, { method: 'POST', body: { cards: preview.cards } });
      onAdded(cards);
      toast(`${preview.cards.length} cards added`);
      onClose();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Generate flashcards" description="Paste notes below. Uses AI when an API key is configured, otherwise a smart offline extractor.">
        <div className="space-y-3">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Notes to summarize" />
          <Button onClick={generate} disabled={busy || text.trim().length < 20} variant="gradient" className="w-full">
            <Sparkles className="h-4 w-4" />{busy ? 'Thinking…' : 'Generate'}
          </Button>
          {preview && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{preview.cards.length} cards · source: {preview.source === 'ai' ? 'AI' : 'offline extractor'}</p>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {preview.cards.map((c, i) => (
                  <div key={i} className="rounded border p-2 text-xs"><b>{c.front}</b><br />{c.back}</div>
                ))}
              </div>
              <Button onClick={save} className="w-full">Add all to set</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StudyMode({ cards, onClose }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === 'ArrowRight') { setI((x) => (x + 1) % cards.length); setFlipped(false); }
      if (e.key === 'ArrowLeft') { setI((x) => (x - 1 + cards.length) % cards.length); setFlipped(false); }
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [cards.length, onClose]);
  const c = cards[i];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Card ${i + 1} of ${cards.length}`} description="Click or press Space to flip · ← → to navigate" className="max-w-xl">
        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full min-h-[220px] rounded-xl border p-6 text-lg font-medium shadow-inner transition-all duration-300 [transform-style:preserve-3d]"
          style={{ background: flipped ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : undefined, color: flipped ? 'white' : undefined }}
          aria-live="polite"
        >
          <span className="block text-xs uppercase tracking-wide opacity-60 mb-2">{flipped ? 'Answer' : 'Question'}</span>
          {flipped ? c.back : c.front}
        </button>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => { setI((i - 1 + cards.length) % cards.length); setFlipped(false); }}>Previous</Button>
          <Button variant="gradient" onClick={() => { setI((i + 1) % cards.length); setFlipped(false); }}>Next</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
