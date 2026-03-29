'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';

interface SalaryTrendsProps {
  loading: boolean;
}

interface RatingData {
  name: string;
  value: number;
  color: string;
}

export function SalaryTrends({ loading: parentLoading }: SalaryTrendsProps) {
  const [data, setData] = useState<RatingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgScore: 0, highScore: 0, lowScore: 0 });

  useEffect(() => {
    async function fetch() {
      // Get score distribution
      const { data: scores } = await supabase
        .from('sponsor_scores')
        .select('overall_score')
        .not('overall_score', 'is', null)
        .limit(10000);

      if (scores && scores.length > 0) {
        const brackets = { 'Excellent (80-100)': 0, 'Good (60-79)': 0, 'Fair (40-59)': 0, 'Low (0-39)': 0 };
        let total = 0, high = 0, low = 100;

        scores.forEach((s) => {
          const sc = s.overall_score as number;
          total += sc;
          if (sc > high) high = sc;
          if (sc < low) low = sc;
          if (sc >= 80) brackets['Excellent (80-100)']++;
          else if (sc >= 60) brackets['Good (60-79)']++;
          else if (sc >= 40) brackets['Fair (40-59)']++;
          else brackets['Low (0-39)']++;
        });

        const colors = ['#00d4aa', '#f5a623', '#4a9eff', '#ff4757'];
        setData(Object.entries(brackets).map(([name, value], i) => ({ name, value, color: colors[i] })));
        setStats({ avgScore: Math.round(total / scores.length), highScore: high, lowScore: low });
      }
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading || parentLoading) {
    return (
      <div className="border border-border bg-s1 p-4">
        <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">SCORE DISTRIBUTION</h3>
        <div className="h-64 animate-pulse bg-s2/30 rounded" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border border-border bg-s1 p-4">
        <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">SCORE DISTRIBUTION</h3>
        <div className="flex h-64 items-center justify-center text-dim font-data text-xs">COMPUTING SCORES...</div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-s1 p-4">
      <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
        SCORE DISTRIBUTION <span className="text-dim font-normal">{'// SPONSOR QUALITY BREAKDOWN'}</span>
      </h3>
      <div className="flex items-center gap-6">
        <div className="h-52 w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="#0a0a0a" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #f5a623', borderRadius: 0, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#e0e0e0' }}
                formatter={(value: number) => [value.toLocaleString(), 'Sponsors']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="font-data text-2xl font-bold text-amber">{stats.avgScore}</div>
              <div className="font-data text-[9px] text-dim uppercase">AVG SCORE</div>
            </div>
            <div className="text-center">
              <div className="font-data text-2xl font-bold text-green">{stats.highScore}</div>
              <div className="font-data text-[9px] text-dim uppercase">HIGHEST</div>
            </div>
            <div className="text-center">
              <div className="font-data text-2xl font-bold text-red">{stats.lowScore}</div>
              <div className="font-data text-[9px] text-dim uppercase">LOWEST</div>
            </div>
          </div>
          {/* Legend */}
          <div className="space-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="font-data text-[11px] text-text flex-1">{d.name}</span>
                <span className="font-data text-[11px] text-amber font-bold">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
