'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendArrowProps {
  value: number;         // e.g. +12.3 or -5.1
  suffix?: string;       // e.g. "%" or "pts"
  period?: string;       // e.g. "7d" or "30d" — shown in tooltip
  size?: 'sm' | 'md';
  className?: string;
}

export function TrendArrow({
  value,
  suffix = '%',
  period = '30d',
  size = 'sm',
  className,
}: TrendArrowProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const Icon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown;
  const color = isPositive ? 'text-green' : isNeutral ? 'text-dim' : 'text-red';
  const iconSize = size === 'sm' ? 10 : 12;
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5 font-data', textSize, color, className)}
      title={`${isPositive ? '+' : ''}${value.toFixed(1)}${suffix} vs ${period} ago`}
    >
      <Icon size={iconSize} />
      <span className="tabular-nums">
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}
