import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Sparkles, Play, Pencil, X, Save, Check, Loader2 } from 'lucide-react';
import { api, saveSharedSet } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import CollabEditor from '@/components/CollabEditor.jsx';
import { StudyMode } from './StudySet.jsx';

export default function SharedSet() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user, toast } = useApp();

  const [set, setSet] = useState(null);
  const [error, setError] = useState('');
  const [study, setStudy] = useState(false);
  const [editorUser, setEditorUser] = useState(null);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState('');

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [savedSetId, setSavedSetId] = useState(null);

  const saveTimer = useRef(null);

  useEffect(() => {
    api(`/share/${shareId}`).then(setSet).catch((e) => setError(e.message));
  }, [shareId]);

  const handleContentChange = useCallback((html) => {
    clearTimeout(saveTimer.current);
    setSaving('Saving…');
    saveTimer.current = setTimeout(async () => {
      try {
        await api(`/share/${shareId}/content`, { method: 'PUT', body: { content: html } });
        setSaving('Saved');
      } catch (e) {
        setSaving('Save failed');
      }
    }, 800);
  }, [shareId]);

  const openSaveDialog = () => {
    if (!set) return;
    setSaveTitle(set.title || 'Shared set');
    setSavedSetId(null);
    setSaveOpen(true);
  };

  const confirmSave = async () => {
    setSaveBusy(true);
    try {
      const res = await saveSharedSet(shareId, saveTitle.trim() || undefined);
      if (res.copied) toast(`Saved "${res.set.title}" to your library`);
      else toast(res.message || 'Already in your library');
      setSavedSetId(res.set.id);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaveBusy(false);
    }
  };

  const joinAsEditor = () => {
    const name = nameInput.trim();
    if (!name) return;
    const id = `${shareId}-${name.toLowerCase().replace(/\s+/g, '-')}`;
    setEditorUser({ id, name });
    setNamePromptOpen(false);
    setNameInput('');
  };

  const leaveEditor = () => {
    if (!confirm('Stop editing? Your changes are already saved.')) return;
    setEditorUser(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-10">
      <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex items-center gap-2 font-bold gradient-text">
            <Sparkles className="h-5 w-5 text-indigo-500" />StudySync
          </Link>
          <div className="flex gap-1.5">
            {set && (
              <>
                {editorUser ? (
                  <Button variant="outline" size="sm" onClick={leaveEditor}>
                    <X className="h-4 w-4" />Leave editor
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setNamePromptOpen(true)}>
                    <Pencil className="h-4 w-4" />Edit together
                  </Button>
                )}
                <Button variant="gradient" size="sm" onClick={openSaveDialog}>
                  <Save className="h-4 w-4" />Save to my sets
                </Button>
              </>
            )}
          </div>
        </div>

        {error && <Card><CardContent className="p-6 text-destructive">{error}</CardContent></Card>}

        {set && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{set.title}</CardTitle>
                <CardDescription>
                  Shared by {set.author} · {set.cards.length} flashcards
                  {editorUser && <span className="ml-2 text-primary">· editing as {editorUser.name}</span>}
                  {!editorUser && saving && <span className="ml-2">{saving}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {editorUser ? (
                  <CollabEditor
                    setId={set.id}
                    initialContent={set.content}
                    onContentChange={handleContentChange}
                    extraToolbar={<span aria-live="polite">{saving}</span>}
                    user={editorUser}
                  />
                ) : (
                  <div className="prose-editor text-sm" dangerouslySetInnerHTML={{ __html: set.content || '<p><i>No notes in this set.</i></p>' }} />
                )}
              </CardContent>
            </Card>

            {set.cards.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Flashcards</CardTitle>
                  <Button variant="gradient" size="sm" onClick={() => setStudy(true)}>
                    <Play className="h-4 w-4" />Study
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {set.cards.map((c) => (
                    <div key={c.id} className="rounded-md border bg-card p-3 text-sm">
                      <p className="font-medium">{c.front}</p>
                      <p className="text-muted-foreground mt-1">{c.back}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {study && <StudyMode cards={set.cards} onClose={() => setStudy(false)} />}
          </>
        )}

        <Dialog open={namePromptOpen} onOpenChange={(o) => !o && setNamePromptOpen(false)}>
          <DialogContent
            title="Edit together"
            description="Pick a name so other people editing this set can see who you are."
          >
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinAsEditor()}
                maxLength={30}
              />
              <Button onClick={joinAsEditor} disabled={!nameInput.trim()} variant="gradient" className="w-full">
                Join editor
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={saveOpen} onOpenChange={(o) => { if (!saveBusy) { setSaveOpen(o); if (!o) setSavedSetId(null); } }}>
          <DialogContent
            title={savedSetId ? 'Saved to your sets' : 'Save to my sets'}
            description={savedSetId
              ? 'Your copy is ready. It includes the notes and every flashcard.'
              : 'This creates a copy in your account.'}
          >
            {savedSetId ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15">
                    <Check className="h-4 w-4 text-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{saveTitle}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {set?.cards?.length || 0} flashcard{(set?.cards?.length || 0) === 1 ? '' : 's'} · notes included
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="gradient" onClick={() => navigate(`/notes/${savedSetId}`)} className="flex-1">
                    Open my copy
                  </Button>
                  <Button variant="ghost" onClick={() => { setSaveOpen(false); setSavedSetId(null); }}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Title in your library
                  </label>
                  <Input
                    autoFocus
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !saveBusy && confirmSave()}
                    maxLength={100}
                    placeholder={set?.title || 'My copy'}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {set?.cards?.length || 0} flashcard{(set?.cards?.length || 0) === 1 ? '' : 's'} will be copied.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={confirmSave} disabled={saveBusy || !saveTitle.trim()} variant="gradient" className="flex-1">
                    {saveBusy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save to my sets</>}
                  </Button>
                  <Button variant="ghost" onClick={() => setSaveOpen(false)} disabled={saveBusy}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
