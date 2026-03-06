'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface GeographicShiftsProps {
  loading: boolean;
}

interface CityGrowth {
  city: string;
  growth: number;
  trend: number[];
}

const sampleData: CityGrowth[] = [
  { city: 'Manchester', growth: 18.5, trend: [40, 45, 48, 52, 55, 60, 65, 68, 72, 75, 78, 82] },
  { city: 'Bristol', growth: 15.2, trend: [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52] },
  { city: 'Edinburgh', growth: 14.8, trend: [25, 27, 29, 30, 32, 33, 35, 37, 38, 40, 41, 43] },
  { city: 'Leeds', growth: 12.3, trend: [35, 36, 38, 39, 41, 42, 44, 45, 47, 48, 50, 52] },
  { city: 'Cambridge', growth: 11.7, trend: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31] },
  { city: 'Reading', growth: 10.4, trend: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39] },
  { city: 'Birmingham', growth: 9.8, trend: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61] },
  { city: 'Glasgow', growth: 8.5, trend: [22, 23, 24, 24, 25, 25, 26, 27, 27, 28, 29, 30] },
  { city: 'Newcastle', growth: 7.2, trend: [18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24] },
  { city: 'London', growth: 4.1, trend: [500, 505, 510, 515, 518, 522, 525, 530, 535, 540, 545, 550] },
];

function Sparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="#58a6ff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GeographicShifts({ loading }: GeographicShiftsProps) {
  if (loading) {
    return (
      <Card>
        <div className="h-80 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <div className="p-4">
        <CardHeader>
          <CardTitle>Top Cities by Growth Rate</CardTitle>
        </CardHeader>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">#</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">City</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Growth</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Trend</th>
          </tr>
        </thead>
        <tbody>
          {sampleData.map((city, idx) => (
            <tr key={city.city} className="border-b border-border/50 transition-colors hover:bg-s2">
              <td className="px-4 py-2.5 text-xs text-dim2">{idx + 1}</td>
              <td className="px-4 py-2.5 text-sm font-medium text-text">{city.city}</td>
              <td className="px-4 py-2.5 text-right">
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${city.growth >= 0 ? 'text-green' : 'text-red'}`}>
                  {city.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {city.growth >= 0 ? '+' : ''}{city.growth}%
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Sparkline data={city.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
