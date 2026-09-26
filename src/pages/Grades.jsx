import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Printer, Calculator, Cloud, CloudOff, RefreshCw, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
  api, getICStatus, saveICCredentials, disconnectIC, previewICSync, syncICGradesSelected, updateClass,
} from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { computeGPA, classStats } from '@/lib/grades.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Label, Select } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Grades() {
  const { toast } = useApp();
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [whatIf, setWhatIf] = useState({ classId: '', score: 90, maxScore: 100, weight: 1 });
  const [snapshotFor, setSnapshotFor] = useState(null);
  const [icOpen, setIcOpen] = useState(false);
  const [ic, setIc] = useState({ connected: false, lastSync: null, portalUrl: null, username: null });
  const [syncing, setSyncing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const loadAll = () =>
    Promise.all([api('/classes'), api('/assignments'), getICStatus().catch(() => ({ connected: false }))])
      .then(([c, a, s]) => {
        setClasses(c);
        setAssignments(a);
        setIc(s || { connected: false });
        setWhatIf((w) => ({ ...w, classId: w.classId || c[0]?.id || '' }));
      })
      .catch((e) => toast(e.message, 'error'));

  useEffect(() => { loadAll(); }, []);

  const effectiveAssignments = useMemo(() => {
    const out = [];
    for (const c of classes) {
      if (c.snapshotScore != null && c.snapshotMax != null && c.snapshotMax > 0) {
        out.push({
          id: `snapshot-${c.id}`,
          classId: c.id,
          title: 'Grade snapshot',
          score: c.snapshotScore,
          maxScore: c.snapshotMax,
          weight: 1,
          completed: true,
          progress: 100,
          dueDate: new Date().toISOString(),
        });
      } else {
        out.push(...assignments.filter((a) => a.classId === c.id));
      }
    }
    out.push(...assignments.filter((a) => !a.classId));
    return out;
  }, [classes, assignments]);

  const { gpa, perClass } = useMemo(
    () => computeGPA(classes, effectiveAssignments),
    [classes, effectiveAssignments]
  );

  const projection = useMemo(() => {
    const cls = classes.find((c) => c.id === whatIf.classId);
    if (!cls) return null;
    const hypothetical = {
      classId: cls.id,
      score: Number(whatIf.score),
      maxScore: Number(whatIf.maxScore) || 100,
      weight: Number(whatIf.weight) || 1,
    };
    const next = computeGPA(classes, [...effectiveAssignments, hypothetical]);
    return {
      cls,
      before: classStats(cls, effectiveAssignments),
      after: classStats(cls, [...effectiveAssignments, hypothetical]),
      gpaBefore: gpa,
      gpaAfter: next.gpa,
    };
  }, [whatIf, classes, effectiveAssignments, gpa]);

  const graded = perClass.filter((p) => p.stats);
  const barData = {
    labels: graded.map((p) => p.cls.name),
    datasets: [{ label: 'Class average %', data: graded.map((p) => Math.round(p.stats.pct * 10) / 10), backgroundColor: graded.map((p) => p.cls.color), borderRadius: 8 }],
  };
  const doughnutData = {
    labels: graded.map((p) => p.cls.name),
    datasets: [{ data: graded.map((p) => p.cls.credits), backgroundColor: graded.map((p) => p.cls.color), borderWidth: 0 }],
  };

  const saveSnapshot = async ({ classId, score, max, source }) => {
    try {
      const updated = await updateClass(classId, {
        snapshotScore: score,
        snapshotMax: max,
        snapshotUpdatedAt: new Date().toISOString(),
        snapshotSource: source,
      });
      setClasses((list) => list.map((c) => (c.id === classId ? { ...c, ...updated } : c)));
      toast('Grade saved');
      setSnapshotFor(null);
    } catch (e) { toast(e.message, 'error'); }
  };

  const clearSnapshot = async (classId) => {
    if (!confirm('Clear this snapshot? The grade will revert to assignment-based calculation.')) return;
    try {
      const updated = await updateClass(classId, {
        snapshotScore: null,
        snapshotMax: null,
        snapshotUpdatedAt: null,
        snapshotSource: null,
      });
      setClasses((list) => list.map((c) => (c.id === classId ? { ...c, ...updated } : c)));
      toast('Snapshot cleared');
      setSnapshotFor(null);
    } catch (e) { toast(e.message, 'error'); }
  };

  const runICSync = async () => {
    setSyncing(true);
    try {
      const preview = await previewICSync();
      setPreviewData(preview);
    } catch (e) {
      toast(e.message, 'error');
    } finally { setSyncing(false); }
  };

  const applyPreview = async (selection) => {
    setSyncing(true);
    try {
      const r = await syncICGradesSelected(selection);
      const c = r.created?.length || 0;
      const u = r.updated?.length || 0;
      toast(`Imported ${c} new · updated ${u}`);
      setPreviewData(null);
      await loadAll();
    } catch (e) {
      toast(e.message, 'error');
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Grades & GPA</h1>
          <p className="text-sm text-muted-foreground">Track grades manually or sync them from Infinite Campus.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => setIcOpen(true)}>
            {ic.connected ? <><Cloud className="h-4 w-4 text-emerald-500" />Infinite Campus</> : <><CloudOff className="h-4 w-4" />Connect IC</>}
          </Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Export PDF</Button>
        </div>
      </div>

      {ic.connected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/60 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            Infinite Campus: <span className="font-medium text-foreground">{ic.username}</span>
            {ic.lastSync && <> · last sync {new Date(ic.lastSync).toLocaleString()}</>}
          </span>
          <Button variant="outline" size="sm" onClick={runICSync} disabled={syncing}>
            {syncing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Syncing…</> : <><RefreshCw className="h-3.5 w-3.5" />Sync now</>}
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 bg-gradient-to-br from-slate-700 to-slate-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm opacity-80">Weighted GPA</p>
            <p className="text-5xl font-bold mt-1">{gpa == null ? '—' : gpa.toFixed(2)}</p>
            <p className="text-xs opacity-80 mt-2">{graded.length} classes with grades · {graded.reduce((s, p) => s + p.cls.credits, 0)} credits</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Performance by class</CardTitle></CardHeader>
          <CardContent className="h-48">
            {graded.length ? <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} /> : <p className="text-sm text-muted-foreground">No graded assignments yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Card>
          <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Class</th>
                  <th>Credits</th>
                  <th>Graded</th>
                  <th>Average</th>
                  <th>Letter</th>
                  <th>Points</th>
                  <th className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {perClass.map(({ cls, stats }) => {
                  const hasSnapshot = cls.snapshotScore != null && cls.snapshotMax != null && cls.snapshotMax > 0;
                  return (
                    <tr key={cls.id} className="border-b last:border-0">
                      <td className="py-2 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: cls.color }} />
                        {cls.name}
                        {hasSnapshot && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary" title={cls.snapshotUpdatedAt ? `Updated ${new Date(cls.snapshotUpdatedAt).toLocaleDateString()}` : ''}>
                            {cls.snapshotSource === 'infinitecampus' ? 'IC' : 'Manual'}
                          </span>
                        )}
                      </td>
                      <td>{cls.credits}</td>
                      <td>{hasSnapshot ? '—' : (stats?.graded ?? 0)}</td>
                      <td className="font-medium">{stats ? `${stats.pct.toFixed(1)}%` : '—'}</td>
                      <td>{stats?.letter ?? '—'}</td>
                      <td>{stats?.points.toFixed(1) ?? '—'}</td>
                      <td className="no-print">
                        <button
                          onClick={() => setSnapshotFor(cls)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={hasSnapshot ? 'Edit grade snapshot' : 'Add grade'}
                          title={hasSnapshot ? 'Edit grade' : 'Add grade'}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">Show all graded assignments</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {assignments.filter((a) => a.score != null).map((a) => (
                  <li key={a.id} className="flex justify-between border-b py-1">
                    <span>{a.title} <span className="text-muted-foreground">· {a.class?.name}</span></span>
                    <span>{a.score}/{a.maxScore} ({((a.score / a.maxScore) * 100).toFixed(0)}%) ×{a.weight}</span>
                  </li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />What-if calculator</CardTitle>
              <CardDescription>See how a future score changes your grade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="w-class">Class</Label>
                <Select id="w-class" value={whatIf.classId} onChange={(e) => setWhatIf({ ...whatIf, classId: e.target.value })}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label htmlFor="w-score">Score</Label><Input id="w-score" type="number" value={whatIf.score} onChange={(e) => setWhatIf({ ...whatIf, score: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="w-max">Out of</Label><Input id="w-max" type="number" value={whatIf.maxScore} onChange={(e) => setWhatIf({ ...whatIf, maxScore: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="w-weight">Weight</Label><Input id="w-weight" type="number" step="0.5" value={whatIf.weight} onChange={(e) => setWhatIf({ ...whatIf, weight: e.target.value })} /></div>
              </div>
              {projection && (
                <div className="rounded-lg bg-muted p-3 text-sm space-y-1" aria-live="polite">
                  <Row label={projection.cls.name} before={projection.before ? `${projection.before.pct.toFixed(1)}% ${projection.before.letter}` : '—'} after={`${projection.after.pct.toFixed(1)}% ${projection.after.letter}`} />
                  <Row label="GPA" before={projection.gpaBefore?.toFixed(2) ?? '—'} after={projection.gpaAfter?.toFixed(2) ?? '—'} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Credit distribution</CardTitle></CardHeader>
            <CardContent className="h-44">{graded.length ? <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }} /> : null}</CardContent>
          </Card>
        </div>
      </div>

      <PreviewDialog
        data={previewData}
        onClose={() => setPreviewData(null)}
        onApply={applyPreview}
      />
      <SnapshotDialog
        cls={snapshotFor}
        onClose={() => setSnapshotFor(null)}
        onSave={saveSnapshot}
        onClear={clearSnapshot}
      />
      <ICDialog
        open={icOpen}
        onClose={() => setIcOpen(false)}
        ic={ic}
        onConnected={async () => { await loadAll(); }}
        onDisconnected={async () => { await loadAll(); }}
      />
    </div>
  );
}

const Row = ({ label, before, after }) => (
  <div className="flex items-center justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span><span className="line-through opacity-60 mr-2">{before}</span><b className="text-primary">{after}</b></span>
  </div>
);

/* ---------- Preview dialog ---------- */

function PreviewDialog({ data, onClose, onApply }) {
  const [uncheckedCreates, setUncheckedCreates] = useState(new Set());
  const [uncheckedUpdates, setUncheckedUpdates] = useState(new Set());

  useEffect(() => {
    setUncheckedCreates(new Set());
    setUncheckedUpdates(new Set());
  }, [data]);

  if (!data) return null;

  const toggle = (set, setFn, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFn(next);
  };

  const totalSelected =
    (data.creates?.filter((c) => !uncheckedCreates.has(c.icName)).length || 0) +
    (data.updates?.filter((u) => !uncheckedUpdates.has(u.icName)).length || 0);

  const apply = () => {
    onApply({
      creates: (data.creates || []).filter((c) => !uncheckedCreates.has(c.icName)).map((c) => c.icName),
      updates: (data.updates || []).filter((u) => !uncheckedUpdates.has(u.icName)).map((u) => u.icName),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Import from Infinite Campus"
        description="Uncheck anything you don't want to import. Selected items will be added or updated in your classes."
        className="max-w-2xl"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {data.creates?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New classes ({data.creates.length})
              </p>
              <div className="space-y-1">
                {data.creates.map((c) => (
                  <label key={c.icName} className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={!uncheckedCreates.has(c.icName)}
                      onChange={() => toggle(uncheckedCreates, setUncheckedCreates, c.icName)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.icName}</span>
                      {c.term && <span className="block text-[10px] text-muted-foreground">{c.term}</span>}
                    </span>
                    <span className="shrink-0 font-medium">
                      {c.pct.toFixed(1)}%{c.letter ? ` · ${c.letter}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {data.updates?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Updates to existing classes ({data.updates.length})
              </p>
              <div className="space-y-1">
                {data.updates.map((u) => (
                  <label key={u.icName} className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={!uncheckedUpdates.has(u.icName)}
                      onChange={() => toggle(uncheckedUpdates, setUncheckedUpdates, u.icName)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.currentName}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        matched IC "{u.icName}"{u.term ? ` · ${u.term}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {u.pct.toFixed(1)}%{u.letter ? ` · ${u.letter}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(!data.creates?.length && !data.updates?.length) && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing to import.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={apply} disabled={totalSelected === 0}>
            Import {totalSelected} item{totalSelected === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Snapshot dialog ---------- */

function parseGradeInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const frac = s.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b > 0) return { score: a, max: b };
  }
  const pct = s.match(/^([\d.]+)\s*%?$/);
  if (pct) {
    const a = Number(pct[1]);
    if (Number.isFinite(a)) return { score: a, max: 100 };
  }
  return null;
}

function SnapshotDialog({ cls, onClose, onSave, onClear }) {
  const open = !!cls;
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cls) return;
    setError('');
    if (cls.snapshotScore != null && cls.snapshotMax != null) {
      setValue(`${cls.snapshotScore}/${cls.snapshotMax}`);
    } else {
      setValue('');
    }
  }, [cls]);

  if (!cls) {
    return (
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent title="" description="" />
      </Dialog>
    );
  }

  const parsed = parseGradeInput(value);
  const pct = parsed ? (parsed.score / parsed.max) * 100 : null;
  const hasSnapshot = cls.snapshotScore != null && cls.snapshotMax != null;

  const submit = () => {
    if (!parsed) { setError('Format: 143/158 or 95.97%'); return; }
    onSave({ classId: cls.id, score: parsed.score, max: parsed.max, source: 'manual' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Grade for ${cls.name}`}
        description="Enter a current grade from Infinite Campus or any grade portal. Example: 143.26/158"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="snap-input">Score</Label>
            <Input
              id="snap-input"
              autoFocus
              placeholder="143.26/158"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {parsed && !error && (
              <p className="text-xs text-muted-foreground">= {pct.toFixed(2)}%</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={!parsed} variant="gradient" className="flex-1">Save</Button>
            {hasSnapshot && (
              <Button variant="ghost" onClick={() => onClear(cls.id)} className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />Clear
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Infinite Campus dialog ---------- */

function ICDialog({ open, onClose, ic, onConnected, onDisconnected }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ portalUrl: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      portalUrl: ic.portalUrl || '',
      username: ic.username || '',
      password: '',
    });
  }, [open, ic]);

  const connect = async () => {
    setError('');
    setBusy(true);
    try {
      await saveICCredentials(form.portalUrl, form.username, form.password);
      toast('Infinite Campus connected');
      await onConnected();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Infinite Campus? Your credentials will be wiped.')) return;
    setBusy(true);
    try {
      await disconnectIC();
      toast('Disconnected');
      await onDisconnected();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Infinite Campus"
        description={ic.connected
          ? 'Connected. You can re-enter credentials or disconnect.'
          : 'Paste the portal URL from your browser while logged into Infinite Campus.'}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ic-url">Portal URL</Label>
            <Input
              id="ic-url"
              placeholder="https://yourdistrict.infinitecampus.org/campus/...?appName=yourdistrict"
              value={form.portalUrl}
              onChange={(e) => setForm({ ...form, portalUrl: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">
              Copy from your browser's address bar while logged into IC. Must include <code>?appName=...</code>
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ic-user">IC username</Label>
            <Input id="ic-user" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ic-pass">IC password</Label>
            <Input id="ic-pass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-[11px] text-muted-foreground">
            Credentials are encrypted with AES-256-GCM before being stored. The key lives only on the server and never touches the database.
          </p>
          <div className="flex gap-2">
            <Button onClick={connect} disabled={busy || !form.portalUrl || !form.username || !form.password} variant="gradient" className="flex-1">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : ic.connected ? 'Update' : 'Connect'}
            </Button>
            {ic.connected && (
              <Button variant="ghost" onClick={disconnect} disabled={busy} className="text-destructive hover:bg-destructive/10">
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
