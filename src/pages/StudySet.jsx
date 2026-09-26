import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, Share2, Plus, Trash2, ArrowLeft, Play, Clock } from 'lucide-react';
import { api, generateQuiz, reviewCard } from '@/lib/api.js';
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

  const now = new Date();
  const dueCount = set.cards.filter((c) => !c.dueAt || new Date(c.dueAt) <= now).length;

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
            <Play className="h-4 w-4" />Study {dueCount > 0 ? `(${dueCount} due)` : `(${set.cards.length})`}
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
            <CardHeader>
              <CardTitle>Cards</CardTitle>
              <CardDescription>
                {set.cards.length} in this set
                {dueCount > 0 && <span className="ml-2 text-primary">· {dueCount} due</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
              {set.cards.map((c) => {
                const dueNow = !c.dueAt || new Date(c.dueAt) <= now;
                const stateLabel = c.state === 'mastered' ? 'Mastered'
                  : c.state === 'review' ? `Review · ${Math.round(c.interval)}d`
                  : c.state === 'learning' ? 'Learning'
                  : dueNow ? 'New' : `Next in ${Math.max(1, Math.round((new Date(c.dueAt) - now) / (24 * 60 * 60 * 1000)))}d`;
                return (
                  <div key={c.id} className="group rounded-md border p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{c.front}</p>
                      <button onClick={() => removeCard(c)} aria-label="Delete card" className="opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                    <p className="text-muted-foreground mt-1">{c.back}</p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {stateLabel}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <AIDialog open={aiOpen} onClose={() => setAiOpen(false)} setId={id} initialText={() => ''} onAdded={(cards) => setSet((s) => ({ ...s, cards }))} />
      {study && (
        <StudyMode
          cards={set.cards}
          setId={id}
          onClose={() => setStudy(false)}
          onCardReviewed={(updated) => setSet((s) => s && ({ ...s, cards: s.cards.map((c) => (c.id === updated.id ? updated : c)) }))}
        />
      )}
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

export function StudyMode({ cards, setId, onClose, onCardReviewed }) {
  const [mode, setMode] = useState(null);
  const [queue, setQueue] = useState([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const now = new Date();
  const isDue = (c) => !c.dueAt || new Date(c.dueAt) <= now;
  const dueCount = cards.filter(isDue).length;
  const newCount = cards.filter((c) => c.state === 'new' || !c.state).length;

  useEffect(() => {
    if (mode !== null) return;
    if (dueCount > 0) setMode('due');
    else if (cards.length > 0) setMode('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'due') setQueue(cards.filter(isDue));
    else if (mode === 'all') setQueue([...cards]);
    else if (mode === 'done') setQueue([]);
    setI(0);
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const current = queue[i];
  const progress = queue.length ? (i / queue.length) * 100 : 0;

  const rate = async (grade) => {
    if (busy || !current || !setId) return;
    setBusy(true);
    try {
      const updated = await reviewCard(setId, current.id, grade);
      onCardReviewed?.(updated);
      setReviewedCount((n) => n + 1);
      setFlipped(false);
      if (i + 1 >= queue.length) {
        setMode('done');
      } else {
        setI(i + 1);
      }
    } catch {
      // silently skip; card stays in queue
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (mode !== 'due' && mode !== 'all') return;
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); return; }
      if (!flipped) return;
      if (e.key === '1') rate('again');
      if (e.key === '2') rate('hard');
      if (e.key === '3') rate('good');
      if (e.key === '4') rate('easy');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, mode, current?.id, i, queue.length]);

  if (mode === null) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent title="Study" description="Choose what to review" className="max-w-md">
          <div className="space-y-2">
            <Button onClick={() => setMode('due')} disabled={dueCount === 0} variant="gradient" className="w-full justify-start">
              Study due ({dueCount})
            </Button>
            <Button onClick={() => setMode('all')} variant="outline" className="w-full justify-start">
              Study all ({cards.length})
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {newCount > 0 ? `${newCount} new card${newCount === 1 ? '' : 's'} · ` : ''}
            Cards you rate will be scheduled based on how well you know them.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === 'done') {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent title="Session complete" description={`You reviewed ${reviewedCount} card${reviewedCount === 1 ? '' : 's'}.`} className="max-w-md">
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-3xl font-bold">{reviewedCount}</p>
              <p className="text-xs text-muted-foreground">cards reviewed</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setReviewedCount(0); setMode('due'); }} disabled={dueCount === 0} className="flex-1">
                Study due again
              </Button>
              <Button variant="gradient" onClick={onClose} className="flex-1">Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!current) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent title="Nothing to review" description="You're all caught up." className="max-w-md">
          <Button variant="gradient" onClick={onClose} className="w-full">Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Card ${i + 1} of ${queue.length}`}
        description="Space to flip · 1–4 to rate · Esc to close"
        className="max-w-xl"
      >
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full min-h-[220px] rounded-xl border p-6 text-lg font-medium shadow-inner transition-all duration-300"
          style={{
            background: flipped ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : undefined,
            color: flipped ? 'white' : undefined,
          }}
          aria-live="polite"
        >
          <span className="block text-xs uppercase tracking-wide opacity-60 mb-2">
            {flipped ? 'Answer' : 'Question'}
          </span>
          {flipped ? current.back : current.front}
        </button>

        {flipped ? (
          <div className="mt-4 grid grid-cols-4 gap-2">
            <Button variant="outline" onClick={() => rate('again')} disabled={busy} className="border-red-500/40 text-red-500 hover:bg-red-500/10">Again</Button>
            <Button variant="outline" onClick={() => rate('hard')} disabled={busy} className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10">Hard</Button>
            <Button variant="outline" onClick={() => rate('good')} disabled={busy} className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10">Good</Button>
            <Button variant="outline" onClick={() => rate('easy')} disabled={busy} className="border-sky-500/40 text-sky-500 hover:bg-sky-500/10">Easy</Button>
          </div>
        ) : (
          <div className="mt-4 flex justify-center">
            <Button variant="gradient" onClick={() => setFlipped(true)}>Show answer</Button>
          </div>
        )}

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {current.state === 'new' || !current.state ? 'New card' : null}
          {current.state === 'learning' ? 'Learning' : null}
          {current.state === 'review' ? `Review · interval ${Math.round(current.interval)}d` : null}
          {current.state === 'mastered' ? 'Mastered' : null}
        </p>
      </DialogContent>
    </Dialog>
  );
}
