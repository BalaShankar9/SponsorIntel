'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ScoreBreakdown } from '@/types';

interface ScoreRadarProps {
  breakdown: ScoreBreakdown | null;
}

export function ScoreRadar({ breakdown }: ScoreRadarProps) {
  if (!breakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score Breakdown</CardTitle>
        </CardHeader>
        <div className="flex h-64 items-center justify-center text-sm text-dim">
          No score data available
        </div>
      </Card>
    );
  }

  const data = [
    { factor: 'Compliance', value: breakdown.compliance_score ?? 0 },
    { factor: 'Financial', value: breakdown.financial_health_score ?? 0 },
    { factor: 'Hiring', value: breakdown.hiring_activity_score ?? 0 },
    { factor: 'Reputation', value: breakdown.reputation_score ?? 0 },
    { factor: 'Legitimacy', value: breakdown.legitimacy_score ?? 0 },
    { factor: 'Track Record', value: breakdown.track_record_score ?? 0 },
    { factor: 'Growth', value: breakdown.growth_signal_score ?? 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Breakdown</CardTitle>
        <span className="text-2xl font-bold text-accent">{breakdown.overall_score}</span>
      </CardHeader>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#21262d" />
          <PolarAngleAxis
            dataKey="factor"
            tick={{ fontSize: 11, fill: '#8b949e' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#6e7681' }}
            axisLine={false}
          />
          <Radar
            dataKey="value"
            stroke="#58a6ff"
            fill="#58a6ff"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
