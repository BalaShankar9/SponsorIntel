'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1 block text-xs font-medium text-dim">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-md border border-border bg-s2 px-3 py-2 text-sm text-text placeholder-dim2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50',
            error && 'border-red',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
