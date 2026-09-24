import { useEffect, useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api.js';
import { useApp } from '@/lib/store.jsx';
import { assignmentStatus } from '@/lib/utils';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function CalendarPage() {
  const { toast } = useApp();
  const [month, setMonth] = useState(new Date());
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(new Date());

  useEffect(() => { api('/assignments').then(setAssignments).catch((e) => toast(e.message, 'error')); }, []);

  // Build a 6-week grid covering the visible month
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }), [month]);
  const byDay = (d) => assignments.filter((a) => isSameDay(new Date(a.dueDate), d));
  const selectedItems = byDay(selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{format(month, 'MMMM yyyy')}</h1>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setMonth(new Date()); setSelected(new Date()); }}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground mb-1">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1" role="grid">
              {days.map((d) => {
                const items = byDay(d);
                const sel = isSameDay(d, selected);
                return (
                  <button key={d.toISOString()} role="gridcell" aria-selected={sel} aria-label={`${format(d, 'MMMM d')}, ${items.length} assignments`} onClick={() => setSelected(d)}
                    className={`min-h-[64px] md:min-h-[84px] rounded-lg border p-1.5 text-left text-xs transition hover:bg-accent ${!isSameMonth(d, month) ? 'opacity-40' : ''} ${sel ? 'ring-2 ring-primary' : ''} ${isToday(d) ? 'bg-primary/5' : ''}`}>
                    <span className={`inline-grid h-6 w-6 place-items-center rounded-full font-medium ${isToday(d) ? 'bg-primary text-primary-foreground' : ''}`}>{format(d, 'd')}</span>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {items.slice(0, 3).map((a) => <span key={a.id} className="h-1.5 w-full rounded-full md:hidden" style={{ background: a.class?.color || '#94a3b8' }} />)}
                      {items.slice(0, 2).map((a) => <span key={a.id} className="hidden md:block w-full truncate rounded px-1 py-0.5 text-[10px] text-white" style={{ background: a.class?.color || '#94a3b8' }}>{a.title}</span>)}
                      {items.length > 2 && <span className="hidden md:block text-[10px] text-muted-foreground">+{items.length - 2} more</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold">{format(selected, 'EEEE, MMM d')}</h2>
            {selectedItems.length ? selectedItems.map((a) => (
              <div key={a.id} className="rounded-md border-l-4 bg-muted/40 p-3" style={{ borderColor: a.class?.color || '#94a3b8' }}>
                <div className="flex justify-between gap-2"><p className="font-medium text-sm">{a.title}</p><Badge variant={assignmentStatus(a)}>{a.completed ? 'Done' : format(new Date(a.dueDate), 'h:mm a')}</Badge></div>
                <p className="text-xs text-muted-foreground">{a.class?.name || 'No class'} · {a.progress}% done</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">Nothing due this day.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
