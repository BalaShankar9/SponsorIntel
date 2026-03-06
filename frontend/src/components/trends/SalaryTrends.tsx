'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SalaryTrendsProps {
  loading: boolean;
}

const sampleData = [
  { sector: 'Technology', current: 62000, previous: 58000 },
  { sector: 'Finance', current: 58000, previous: 55000 },
  { sector: 'Healthcare', current: 45000, previous: 43000 },
  { sector: 'Education', current: 38000, previous: 37000 },
  { sector: 'Hospitality', current: 32000, previous: 30000 },
  { sector: 'Construction', current: 42000, previous: 40000 },
  { sector: 'Retail', current: 30000, previous: 29000 },
  { sector: 'Manufacturing', current: 40000, previous: 38000 },
];

export function SalaryTrends({ loading }: SalaryTrendsProps) {
  if (loading) {
    return (
      <Card>
        <div className="h-80 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Median Salary by Sector</CardTitle>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-accent" /> Current</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-s4" /> Previous</span>
        </div>
      </CardHeader>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sampleData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="sector" tick={{ fontSize: 10, fill: '#8b949e' }} stroke="#30363d" angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} stroke="#30363d" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3' }}
              formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
            />
            <Bar dataKey="previous" fill="#30363d" radius={[2, 2, 0, 0]} name="Previous" />
            <Bar dataKey="current" fill="#58a6ff" radius={[2, 2, 0, 0]} name="Current" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
