'use client';

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export function ScoreBadge({ score, size = 'sm', pulse = false, className }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span className={cn(
        'inline-flex items-center justify-center font-data font-bold tabular-nums bg-s3 text-dim',
        size === 'sm' ? 'text-[9px] px-1 py-0.5' : 'text-[11px] px-1.5 py-0.5',
        className
      )}>
        --
      </span>
    );
  }

  const bg = score >= 80 ? 'bg-green/20' : score >= 60 ? 'bg-amber/20' : 'bg-red/20';
  const text = score >= 80 ? 'text-green' : score >= 60 ? 'text-amber' : 'text-red';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-data font-bold tabular-nums transition-all',
        bg,
        text,
        size === 'sm' ? 'text-[9px] px-1 py-0.5' : 'text-[11px] px-1.5 py-0.5',
        pulse && 'animate-pulse-glow-cyan',
        className
      )}
    >
      {score}
    </span>
  );
}
