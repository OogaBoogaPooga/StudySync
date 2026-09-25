import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, Play, Pencil, X } from 'lucide-react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import CollabEditor from '@/components/CollabEditor.jsx';
import { StudyMode } from './StudySet.jsx';

/** Public view of a shared study set — read-only by default, "edit together" opt-in. */
export default function SharedSet() {
  const { shareId } = useParams();
  const [set, setSet] = useState(null);
  const [error, setError] = useState('');
  const [study, setStudy] = useState(false);
  const [editorUser, setEditorUser] = useState(null); // { id, name } | null
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => { api(`/share/${shareId}`).then(setSet).catch((e) => setError(e.message)); }, [shareId]);

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
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-bold gradient-text">
            <Sparkles className="h-5 w-5 text-indigo-500" />StudySync
          </Link>
          {set && (
            editorUser ? (
              <Button variant="outline" size="sm" onClick={leaveEditor}>
                <X className="h-4 w-4" />Leave editor
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setNamePromptOpen(true)}>
                <Pencil className="h-4 w-4" />Edit together
              </Button>
            )
          )}
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
            description="Pick a name so other people editing this set can see who you are. Everyone with this link can join."
          >
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinAsEditor()}
                aria-label="Your name"
                maxLength={30}
              />
              <Button onClick={joinAsEditor} disabled={!nameInput.trim()} variant="gradient" className="w-full">
                Join editor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
