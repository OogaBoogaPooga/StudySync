import { cn } from '@/lib/utils';

export function Progress({ value = 0, color, className, label }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'} className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color || 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
    </div>
  );
}
