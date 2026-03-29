'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { formatNumber } from '@/lib/utils';

interface IndustryItem {
  name: string;
  fullName: string;
  count: number;
}

const BAR_COLORS = ['#f5a623', '#00e5ff', '#a78bfa', '#4a9eff', '#00d4aa', '#ff4757', '#f5a623', '#00e5ff', '#a78bfa', '#4a9eff'];

export function IndustryBreakdown() {
  const [data, setData] = useState<IndustryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalIndustries, setTotalIndustries] = useState(0);

  useEffect(() => {
    async function fetchIndustries() {
      try {
        // Fetch industry_primary from company_profiles
        const { data: rows } = await supabase
          .from('company_profiles')
          .select('industry_primary')
          .not('industry_primary', 'is', null)
          .limit(20000);

        if (rows && rows.length > 0) {
          const counts: Record<string, number> = {};
          rows.forEach((r) => {
            const ind = r.industry_primary as string;
            if (ind && ind.trim()) {
              counts[ind] = (counts[ind] || 0) + 1;
            }
          });

          const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          setTotalIndustries(Object.keys(counts).length);
          setData(
            sorted.map(([name, count]) => ({
              fullName: name,
              name: name.length > 28 ? name.slice(0, 28) + '\u2026' : name,
              count,
            }))
          );
        }
      } catch (err) {
        console.error('IndustryBreakdown fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchIndustries();
  }, []);

  return (
    <div className="border border-border bg-s1 flex flex-col">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[INDUSTRY BREAKDOWN]</h3>
        <span className="font-data text-[10px] text-dim">
          {totalIndustries > 0 ? `${totalIndustries} SECTORS` : ''}
        </span>
      </div>
      <div className="p-3 flex-1">
        {loading ? (
          <div className="h-[340px] animate-pulse bg-s2" />
        ) : data.length === 0 ? (
          <div className="h-[340px] flex items-center justify-center">
            <span className="font-data text-[11px] text-dim">NO INDUSTRY DATA</span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  stroke="transparent"
                  tick={{ fontSize: 9, fill: '#555555', fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="transparent"
                  tick={{ fontSize: 9, fill: '#888888', fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={160}
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
                  formatter={(value: number) => [value.toLocaleString(), 'Companies']}
                  labelFormatter={(_label: string, payload: Array<{ payload?: { fullName?: string } }>) =>
                    payload?.[0]?.payload?.fullName || _label
                  }
                />
                <Bar dataKey="count" radius={[0, 2, 2, 0]} barSize={16}>
                  {data.map((_, index) => (
                    <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Compact legend */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {data.slice(0, 5).map((item, idx) => (
                <div key={item.fullName} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5" style={{ backgroundColor: BAR_COLORS[idx] }} />
                  <span className="font-data text-[9px] text-dim">{item.fullName.length > 20 ? item.fullName.slice(0, 20) + '\u2026' : item.fullName}</span>
                  <span className="font-data text-[9px] text-amber font-bold">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
