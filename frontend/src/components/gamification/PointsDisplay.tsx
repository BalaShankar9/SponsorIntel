'use client';

import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsDisplayProps {
  points: number;
  compact?: boolean;
  className?: string;
}

export function PointsDisplay({ points, compact = false, className }: PointsDisplayProps) {
  const tier =
    points >= 1000
      ? { label: 'EXPERT', color: 'text-amber' }
      : points >= 500
        ? { label: 'ANALYST', color: 'text-cyan' }
        : points >= 100
          ? { label: 'RESEARCHER', color: 'text-green' }
          : { label: 'NEWCOMER', color: 'text-dim' };

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      title={`Research Score: ${points} points (${tier.label})`}
    >
      <Trophy size={compact ? 10 : 12} className={tier.color} />
      <span className={cn('font-data font-bold tabular-nums', tier.color, compact ? 'text-[9px]' : 'text-[11px]')}>
        {points}
      </span>
      {!compact && (
        <span className={cn('font-data text-[8px] uppercase tracking-wider', tier.color)}>
          {tier.label}
        </span>
      )}
    </div>
  );
}
