'use client';

import { cn, getScoreColor, getScoreBg } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'cyan' | 'amber' | 'new';
  numeric?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-s3 text-dim border border-border',
  green: 'bg-green/15 text-green border border-green/20',
  red: 'bg-red/15 text-red border border-red/20',
  orange: 'bg-orange/15 text-orange border border-orange/20',
  blue: 'bg-accent/15 text-accent border border-accent/20',
  purple: 'bg-purple/15 text-purple border border-purple/20',
  cyan: 'bg-cyan/15 text-cyan border border-cyan/20',
  amber: 'bg-amber/15 text-amber border border-amber/20',
  new: 'bg-cyan/15 text-cyan border border-cyan/20 animate-new-item-flash',
};

export function Badge({ children, variant = 'default', numeric = false, size = 'md', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded px-1.5 py-0.5 font-medium',
      size === 'sm' ? 'text-[9px]' : 'text-[10px]',
      variantStyles[variant],
      numeric && 'font-data tabular-nums',
      className
    )}>
      {children}
    </span>
  );
}

export function RatingBadge({ rating, size = 'md' }: { rating: string | null; size?: 'sm' | 'md' }) {
  if (!rating) return <Badge size={size}>--</Badge>;
  return (
    <Badge variant={rating === 'A' ? 'green' : 'red'} size={size}>
      {rating}-Rated
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge>--</Badge>;
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold font-data tabular-nums',
      getScoreBg(score),
      getScoreColor(score)
    )}>
      {score}
    </span>
  );
}
