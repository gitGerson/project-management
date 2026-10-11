import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'flat';
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', hasError, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'w-full text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'default' &&
            'h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500',
          variant === 'flat' &&
            'bg-transparent border-0 border-b-2 border-gray-200 text-gray-900 placeholder:text-gray-400 py-2.5 px-0 rounded-none focus-visible:outline-none focus-visible:border-[#8bc34a]',
          hasError &&
            variant === 'default' &&
            'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500',
          hasError &&
            variant === 'flat' &&
            'border-b-red-500 focus-visible:border-red-500',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

