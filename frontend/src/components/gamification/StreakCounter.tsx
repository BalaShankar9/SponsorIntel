'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakCounterProps {
  streak: number;
  compact?: boolean;
  className?: string;
}

export function StreakCounter({ streak, compact = false, className }: StreakCounterProps) {
  if (streak === 0 && compact) return null;

  const flameColor = streak >= 30 ? 'text-red' : streak >= 7 ? 'text-amber' : 'text-dim';

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      title={`${streak}-day check-in streak`}
    >
      <Flame size={compact ? 10 : 14} className={flameColor} />
      {!compact && (
        <span className={cn('font-data text-[10px] font-bold tabular-nums', flameColor)}>
          {streak}
        </span>
      )}
      {!compact && streak > 0 && (
        <span className="font-data text-[8px] text-dim uppercase">day streak</span>
      )}
    </div>
  );
}
