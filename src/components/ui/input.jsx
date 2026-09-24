import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground disabled:opacity-50', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm', className)} {...props} />
));
Select.displayName = 'Select';

export const Label = ({ className, ...props }) => <label className={cn('text-sm font-medium leading-none', className)} {...props} />;
