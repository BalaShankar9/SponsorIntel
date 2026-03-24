'use client';

import { cn } from '@/lib/utils';
import type { IntelImpactLevel } from '@/types/intel';

const impactConfig: Record<IntelImpactLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'CRITICAL', color: 'text-red', bg: 'bg-red/15', border: 'border-red/30' },
  high: { label: 'HIGH', color: 'text-amber', bg: 'bg-amber/15', border: 'border-amber/30' },
  medium: { label: 'MEDIUM', color: 'text-blue', bg: 'bg-accent/15', border: 'border-accent/30' },
  low: { label: 'LOW', color: 'text-dim', bg: 'bg-s3', border: 'border-border' },
};

interface ImpactBadgeProps {
  level: IntelImpactLevel | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function ImpactBadge({ level, size = 'md', className }: ImpactBadgeProps) {
  if (!level) return null;
  const config = impactConfig[level];
  return (
    <span className={cn(
      'inline-flex items-center rounded border font-data font-semibold uppercase tracking-wider',
      size === 'sm' ? 'px-1 py-px text-[8px]' : 'px-1.5 py-0.5 text-[9px]',
      config.color, config.bg, config.border,
      level === 'critical' && 'animate-pulse',
      className
    )}>
      {config.label}
    </span>
  );
}
