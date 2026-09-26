import { useEffect, useState } from 'react';
import { Flame, Clock, Layers, CheckCircle2, Loader2 } from 'lucide-react';
import { getStreakStats } from '@/lib/api.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';

export default function StreakCard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStreakStats(30).then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Your activity</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Couldn't load stats.</p></CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { streak, totalMin, totalCards, totalAssignments, activeDays, days } = stats;
  const last7 = days.slice(0, 7).reverse();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Flame className={`h-4 w-4 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          Your last 30 days
        </CardTitle>
        <CardDescription>
          {streak > 0 ? `${streak}-day streak · ${activeDays} active days` : `${activeDays} active day${activeDays === 1 ? '' : 's'}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={Clock} value={`${Math.round(totalMin / 60 * 10) / 10}h`} label="focused" />
          <Stat icon={Layers} value={totalCards} label="cards" />
          <Stat icon={CheckCircle2} value={totalAssignments} label="done" />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Last 7 days</p>
          <div className="flex items-end gap-1 h-12">
            {last7.map((d) => {
              const active = d.focusMin >= 5 || d.cards >= 3 || d.assignments >= 1;
              const intensity = Math.min(1, (d.focusMin / 60) + (d.cards / 20) + (d.assignments / 3));
              return (
                <div
                  key={d.date}
                  className="flex-1 rounded-t transition-colors"
                  style={{
                    height: `${Math.max(8, intensity * 100)}%`,
                    background: active ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    opacity: active ? 0.4 + intensity * 0.6 : 1,
                  }}
                  title={`${d.date}: ${d.focusMin}m focus · ${d.cards} cards`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-md border p-2">
      <Icon className="mx-auto mb-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-base font-semibold leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}