import { useEffect, useState } from 'react';
import { Loader2, ClipboardPaste, Check } from 'lucide-react';
import { api, updateClass, parseGradesFromText } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/input.jsx';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function PasteGradesDialog({ open, onClose, existingClasses = [], onImported }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) return;
    setText('');
    setResults(null);
    setSelected(new Set());
    setError('');
    setParsing(false);
    setImporting(false);
  }, [open]);

  const parse = async () => {
    if (text.trim().length < 10) return;
    setParsing(true);
    setError('');
    try {
      const data = await parseGradesFromText(text);
      const classes = data.classes || [];
      setResults(classes);
      setSelected(new Set(classes.map((c) => c.name)));
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  };

  const toggle = (name) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const doImport = async () => {
    if (!results) return;
    const chosen = results.filter((c) => selected.has(c.name));
    if (!chosen.length) return;
    setImporting(true);
    try {
      let created = 0;
      let updated = 0;
      for (const c of chosen) {
        const existing = existingClasses.find(
          (k) => k.name.toLowerCase() === c.name.toLowerCase()
        );
        if (existing) {
          await updateClass(existing.id, {
            snapshotScore: c.pct,
            snapshotMax: 100,
            snapshotUpdatedAt: new Date().toISOString(),
            snapshotSource: 'paste',
          });
          updated++;
        } else {
          const color = COLORS[created % COLORS.length];
          const fresh = await api('/classes', {
            method: 'POST',
            body: { name: c.name, color, credits: 1 },
          });
          await updateClass(fresh.id, {
            snapshotScore: c.pct,
            snapshotMax: 100,
            snapshotUpdatedAt: new Date().toISOString(),
            snapshotSource: 'paste',
          });
          created++;
        }
      }
      toast(`Imported ${created} new · updated ${updated}`);
      onImported?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  const totalSelected = results ? results.filter((c) => selected.has(c.name)).length : 0;
  const stage = results ? 'results' : 'input';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Import grades"
        description="Select your grades on your school portal, copy them, and paste below. We'll parse them."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {stage === 'input' && (
            <>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">How to copy your grades:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>Open your grade portal in another tab</li>
                  <li>Click the first class, hold <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Shift</kbd>, click the last class</li>
                  <li>Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl/Cmd+C</kbd></li>
                  <li>Paste into the box below</li>
                </ol>
                <p className="mt-2">The AI reads whatever format your portal uses — percentages, fractions, or letter grades.</p>
              </div>
              <Textarea
                rows={8}
                value={text}
                onChange={(e) => { setText(e.target.value); setError(''); }}
                placeholder={`Paste here. Example:\n\nAP Chem      94.27%    A\nAPUSH        87.86%    B+\nAlgebra 2    91.00%    A-`}
                aria-label="Pasted grades"
                autoFocus
              />
            </>
          )}

          {stage === 'results' && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                Found {results.length} {results.length === 1 ? 'class' : 'classes'}. Uncheck any you don't want.
              </p>
              <div className="space-y-1">
                {results.map((c) => {
                  const existing = existingClasses.find(
                    (k) => k.name.toLowerCase() === c.name.toLowerCase()
                  );
                  return (
                    <label
                      key={c.name}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm transition-colors hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.name)}
                        onChange={() => toggle(c.name)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {existing ? `Will update existing "${existing.name}"` : 'Will create new class'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-medium">
                        {c.pct.toFixed(1)}%
                        {c.letter && <span className="ml-1.5 text-muted-foreground">{c.letter}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-2 border-t pt-3">
            <div>
              {stage === 'results' && (
                <Button variant="ghost" onClick={() => { setResults(null); setSelected(new Set()); }} disabled={importing}>
                  Edit paste
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={parsing || importing}>
                Cancel
              </Button>
              {stage === 'input' && (
                <Button onClick={parse} disabled={parsing || text.trim().length < 10} variant="gradient">
                  {parsing ? <><Loader2 className="h-4 w-4 animate-spin" />Parsing…</> : <><ClipboardPaste className="h-4 w-4" />Parse</>}
                </Button>
              )}
              {stage === 'results' && (
                <Button onClick={doImport} disabled={importing || totalSelected === 0} variant="gradient">
                  {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Importing…</> : <><Check className="h-4 w-4" />Import {totalSelected}</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
