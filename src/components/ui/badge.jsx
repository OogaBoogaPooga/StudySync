import { cn } from '@/lib/utils';

const styles = {
  default: 'bg-primary/10 text-primary',
  late: 'bg-red-500/15 text-red-600 dark:text-red-400',
  soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  upcoming: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
};

export const Badge = ({ variant = 'default', className, ...p }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', styles[variant], className)} {...p} />
);
