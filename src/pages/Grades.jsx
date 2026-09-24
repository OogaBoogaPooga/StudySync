import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Printer, Calculator } from 'lucide-react';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { computeGPA, classStats } from '@/lib/grades.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Input, Label, Select } from '@/components/ui/input.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Grades() {
  const { toast } = useApp();
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [whatIf, setWhatIf] = useState({ classId: '', score: 90, maxScore: 100, weight: 1 });

  useEffect(() => {
    Promise.all([api('/classes'), api('/assignments')]).then(([c, a]) => { setClasses(c); setAssignments(a); setWhatIf((w) => ({ ...w, classId: c[0]?.id || '' })); }).catch((e) => toast(e.message, 'error'));
  }, []);

  const { gpa, perClass } = useMemo(() => computeGPA(classes, assignments), [classes, assignments]);

  // What-if: recompute with a hypothetical extra graded assignment
  const projection = useMemo(() => {
    const cls = classes.find((c) => c.id === whatIf.classId);
    if (!cls) return null;
    const hypothetical = { classId: cls.id, score: Number(whatIf.score), maxScore: Number(whatIf.maxScore) || 100, weight: Number(whatIf.weight) || 1 };
    const next = computeGPA(classes, [...assignments, hypothetical]);
    return { cls, before: classStats(cls, assignments), after: classStats(cls, [...assignments, hypothetical]), gpaBefore: gpa, gpaAfter: next.gpa };
  }, [whatIf, classes, assignments, gpa]);

  const graded = perClass.filter((p) => p.stats);
  const barData = {
    labels: graded.map((p) => p.cls.name),
    datasets: [{ label: 'Class average %', data: graded.map((p) => Math.round(p.stats.pct * 10) / 10), backgroundColor: graded.map((p) => p.cls.color), borderRadius: 8 }],
  };
  const doughnutData = {
    labels: graded.map((p) => p.cls.name),
    datasets: [{ data: graded.map((p) => p.cls.credits), backgroundColor: graded.map((p) => p.cls.color), borderWidth: 0 }],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">Grades & GPA</h1><p className="text-sm text-muted-foreground">Add scores to assignments on the Dashboard — everything here updates automatically.</p></div>
        <Button variant="outline" onClick={() => window.print()} className="no-print"><Printer className="h-4 w-4" />Export PDF</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0 shadow-lg">
          <CardContent className="p-6"><p className="text-sm opacity-80">Weighted GPA</p><p className="text-5xl font-bold mt-1">{gpa == null ? '—' : gpa.toFixed(2)}</p><p className="text-xs opacity-80 mt-2">{graded.length} classes with grades · {graded.reduce((s, p) => s + p.cls.credits, 0)} credits</p></CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Performance by class</CardTitle></CardHeader>
          <CardContent className="h-48">{graded.length ? <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} /> : <p className="text-sm text-muted-foreground">No graded assignments yet.</p>}</CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Card>
          <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Class</th><th>Credits</th><th>Graded</th><th>Average</th><th>Letter</th><th>Points</th></tr></thead>
              <tbody>
                {perClass.map(({ cls, stats }) => (
                  <tr key={cls.id} className="border-b last:border-0">
                    <td className="py-2 flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: cls.color }} />{cls.name}</td>
                    <td>{cls.credits}</td><td>{stats?.graded ?? 0}</td>
                    <td className="font-medium">{stats ? `${stats.pct.toFixed(1)}%` : '—'}</td>
                    <td>{stats?.letter ?? '—'}</td><td>{stats?.points.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Per-assignment detail — useful in the printed report */}
            <details className="mt-4"><summary className="cursor-pointer text-sm text-muted-foreground">Show all graded assignments</summary>
              <ul className="mt-2 space-y-1 text-sm">{assignments.filter((a) => a.score != null).map((a) => <li key={a.id} className="flex justify-between border-b py-1"><span>{a.title} <span className="text-muted-foreground">· {a.class?.name}</span></span><span>{a.score}/{a.maxScore} ({((a.score / a.maxScore) * 100).toFixed(0)}%) ×{a.weight}</span></li>)}</ul>
            </details>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="no-print">
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />What-if calculator</CardTitle><CardDescription>See how a future score changes your grade.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label htmlFor="w-class">Class</Label><Select id="w-class" value={whatIf.classId} onChange={(e) => setWhatIf({ ...whatIf, classId: e.target.value })}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
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
    </div>
  );
}

const Row = ({ label, before, after }) => <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span><span className="line-through opacity-60 mr-2">{before}</span><b className="text-primary">{after}</b></span></div>;
