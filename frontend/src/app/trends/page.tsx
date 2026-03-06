'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { GrowthTrend } from '@/components/trends/GrowthTrend';
import { IndustryTrends } from '@/components/trends/IndustryTrends';
import { SalaryTrends } from '@/components/trends/SalaryTrends';
import { GeographicShifts } from '@/components/trends/GeographicShifts';
import type { TrendPoint } from '@/types';

export default function TrendsPage() {
  const isPro = useAuthStore((s) => s.isPro);
  const [growthData, setGrowthData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api.get<{ sponsor_growth: TrendPoint[] }>('/api/v1/analytics/trends');
        setGrowthData(data.sponsor_growth || []);
      } catch (err) {
        console.error('Failed to fetch trends:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const content = (
    <div className="space-y-4">
      <GrowthTrend data={growthData} loading={loading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IndustryTrends loading={loading} />
        <SalaryTrends loading={loading} />
      </div>

      <GeographicShifts loading={loading} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Trends & Analytics</h1>
        <p className="text-sm text-dim">Deep-dive into UK sponsorship market trends</p>
      </div>

      <ProGate isAllowed={isPro} feature="Trends & Analytics">
        {content}
      </ProGate>
    </div>
  );
}
