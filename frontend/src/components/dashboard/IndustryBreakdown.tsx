'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface IndustryData {
  industry: string;
  count: number;
}

interface IndustryBreakdownProps {
  data: IndustryData[];
  loading: boolean;
}

const BAR_COLORS = [
  '#58a6ff', '#39d2c0', '#3fb950', '#bc8cff', '#d29922',
  '#f778ba', '#e3b341', '#1f6feb', '#f85149', '#8b949e',
];

export function IndustryBreakdown({ data, loading }: IndustryBreakdownProps) {
  const chartData = data.slice(0, 10).map((item) => ({
    name: item.industry?.length > 25 ? item.industry.slice(0, 25) + '...' : item.industry,
    value: item.count,
    fullName: item.industry,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Industries</CardTitle>
      </CardHeader>
      {loading ? (
        <div className="h-64 animate-pulse rounded bg-s2" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <XAxis
              type="number"
              stroke="#6e7681"
              tick={{ fontSize: 11, fill: '#8b949e' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#6e7681"
              tick={{ fontSize: 11, fill: '#8b949e' }}
              tickLine={false}
              axisLine={false}
              width={160}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                color: '#e6edf3',
                fontSize: '12px',
              }}
              formatter={(value: number) => [value.toLocaleString(), 'Sponsors']}
              labelFormatter={(_label: string, payload: Array<{ payload?: { fullName?: string } }>) =>
                payload?.[0]?.payload?.fullName || _label
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
