'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TrendPoint } from '@/types';

interface GrowthTrendProps {
  data: TrendPoint[];
  loading: boolean;
}

export function GrowthTrend({ data, loading }: GrowthTrendProps) {
  if (loading) {
    return (
      <div className="border border-s3 bg-s1 p-4">
        <div className="h-64 animate-pulse bg-s2/30" />
      </div>
    );
  }

  const firstVal = data.length > 0 ? data[0].value : 0;
  const lastVal = data.length > 0 ? data[data.length - 1].value : 0;
  const growthPct = firstVal > 0 ? (((lastVal - firstVal) / firstVal) * 100).toFixed(1) : '0';
  const isPositive = Number(growthPct) >= 0;

  return (
    <div className="border border-border bg-s1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-amber">
          CUMULATIVE SPONSOR GROWTH <span className="text-dim font-normal">{'// TOTAL OVER TIME'}</span>
        </h3>
        <div className="flex items-center gap-3">
          <span className="font-data text-sm font-bold text-text">{lastVal.toLocaleString()}</span>
          <span className={`font-data text-xs font-bold ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? '+' : ''}{growthPct}%
          </span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5a623" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="none" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888888', fontFamily: 'JetBrains Mono' }} stroke="#1a1a1a" />
            <YAxis tick={{ fontSize: 10, fill: '#888888', fontFamily: 'JetBrains Mono' }} stroke="#1a1a1a" />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #f5a623', borderRadius: 0, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#e0e0e0' }}
              labelStyle={{ color: '#f5a623' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#f5a623"
              fill="url(#growthGrad)"
              strokeWidth={2}
              name="Sponsors"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
