import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Link2, Sparkles, Share2, Plus, Trash2, ArrowLeft, Play } from 'lucide-react';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Textarea, Label } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';

export default function StudySet() {
  const { id } = useParams();
  const { toast } = useApp();
  const [set, setSet] = useState(null);
  const [saving, setSaving] = useState('');
  const [card, setCard] = useState({ front: '', back: '' });
  const [aiOpen, setAiOpen] = useState(false);
  const [study, setStudy] = useState(false);
  const editorRef = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    api(`/sets/${id}`).then((s) => { setSet(s); if (editorRef.current) editorRef.current.innerHTML = s.content; }).catch((e) => toast(e.message, 'error'));
  }, [id]);

  // Debounced auto-save of rich text content
  const onInput = useCallback(() => {
    clearTimeout(saveTimer.current);
    setSaving('Saving…');
    saveTimer.current = setTimeout(async () => {
      try { await api(`/sets/${id}`, { method: 'PUT', body: { content: editorRef.current.innerHTML } }); setSaving('Saved'); }
      catch (e) { setSaving('Save failed'); toast(e.message, 'error'); }
    }, 800);
  }, [id]);

  // Rich text commands via contentEditable
  const exec = (cmd, val) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); onInput(); };
  const addLink = () => { const url = prompt('Link URL (https://…)'); if (url && /^https?:\/\//.test(url)) exec('createLink', url); };

  const addCard = async (e) => {
    e.preventDefault();
    try { const c = await api(`/sets/${id}/cards`, { method: 'POST', body: card }); setSet({ ...set, cards: [...set.cards, c] }); setCard({ front: '', back: '' }); }
    catch (err) { toast(err.message, 'error'); }
  };
  const removeCard = async (c) => {
    try { await api(`/sets/${id}/cards/${c.id}`, { method: 'DELETE' }); setSet({ ...set, cards: set.cards.filter((x) => x.id !== c.id) }); } catch (err) { toast(err.message, 'error'); }
  };
  const share = async () => {
    const url = `${location.origin}/share/${set.shareId}`;
    try { await navigator.clipboard.writeText(url); toast('Share link copied!'); } catch { prompt('Copy this link:', url); }
  };

  if (!set) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Link to="/notes" className="rounded-md p-1 hover:bg-accent" aria-label="Back to notes"><ArrowLeft className="h-5 w-5" /></Link>
          <input aria-label="Set title" defaultValue={set.title} onBlur={(e) => e.target.value !== set.title && api(`/sets/${id}`, { method: 'PUT', body: { title: e.target.value } }).then(() => toast('Title saved')).catch((err) => toast(err.message, 'error'))} className="bg-transparent text-2xl font-bold outline-none focus:border-b border-primary" /></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />Share</Button>
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4 text-violet-500" />AI flashcards</Button>
          <Button variant="gradient" size="sm" disabled={!set.cards.length} onClick={() => setStudy(true)}><Play className="h-4 w-4" />Study ({set.cards.length})</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <Card>
          <CardHeader className="pb-2"><div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
            <Tool onClick={() => exec('bold')} label="Bold"><Bold className="h-4 w-4" /></Tool>
            <Tool onClick={() => exec('italic')} label="Italic"><Italic className="h-4 w-4" /></Tool>
            <Tool onClick={() => exec('underline')} label="Underline"><Underline className="h-4 w-4" /></Tool>
            <Tool onClick={() => exec('formatBlock', 'H2')} label="Heading"><Heading2 className="h-4 w-4" /></Tool>
            <Tool onClick={() => exec('insertUnorderedList')} label="Bullet list"><List className="h-4 w-4" /></Tool>
            <Tool onClick={() => exec('insertOrderedList')} label="Numbered list"><ListOrdered className="h-4 w-4" /></Tool>
            <Tool onClick={addLink} label="Insert link"><Link2 className="h-4 w-4" /></Tool>
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">{saving}</span>
          </div></CardHeader>
          <CardContent>
            <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Notes editor" onInput={onInput}
              className="prose-editor min-h-[360px] rounded-md border bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring" data-placeholder="Start typing your notes…" />
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
                <div key={c.id} className="group rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-medium">{c.front}</p><button onClick={() => removeCard(c)} aria-label="Delete card" className="opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-4 w-4 text-destructive" /></button></div><p className="text-muted-foreground mt-1">{c.back}</p></div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <AIDialog open={aiOpen} onClose={() => setAiOpen(false)} setId={id} initialText={() => editorRef.current?.innerText || ''} onAdded={(cards) => setSet((s) => ({ ...s, cards }))} />
      {study && <StudyMode cards={set.cards} onClose={() => setStudy(false)} />}
    </div>
  );
}

const Tool = ({ onClick, label, children }) => <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} aria-label={label} title={label} className="rounded-md p-2 hover:bg-accent">{children}</button>;

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
    try { const cards = await api(`/sets/${setId}/cards/bulk`, { method: 'POST', body: { cards: preview.cards } }); onAdded(cards); toast(`${preview.cards.length} cards added`); onClose(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Generate flashcards" description="Paste notes below. Uses AI when an API key is configured, otherwise a smart offline extractor.">
        <div className="space-y-3">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Notes to summarize" />
          <Button onClick={generate} disabled={busy || text.trim().length < 20} variant="gradient" className="w-full"><Sparkles className="h-4 w-4" />{busy ? 'Thinking…' : 'Generate'}</Button>
          {preview && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{preview.cards.length} cards · source: {preview.source === 'ai' ? 'AI' : 'offline extractor'}</p>
              <div className="max-h-56 overflow-y-auto space-y-1.5">{preview.cards.map((c, i) => <div key={i} className="rounded border p-2 text-xs"><b>{c.front}</b><br />{c.back}</div>)}</div>
              <Button onClick={save} className="w-full">Add all to set</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Flip-card study mode with keyboard support (Space = flip, arrows = navigate) */
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
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [cards.length]);
  const c = cards[i];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Card ${i + 1} of ${cards.length}`} description="Click or press Space to flip · ← → to navigate" className="max-w-xl">
        <button onClick={() => setFlipped(!flipped)} className="w-full min-h-[220px] rounded-xl border p-6 text-lg font-medium shadow-inner transition-all duration-300 [transform-style:preserve-3d]" style={{ background: flipped ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : undefined, color: flipped ? 'white' : undefined }} aria-live="polite">
          <span className="block text-xs uppercase tracking-wide opacity-60 mb-2">{flipped ? 'Answer' : 'Question'}</span>{flipped ? c.back : c.front}
        </button>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => { setI((i - 1 + cards.length) % cards.length); setFlipped(false); }}>Previous</Button>
          <Button variant="gradient" onClick={() => { setI((i + 1) % cards.length); setFlipped(false); }}>Next</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
