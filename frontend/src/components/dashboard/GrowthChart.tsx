'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { TrendPoint } from '@/types';

interface GrowthChartProps {
  data: TrendPoint[];
  loading: boolean;
}

export function GrowthChart({ data, loading }: GrowthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsor Growth Over Time</CardTitle>
      </CardHeader>
      {loading ? (
        <div className="h-64 animate-pulse rounded bg-s2" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="date"
              stroke="#6e7681"
              tick={{ fontSize: 11, fill: '#8b949e' }}
              tickLine={false}
            />
            <YAxis
              stroke="#6e7681"
              tick={{ fontSize: 11, fill: '#8b949e' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                color: '#e6edf3',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#58a6ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#58a6ff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
