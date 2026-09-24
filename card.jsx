import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }) => <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md', className)} {...p} />;
export const CardHeader = ({ className, ...p }) => <div className={cn('flex flex-col space-y-1 p-5 pb-3', className)} {...p} />;
export const CardTitle = ({ className, ...p }) => <h3 className={cn('font-semibold leading-tight tracking-tight', className)} {...p} />;
export const CardDescription = ({ className, ...p }) => <p className={cn('text-sm text-muted-foreground', className)} {...p} />;
export const CardContent = ({ className, ...p }) => <div className={cn('p-5 pt-0', className)} {...p} />;
