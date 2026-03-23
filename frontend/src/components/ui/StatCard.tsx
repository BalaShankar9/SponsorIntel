'use client';

import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Sparkline } from './Sparkline';
import { NumberAnimation } from './NumberAnimation';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendData {
  value: number;
  suffix?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan' | 'amber';
  icon?: React.ReactNode;
  sparklineData?: number[];
  sparklineColor?: string;
  trend?: TrendData;
  compact?: boolean;
  loading?: boolean;
}

const colorMap: Record<string, { text: string; border: string; valueColor: string }> = {
  blue: { text: 'text-accent', border: 'border-l-accent', valueColor: 'text-accent' },
  green: { text: 'text-green', border: 'border-l-green', valueColor: 'text-green' },
  red: { text: 'text-red', border: 'border-l-red', valueColor: 'text-red' },
  orange: { text: 'text-orange', border: 'border-l-orange', valueColor: 'text-orange' },
  purple: { text: 'text-purple', border: 'border-l-purple', valueColor: 'text-purple' },
  cyan: { text: 'text-cyan', border: 'border-l-cyan', valueColor: 'text-cyan' },
  amber: { text: 'text-amber', border: 'border-l-amber', valueColor: 'text-amber' },
};

function TrendIndicator({ value, suffix = '' }: TrendData) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const Icon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown;
  const color = isPositive ? 'text-green' : isNeutral ? 'text-dim' : 'text-red';

  return (
    <span className={cn('inline-flex items-center gap-0.5 font-data text-[10px]', color)}>
      <Icon size={10} />
      <span className="tabular-nums">{isPositive ? '+' : ''}{value.toFixed(1)}{suffix}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  color = 'amber',
  icon,
  sparklineData,
  sparklineColor,
  trend,
  compact = true,
  loading = false,
}: StatCardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <Card className={cn('border-l-2', colors.border, '!p-2.5')}>
        <div className="space-y-2 animate-pulse">
          <div className="h-2.5 bg-s2 rounded w-16" />
          <div className="h-5 bg-s2 rounded w-12" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'border-l-2 group hover:border-amber/30 transition-all duration-200 relative overflow-hidden',
      colors.border,
      compact ? '!p-2.5' : '!p-3'
    )}>
      {/* Subtle hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-[0.15em] text-dim font-data leading-none">{label}</span>
          {icon && <div className="text-dim">{icon}</div>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('font-data text-lg font-bold leading-tight tabular-nums', colors.valueColor)}>
              {typeof value === 'number' ? (
                <NumberAnimation value={value} className={colors.valueColor} />
              ) : (
                value
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {subtitle && <p className="text-[10px] text-dim font-data">{subtitle}</p>}
              {trend && <TrendIndicator value={trend.value} suffix={trend.suffix} />}
            </div>
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
              <Sparkline
                data={sparklineData}
                width={56}
                height={18}
                color={sparklineColor || '#00e5ff'}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
