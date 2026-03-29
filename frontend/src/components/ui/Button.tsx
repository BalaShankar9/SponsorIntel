'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'green' | 'red' | 'amber';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  primary: 'bg-accent2 text-white hover:bg-accent',
  secondary: 'bg-s3 text-text hover:bg-s4',
  ghost: 'bg-transparent text-dim hover:text-text hover:bg-s2',
  green: 'bg-green/20 text-green hover:bg-green/30',
  red: 'bg-red/20 text-red hover:bg-red/30',
  amber: 'bg-amber/20 text-amber hover:bg-amber/30 border border-amber/30',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-5 py-2 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber/50',
          variantStyles[variant],
          sizeStyles[size],
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
