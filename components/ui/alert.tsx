import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'destructive' | 'success' | 'info';
}

export function Alert({
  className,
  variant = 'destructive',
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-md p-3 text-xs md:text-sm flex items-start gap-2.5 border transition-all',
        {
          'bg-red-50 text-red-700 border-red-200': variant === 'destructive',
          'bg-green-50 text-green-700 border-green-200': variant === 'success',
          'bg-blue-50 text-blue-700 border-blue-200': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {variant === 'destructive' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      {variant === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
      {variant === 'info' && <Info className="w-4 h-4 shrink-0 mt-0.5" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

