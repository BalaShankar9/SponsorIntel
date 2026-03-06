'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TrendPoint } from '@/types';

interface GrowthTrendProps {
  data: TrendPoint[];
  loading: boolean;
}

export function GrowthTrend({ data, loading }: GrowthTrendProps) {
  if (loading) {
    return (
      <Card>
        <div className="h-80 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  const firstVal = data.length > 0 ? data[0].value : 0;
  const lastVal = data.length > 0 ? data[data.length - 1].value : 0;
  const growthPct = firstVal > 0 ? (((lastVal - firstVal) / firstVal) * 100).toFixed(1) : '0';
  const isPositive = Number(growthPct) >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsor Growth (12 Months)</CardTitle>
        <span className={`text-sm font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
          {isPositive ? '+' : ''}{growthPct}%
        </span>
      </CardHeader>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#58a6ff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#58a6ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} stroke="#30363d" />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} stroke="#30363d" />
            <Tooltip
              contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3' }}
              labelStyle={{ color: '#8b949e' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#58a6ff"
              fill="url(#growthGrad)"
              strokeWidth={2}
              name="Sponsors"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
