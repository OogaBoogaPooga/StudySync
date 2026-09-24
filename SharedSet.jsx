import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, Play } from 'lucide-react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { StudyMode } from './StudySet.jsx';

/** Public, read-only view of a shared study set */
export default function SharedSet() {
  const { shareId } = useParams();
  const [set, setSet] = useState(null);
  const [error, setError] = useState('');
  const [study, setStudy] = useState(false);

  useEffect(() => { api(`/share/${shareId}`).then(setSet).catch((e) => setError(e.message)); }, [shareId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-violet-50 to-sky-50 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 p-4 md:p-10">
      <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
        <Link to="/" className="inline-flex items-center gap-2 font-bold gradient-text"><Sparkles className="h-5 w-5 text-indigo-500" />StudySync</Link>
        {error && <Card><CardContent className="p-6 text-destructive">{error}</CardContent></Card>}
        {set && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-2xl">{set.title}</CardTitle><CardDescription>Shared by {set.author} · {set.cards.length} flashcards</CardDescription></CardHeader>
              <CardContent><div className="prose-editor text-sm" dangerouslySetInnerHTML={{ __html: set.content || '<p><i>No notes in this set.</i></p>' }} /></CardContent>
            </Card>
            {set.cards.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-center justify-between"><CardTitle>Flashcards</CardTitle><Button variant="gradient" size="sm" onClick={() => setStudy(true)}><Play className="h-4 w-4" />Study</Button></CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">{set.cards.map((c) => <div key={c.id} className="rounded-md border bg-card p-3 text-sm"><p className="font-medium">{c.front}</p><p className="text-muted-foreground mt-1">{c.back}</p></div>)}</CardContent>
              </Card>
            )}
            {study && <StudyMode cards={set.cards} onClose={() => setStudy(false)} />}
          </>
        )}
      </div>
    </div>
  );
}
