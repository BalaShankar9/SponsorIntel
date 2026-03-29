'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { formatNumber } from '@/lib/utils';

interface RatingData {
  aRated: number;
  bRated: number;
  unrated: number;
}

interface RouteData {
  route: string;
  count: number;
}

const COLORS = {
  a: '#00d4aa',
  b: '#ff4757',
  unrated: '#555555',
};

const ROUTE_COLORS = ['#f5a623', '#00e5ff', '#a78bfa', '#4a9eff', '#00d4aa', '#ff4757'];

function CustomTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill?: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border border-border bg-s1 px-3 py-2 font-data text-[11px]">
      <span className="text-text">{payload[0].name}: </span>
      <span className="font-bold" style={{ color: payload[0].payload.fill || '#f5a623' }}>
        {payload[0].value.toLocaleString()}
      </span>
    </div>
  );
}

export function GrowthChart() {
  const [ratingData, setRatingData] = useState<RatingData | null>(null);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [sponsorTypeData, setSponsorTypeData] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [totalRes, aRes, bRes, typeRes, routeRes] = await Promise.all([
          supabase.from('sponsors').select('id', { count: 'exact', head: true }),
          supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('rating', 'A'),
          supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('rating', 'B'),
          supabase.from('sponsors').select('sponsor_type').not('sponsor_type', 'is', null).limit(10000),
          supabase.from('sponsors').select('route').not('route', 'is', null).limit(10000),
        ]);

        const total = totalRes.count || 0;
        const aCount = aRes.count || 0;
        const bCount = bRes.count || 0;

        setRatingData({
          aRated: aCount,
          bRated: bCount,
          unrated: Math.max(0, total - aCount - bCount),
        });

        // Sponsor type breakdown
        if (typeRes.data) {
          const typeCounts: Record<string, number> = {};
          typeRes.data.forEach((r) => {
            const t = r.sponsor_type as string;
            if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
          });
          setSponsorTypeData(
            Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '\u2026' : name, count }))
          );
        }

        // Route breakdown
        if (routeRes.data) {
          const routeCounts: Record<string, number> = {};
          routeRes.data.forEach((r) => {
            const routes = r.route as string[];
            if (routes && Array.isArray(routes)) {
              routes.forEach((rt) => {
                if (rt) routeCounts[rt] = (routeCounts[rt] || 0) + 1;
              });
            }
          });
          setRouteData(
            Object.entries(routeCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([route, count]) => ({ route: route.length > 25 ? route.slice(0, 25) + '\u2026' : route, count }))
          );
        }
      } catch (err) {
        console.error('GrowthChart fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="border border-border bg-s1 p-3">
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[RATING DISTRIBUTION]</h3>
        </div>
        <div className="h-[340px] animate-pulse bg-s2" />
      </div>
    );
  }

  const pieData = ratingData
    ? [
        { name: 'A-Rated', value: ratingData.aRated, fill: COLORS.a },
        { name: 'B-Rated', value: ratingData.bRated, fill: COLORS.b },
        ...(ratingData.unrated > 0 ? [{ name: 'Unrated', value: ratingData.unrated, fill: COLORS.unrated }] : []),
      ]
    : [];

  const totalSponsors = ratingData ? ratingData.aRated + ratingData.bRated + ratingData.unrated : 0;

  return (
    <div className="border border-border bg-s1">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[RATING DISTRIBUTION]</h3>
        </div>
        <span className="font-data text-[10px] text-dim">
          {formatNumber(totalSponsors)} TOTAL
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Left: Donut Chart */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-data text-[10px] text-dim uppercase tracking-wider">A vs B Rating</span>
          </div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  dataKey="value"
                  stroke="#0a0a0a"
                  strokeWidth={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-data text-2xl font-bold text-amber">{formatNumber(totalSponsors)}</span>
              <span className="font-data text-[9px] text-dim uppercase tracking-wider">Sponsors</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-1">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2" style={{ backgroundColor: entry.fill }} />
                <span className="font-data text-[10px] text-dim">{entry.name}</span>
                <span className="font-data text-[10px] font-bold" style={{ color: entry.fill }}>
                  {formatNumber(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Sponsor Type Bar Chart */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-data text-[10px] text-dim uppercase tracking-wider">Sponsor Type</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sponsorTypeData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
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
                width={130}
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
                formatter={(value: number) => [value.toLocaleString(), 'Sponsors']}
              />
              <Bar dataKey="count" fill="#f5a623" radius={[0, 2, 2, 0]} barSize={14} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
