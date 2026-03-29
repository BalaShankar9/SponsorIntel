'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GrowthTrend } from '@/components/trends/GrowthTrend';
import { IndustryTrends } from '@/components/trends/IndustryTrends';
import { SalaryTrends } from '@/components/trends/SalaryTrends';
import { GeographicShifts } from '@/components/trends/GeographicShifts';
import type { TrendPoint } from '@/types';

export default function TrendsPage() {
  const [growthData, setGrowthData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, aRated: 0, enriched: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        const [sponsorsRes, totalRes, aRatedRes, enrichedRes] = await Promise.all([
          supabase
            .from('sponsors')
            .select('first_seen_date')
            .not('first_seen_date', 'is', null)
            .order('first_seen_date', { ascending: true })
            .limit(5000),
          supabase.from('sponsors').select('id', { count: 'exact', head: true }),
          supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('rating', 'A'),
          supabase.from('company_profiles').select('id', { count: 'exact', head: true }).not('companies_house_number', 'is', null),
        ]);

        setStats({
          total: totalRes.count || 0,
          aRated: aRatedRes.count || 0,
          enriched: enrichedRes.count || 0,
        });

        if (sponsorsRes.data && sponsorsRes.data.length > 0) {
          const monthCounts: Record<string, number> = {};
          sponsorsRes.data.forEach((s) => {
            const date = s.first_seen_date as string;
            const month = date.substring(0, 7);
            monthCounts[month] = (monthCounts[month] || 0) + 1;
          });

          let cumulative = 0;
          const growth: TrendPoint[] = Object.entries(monthCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => {
              cumulative += count;
              return { date, value: cumulative };
            });

          setGrowthData(growth);
        }
      } catch (err) {
        console.error('Failed to fetch trends:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber/30 pb-2">
        <div>
          <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
            TRENDS & ANALYTICS
          </h1>
          <p className="font-data text-xs text-dim">
            UK SPONSORSHIP MARKET // REAL-TIME INTELLIGENCE
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="font-data text-lg font-bold text-text">{stats.total.toLocaleString()}</div>
            <div className="font-data text-[9px] text-dim uppercase">TOTAL SPONSORS</div>
          </div>
          <div className="text-right">
            <div className="font-data text-lg font-bold text-green">{stats.aRated.toLocaleString()}</div>
            <div className="font-data text-[9px] text-dim uppercase">A-RATED</div>
          </div>
          <div className="text-right">
            <div className="font-data text-lg font-bold text-cyan">{stats.enriched.toLocaleString()}</div>
            <div className="font-data text-[9px] text-dim uppercase">CH MATCHED</div>
          </div>
        </div>
      </div>

      {/* 2x2 Chart Grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <GrowthTrend data={growthData} loading={loading} />
        <IndustryTrends loading={loading} />
        <SalaryTrends loading={loading} />
        <GeographicShifts loading={loading} />
      </div>
    </div>
  );
}
