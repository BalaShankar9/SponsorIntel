'use client';

import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  interactive?: boolean;
}

export function Card({ children, className, padding = true, interactive = false }: CardProps) {
  return (
    <div className={cn(
      'border border-border bg-s1 transition-all duration-200',
      padding && 'p-3',
      interactive && 'hover-gradient-border hover:shadow-glow-amber cursor-pointer hover:-translate-y-0.5 transition-transform',
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[10px] font-data font-semibold uppercase tracking-[0.15em] text-dim', className)}>
      {children}
    </h3>
  );
}
