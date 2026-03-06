'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MarketPulse } from '@/components/dashboard/MarketPulse';
import { GrowthChart } from '@/components/dashboard/GrowthChart';
import { TopHiring } from '@/components/dashboard/TopHiring';
import { LiveFeed } from '@/components/dashboard/LiveFeed';
import { IndustryBreakdown } from '@/components/dashboard/IndustryBreakdown';
import type { DashboardOverview, AnalyticsTrends } from '@/types';

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewData, trendsData] = await Promise.all([
          api.get<DashboardOverview>('/api/v1/analytics/dashboard'),
          api.get<AnalyticsTrends>('/api/v1/analytics/trends'),
        ]);
        setOverview(overviewData);
        setTrends(trendsData);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-dim">UK Sponsorship Market Overview</p>
      </div>

      {/* Market Pulse - 6 stat cards */}
      <MarketPulse data={overview} loading={loading} />

      {/* Two-column: Growth + Live Feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrowthChart data={trends?.sponsor_growth || []} loading={loading} />
        </div>
        <div>
          <LiveFeed />
        </div>
      </div>

      {/* Two-column: Top Hiring + Industry Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopHiring data={trends?.top_hiring || []} loading={loading} />
        <IndustryBreakdown data={trends?.top_industries || []} loading={loading} />
      </div>
    </div>
  );
}
