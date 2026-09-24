import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely (shadcn convention) */
export const cn = (...inputs) => twMerge(clsx(inputs));

/** Palette suggestions for new classes */
export const SUBJECT_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

/** Builds an "Add to Google Calendar" link for an assignment */
export function googleCalendarUrl(a) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const start = fmt(a.dueDate);
  const end = fmt(new Date(new Date(a.dueDate).getTime() + 60 * 60 * 1000));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${a.title}${a.class ? ` (${a.class.name})` : ''}`,
    dates: `${start}/${end}`,
    details: a.description || 'Added from StudySync',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Assignment status: late | soon | done | upcoming */
export function assignmentStatus(a) {
  if (a.completed) return 'done';
  const diff = new Date(a.dueDate) - Date.now();
  if (diff < 0) return 'late';
  if (diff < 24 * 60 * 60 * 1000) return 'soon';
  return 'upcoming';
}
