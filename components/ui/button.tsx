import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'flat-primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          {
            'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 rounded-lg':
              variant === 'primary',
            'bg-[#8bc34a] hover:bg-[#7cb342] text-white font-bold tracking-wider uppercase rounded focus-visible:ring-[#8bc34a] shadow-sm hover:shadow':
              variant === 'flat-primary',
            'bg-gray-900 text-white hover:bg-gray-800 rounded-lg': variant === 'default',
            'border border-gray-300 bg-transparent hover:bg-gray-100 rounded-lg':
              variant === 'outline',
            'hover:bg-gray-100 hover:text-gray-900 rounded-lg': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 rounded-lg': variant === 'destructive',
            'h-10 px-4 py-2 text-sm': size === 'default',
            'h-9 rounded-md px-3 text-xs': size === 'sm',
            'h-11 rounded-md px-8 text-base': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

