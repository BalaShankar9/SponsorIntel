'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

interface IndustryTrendsProps {
  loading: boolean;
}

interface IndustryData {
  industry: string;
  count: number;
}

export function IndustryTrends({ loading: parentLoading }: IndustryTrendsProps) {
  const [data, setData] = useState<IndustryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: rows } = await supabase
        .from('company_profiles')
        .select('industry_primary')
        .not('industry_primary', 'is', null)
        .limit(5000);

      if (rows) {
        const counts: Record<string, number> = {};
        rows.forEach((r) => {
          const ind = r.industry_primary as string;
          if (ind) counts[ind] = (counts[ind] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([industry, count]) => ({ industry, count }));
        setData(sorted);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading || parentLoading) {
    return (
      <div className="border border-border bg-s1 p-4">
        <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">INDUSTRY DISTRIBUTION</h3>
        <div className="h-64 animate-pulse bg-s2/30 rounded" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border border-border bg-s1 p-4">
        <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">INDUSTRY DISTRIBUTION</h3>
        <div className="flex h-64 items-center justify-center text-dim font-data text-xs">CLASSIFYING INDUSTRIES...</div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-s1 p-4">
      <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
        INDUSTRY DISTRIBUTION <span className="text-dim font-normal">{'// TOP 15 BY SIC CODE'}</span>
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="none" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: '#888888', fontFamily: 'JetBrains Mono' }} stroke="#1a1a1a" />
            <YAxis
              type="category"
              dataKey="industry"
              tick={{ fontSize: 9, fill: '#888888', fontFamily: 'JetBrains Mono' }}
              stroke="#1a1a1a"
              width={110}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #f5a623', borderRadius: 0, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#e0e0e0' }}
              formatter={(value: number) => [value.toLocaleString(), 'Sponsors']}
            />
            <Bar dataKey="count" fill="#f5a623" radius={[0, 2, 2, 0]} name="Sponsors" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
