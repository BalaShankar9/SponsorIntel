'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface IndustryTrendsProps {
  loading: boolean;
}

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f778ba'];

// Sample data - in production would come from API
const sampleData = [
  { month: 'Apr', Technology: 4200, Healthcare: 3100, Finance: 2800, Education: 2200, Hospitality: 1900 },
  { month: 'May', Technology: 4350, Healthcare: 3200, Finance: 2750, Education: 2300, Hospitality: 1850 },
  { month: 'Jun', Technology: 4500, Healthcare: 3150, Finance: 2900, Education: 2250, Hospitality: 2000 },
  { month: 'Jul', Technology: 4600, Healthcare: 3300, Finance: 2850, Education: 2350, Hospitality: 1950 },
  { month: 'Aug', Technology: 4800, Healthcare: 3400, Finance: 2950, Education: 2400, Hospitality: 2050 },
  { month: 'Sep', Technology: 4950, Healthcare: 3500, Finance: 3000, Education: 2500, Hospitality: 2100 },
  { month: 'Oct', Technology: 5100, Healthcare: 3550, Finance: 3100, Education: 2450, Hospitality: 2150 },
  { month: 'Nov', Technology: 5250, Healthcare: 3700, Finance: 3050, Education: 2550, Hospitality: 2200 },
  { month: 'Dec', Technology: 5200, Healthcare: 3650, Finance: 3150, Education: 2500, Hospitality: 2250 },
  { month: 'Jan', Technology: 5400, Healthcare: 3800, Finance: 3200, Education: 2600, Hospitality: 2300 },
  { month: 'Feb', Technology: 5550, Healthcare: 3900, Finance: 3250, Education: 2650, Hospitality: 2350 },
  { month: 'Mar', Technology: 5700, Healthcare: 4000, Finance: 3350, Education: 2700, Hospitality: 2400 },
];

const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Hospitality'];

export function IndustryTrends({ loading }: IndustryTrendsProps) {
  const [viewMode, setViewMode] = useState<'absolute' | 'percentage'>('absolute');

  if (loading) {
    return (
      <Card>
        <div className="h-80 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  const chartData = viewMode === 'percentage'
    ? sampleData.map((d) => {
        const total = industries.reduce((s, ind) => s + (d[ind as keyof typeof d] as number), 0);
        const row: Record<string, unknown> = { month: d.month };
        industries.forEach((ind) => {
          row[ind] = total > 0 ? (((d[ind as keyof typeof d] as number) / total) * 100).toFixed(1) : 0;
        });
        return row;
      })
    : sampleData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Industry Trends (Top 5)</CardTitle>
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'absolute' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('absolute')}
          >
            #
          </Button>
          <Button
            variant={viewMode === 'percentage' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('percentage')}
          >
            %
          </Button>
        </div>
      </CardHeader>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8b949e' }} stroke="#30363d" />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} stroke="#30363d" />
            <Tooltip
              contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
            {industries.map((ind, i) => (
              <Line
                key={ind}
                type="monotone"
                dataKey={ind}
                stroke={COLORS[i]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
