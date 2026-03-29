'use client';

import { useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ScoreBreakdown } from '@/types';

interface ScoreRadarProps {
  breakdown: ScoreBreakdown | null;
}

const factorMeta: Record<string, { description: string; key: string }> = {
  Compliance: { description: 'Rating history, consecutive A-rating days, route coverage', key: 'compliance_score' },
  Financial: { description: 'Companies House filings, insolvency history, CCJs, credit risk', key: 'financial_health_score' },
  Reputation: { description: 'Glassdoor, Trustpilot, Google ratings and review counts', key: 'reputation_score' },
  Legitimacy: { description: 'Domain age, website presence, social profiles, tech stack', key: 'legitimacy_score' },
  'Track Record': { description: 'Time as sponsor, rating stability, consistency score', key: 'track_record_score' },
};

export function ScoreRadar({ breakdown }: ScoreRadarProps) {
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null);

  if (!breakdown) {
    return (
      <div className="border border-border bg-s1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-s2/50 px-3 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber">Score Breakdown</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="h-16 w-16 rounded-lg bg-s2 flex items-center justify-center mb-3">
            <span className="font-data text-2xl text-muted">?</span>
          </div>
          <p className="font-data text-[11px] text-dim uppercase tracking-wider">Awaiting Analysis</p>
          <p className="mt-1 text-[10px] text-muted text-center">
            Score data will appear once this sponsor has been analysed.
          </p>
        </div>
      </div>
    );
  }

  const data = [
    { factor: 'Compliance', value: breakdown.compliance_score ?? 0, fullMark: 100 },
    { factor: 'Financial', value: breakdown.financial_health_score ?? 0, fullMark: 100 },
    { factor: 'Reputation', value: breakdown.reputation_score ?? 0, fullMark: 100 },
    { factor: 'Legitimacy', value: breakdown.legitimacy_score ?? 0, fullMark: 100 },
    { factor: 'Track Record', value: breakdown.track_record_score ?? 0, fullMark: 100 },
  ];

  const scoreColor = breakdown.overall_score >= 80 ? '#00d4aa' : breakdown.overall_score >= 60 ? '#f5a623' : '#ff4757';

  return (
    <div className="border border-border bg-s1 overflow-hidden">
      {/* Header with overall score */}
      <div className="flex items-center justify-between border-b border-border bg-s2/50 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber">Score Radar</h3>
        <div className="flex items-baseline gap-1">
          <span className="font-data text-xl font-bold" style={{ color: scoreColor }}>
            {breakdown.overall_score}
          </span>
          <span className="font-data text-[9px] text-muted">/100</span>
        </div>
      </div>

      {/* Radar chart */}
      <div className="px-2 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#1a1a1a" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="factor"
              tick={{ fontSize: 9, fill: '#888888', fontFamily: 'JetBrains Mono, monospace' }}
              onMouseEnter={(e) => {
                if (e && typeof e === 'object' && 'value' in e) {
                  setHoveredFactor(e.value as string);
                }
              }}
              onMouseLeave={() => setHoveredFactor(null)}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111111',
                border: '1px solid #2a2a2a',
                borderRadius: '0px',
                color: '#e0e0e0',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '6px 10px',
              }}
              formatter={(value: number, _name: string, entry: { payload?: { factor?: string } }) => {
                const factor = entry?.payload?.factor || '';
                return [
                  <span key="v">
                    <span style={{ color: scoreColor, fontWeight: 'bold' }}>{value}</span>
                    <span style={{ color: '#555' }}>/100</span>
                  </span>,
                  factor,
                ];
              }}
            />
            {/* Fill area */}
            <Radar
              dataKey="value"
              stroke={scoreColor}
              fill={scoreColor}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            {/* Glow outline */}
            <Radar
              dataKey="value"
              stroke="#00e5ff"
              fill="none"
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Factor explanation on hover */}
      {hoveredFactor && factorMeta[hoveredFactor] && (
        <div className="mx-3 mb-2 rounded bg-s2 p-2 border border-border/50 animate-fadeIn">
          <p className="font-data text-[10px] font-bold text-amber">{hoveredFactor}</p>
          <p className="font-data text-[10px] text-dim mt-0.5">{factorMeta[hoveredFactor].description}</p>
        </div>
      )}

      {/* Score breakdown list */}
      <div className="border-t border-border px-3 py-2 space-y-1.5">
        {data.map((d) => {
          const v = d.value;
          const barColor = v >= 80 ? '#00d4aa' : v >= 60 ? '#f5a623' : '#ff4757';
          return (
            <div key={d.factor}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-data text-[10px] text-dim">{d.factor}</span>
                <span
                  className="font-data text-[11px] font-bold"
                  style={{ color: barColor }}
                >
                  {v}
                </span>
              </div>
              <div className="h-[3px] w-full bg-s3 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${v}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk flags */}
      {breakdown.risk_flags && breakdown.risk_flags.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <span className="font-data text-[9px] uppercase tracking-wider text-red">Risk Flags</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {breakdown.risk_flags.map((flag) => (
              <span key={flag} className="rounded bg-red/10 px-1.5 py-0.5 font-data text-[9px] text-red ring-1 ring-red/20">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Computed at */}
      {breakdown.computed_at && (
        <div className="border-t border-border/50 px-3 py-1.5">
          <span className="font-data text-[9px] text-muted">
            Computed {new Date(breakdown.computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}
