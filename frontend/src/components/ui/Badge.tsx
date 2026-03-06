'use client';

import { cn, getScoreColor, getScoreBg } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'cyan';
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-s3 text-dim',
  green: 'bg-green/20 text-green',
  red: 'bg-red/20 text-red',
  orange: 'bg-orange/20 text-orange',
  blue: 'bg-accent/20 text-accent',
  purple: 'bg-purple/20 text-purple',
  cyan: 'bg-cyan/20 text-cyan',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variantStyles[variant], className)}>
      {children}
    </span>
  );
}

export function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <Badge>--</Badge>;
  return (
    <Badge variant={rating === 'A' ? 'green' : 'red'}>
      {rating}-Rated
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge>--</Badge>;
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-bold', getScoreBg(score), getScoreColor(score))}>
      {score}
    </span>
  );
}
