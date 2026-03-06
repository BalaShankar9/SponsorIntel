'use client';

import { cn } from '@/lib/utils';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan';
  icon?: React.ReactNode;
}

const colorMap: Record<string, { text: string; border: string }> = {
  blue: { text: 'text-accent', border: 'border-l-accent' },
  green: { text: 'text-green', border: 'border-l-green' },
  red: { text: 'text-red', border: 'border-l-red' },
  orange: { text: 'text-orange', border: 'border-l-orange' },
  purple: { text: 'text-purple', border: 'border-l-purple' },
  cyan: { text: 'text-cyan', border: 'border-l-cyan' },
};

export function StatCard({ label, value, subtitle, color = 'blue', icon }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <Card className={cn('border-l-2', colors.border)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-dim">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold', colors.text)}>{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-dim2">{subtitle}</p>}
        </div>
        {icon && <div className="text-dim2">{icon}</div>}
      </div>
    </Card>
  );
}
