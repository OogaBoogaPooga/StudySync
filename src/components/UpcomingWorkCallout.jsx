import { CalendarDays, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';

/**
 * Shows the next few high-stakes assignments across all classes.
 * Score = weight × urgency. Filters out assignments already completed.
 */
export default function UpcomingWorkCallout({ assignments, classes, limit = 3 }) {
  const now = new Date();
  const horizonDays = 21;

  const classById = new Map(classes.map((c) => [c.id, c]));

  const candidates = assignments
    .filter((a) => !a.completed && a.dueDate && a.classId && classById.has(a.classId))
    .map((a) => {
      const due = new Date(a.dueDate);
      const daysOut = Math.round((due - now) / (24 * 60 * 60 * 1000));
      const urgent = daysOut <= 0 ? 3 : daysOut <= 3 ? 2 : daysOut <= 7 ? 1.5 : 1;
      const weight = Number(a.weight) || 1;
      const score = weight * urgent;
      return { a, cls: classById.get(a.classId), daysOut, weight, score };
    })
    .filter((x) => x.daysOut <= horizonDays)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);

  if (!candidates.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Upcoming high-impact work
        </CardTitle>
        <CardDescription>Sorted by weight and due date</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.map(({ a, cls, daysOut, weight }) => (
          <div key={a.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
            <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: cls.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {cls.name} · {format(new Date(a.dueDate), 'MMM d')}
                {daysOut === 0 ? ' (today)' : daysOut === 1 ? ' (tomorrow)' : ` (${daysOut}d)`}
              </p>
            </div>
            {weight > 1 && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                ×{weight}
              </span>
            )}
          </div>
        ))}
        <Link
          to="/calendar"
          className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline"
        >
          View calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}