import { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, ImageIcon, X, Check } from 'lucide-react';
import { api, updateClass, scanGradesFromScreenshot } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function ScreenshotImportDialog({ open, onClose, existingClasses = [], onImported }) {
  const { toast } = useApp();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) return;
    // cleanup when dialog closes
    setFile(null);
    setPreviewUrl('');
    setResults(null);
    setSelected(new Set());
    setError('');
    setScanning(false);
    setImporting(false);
    setDragOver(false);
  }, [open]);

  const accept = (f) => {
    if (!f) return;
    if (!/^image\//i.test(f.type)) {
      setError('Please choose an image file (PNG, JPG, WEBP).');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image too large. Max 5 MB.');
      return;
    }
    setError('');
    setResults(null);
    setSelected(new Set());
    setFile(f);
    try { URL.revokeObjectURL(previewUrl); } catch {}
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    accept(f);
  };

  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      const f = item.getAsFile();
      if (f) accept(f);
    }
  };

  const scan = async () => {
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      const data = await scanGradesFromScreenshot(file);
      const classes = data.classes || [];
      setResults(classes);
      setSelected(new Set(classes.map((c) => c.name)));
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
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
            snapshotSource: 'screenshot',
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
            snapshotSource: 'screenshot',
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
  const stage = results ? 'results' : file ? 'review' : 'pick';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Import grades from screenshot"
        description="Take a screenshot of your grade portal and we'll read the classes and grades for you."
        className="max-w-2xl"
      >
        <div className="space-y-4" onPaste={onPaste}>
          {stage === 'pick' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Drop a screenshot here</p>
                <p className="text-xs text-muted-foreground">
                  or click to browse · PNG, JPG, WEBP · up to 5 MB
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Tip: you can also paste an image with <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl/Cmd+V</kbd>
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => accept(e.target.files?.[0])}
              />
            </>
          )}

          {stage === 'review' && (
            <>
              <div className="relative overflow-hidden rounded-lg border bg-muted/20">
                <img src={previewUrl} alt="Screenshot preview" className="max-h-80 w-full object-contain" />
                <button
                  onClick={() => { setFile(null); setPreviewUrl(''); }}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 shadow-md backdrop-blur hover:bg-background"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            </>
          )}

          {stage === 'results' && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                Found {results.length} {results.length === 1 ? 'class' : 'classes'}. Uncheck any you don't want to import.
              </p>
              <div className="space-y-1">
                {results.map((c) => {
                  const existing = existingClasses.find(
                    (k) => k.name.toLowerCase() === c.name.toLowerCase()
                  );
                  const isChecked = selected.has(c.name);
                  return (
                    <label
                      key={c.name}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm transition-colors hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
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
              {stage === 'review' && (
                <Button variant="ghost" onClick={() => { setFile(null); setPreviewUrl(''); }}>
                  Choose different
                </Button>
              )}
              {stage === 'results' && (
                <Button variant="ghost" onClick={() => { setResults(null); setSelected(new Set()); }} disabled={importing}>
                  Rescan
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={scanning || importing}>
                Cancel
              </Button>
              {stage === 'review' && (
                <Button onClick={scan} disabled={scanning} variant="gradient">
                  {scanning ? <><Loader2 className="h-4 w-4 animate-spin" />Reading…</> : <><Upload className="h-4 w-4" />Scan image</>}
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
