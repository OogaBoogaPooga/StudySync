import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Printer, Calculator, Pencil, Trash2, ClipboardPaste } from 'lucide-react';
import { api, updateClass } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { computeGPA, classStats } from '@/lib/grades.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Label, Select } from '@/components/ui/input.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import PasteGradesDialog from '@/components/PasteGradesDialog.jsx';
import UpcomingWorkCallout from '@/components/UpcomingWorkCallout.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Grades() {
  const { toast } = useApp();
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [whatIf, setWhatIf] = useState({ classId: '', score: 90, maxScore: 100, weight: 1 });
  const [snapshotFor, setSnapshotFor] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);

  const loadAll = () =>
    Promise.all([api('/classes'), api('/assignments')])
      .then(([c, a]) => {
        setClasses(c);
        setAssignments(a);
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

  const sourceLabel = (src) => {
    if (src === 'paste') return 'Paste';
    if (src === 'screenshot') return 'Screenshot';
    if (src === 'infinitecampus') return 'IC';
    return 'Manual';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Grades & GPA</h1>
          <p className="text-sm text-muted-foreground">
            Import your grades from a paste, or edit any class manually with the pencil icon.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ClipboardPaste className="h-4 w-4" />Import grades
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />Export PDF
          </Button>
        </div>
      </div>

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
            {graded.length ? <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} /> : <p className="text-sm text-muted-foreground">No graded classes yet. Import from a paste to get started.</p>}
          </CardContent>
        </Card>
      </div>

      <UpcomingWorkCallout assignments={assignments} classes={classes} />

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
                          <span
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                            title={cls.snapshotUpdatedAt ? `Updated ${new Date(cls.snapshotUpdatedAt).toLocaleDateString()}` : ''}
                          >
                            {sourceLabel(cls.snapshotSource)}
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
                          aria-label={hasSnapshot ? 'Edit grade' : 'Add grade'}
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

      <PasteGradesDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        existingClasses={classes}
        onImported={loadAll}
      />
      <SnapshotDialog
        cls={snapshotFor}
        onClose={() => setSnapshotFor(null)}
        onSave={saveSnapshot}
        onClear={clearSnapshot}
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

  if (!cls) return null;

  const parsed = parseGradeInput(value);
  const pct = parsed ? (parsed.score / parsed.max) * 100 : null;
  const hasSnapshot = cls.snapshotScore != null && cls.snapshotMax != null;

  const submit = () => {
    if (!parsed) { setError('Format: 143/158 or 95.97%'); return; }
    onSave({ classId: cls.id, score: parsed.score, max: parsed.max, source: 'manual' });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Grade for ${cls.name}`}
        description="Enter a current grade from your school's portal. Examples: 143.26/158 or 95.97%"
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