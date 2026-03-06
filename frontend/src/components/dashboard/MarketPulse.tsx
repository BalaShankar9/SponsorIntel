'use client';

import { Activity, CheckCircle, XCircle, Plus, Minus, RefreshCw } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { formatNumber } from '@/lib/utils';
import type { DashboardOverview } from '@/types';

interface MarketPulseProps {
  data: DashboardOverview | null;
  loading: boolean;
}

export function MarketPulse({ data, loading }: MarketPulseProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-s1" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Active Sponsors"
        value={formatNumber(data.total_sponsors)}
        subtitle="Licensed companies"
        color="blue"
        icon={<Activity size={16} />}
      />
      <StatCard
        label="A-Rated"
        value={formatNumber(data.a_rated)}
        subtitle={`${data.total_sponsors ? ((data.a_rated / data.total_sponsors) * 100).toFixed(1) : 0}% of total`}
        color="green"
        icon={<CheckCircle size={16} />}
      />
      <StatCard
        label="B-Rated"
        value={formatNumber(data.b_rated)}
        subtitle="Action required"
        color="red"
        icon={<XCircle size={16} />}
      />
      <StatCard
        label="Added (30d)"
        value={`+${formatNumber(data.added_30d)}`}
        subtitle="New sponsors"
        color="green"
        icon={<Plus size={16} />}
      />
      <StatCard
        label="Removed (30d)"
        value={formatNumber(data.removed_30d)}
        subtitle="Revoked/suspended"
        color="orange"
        icon={<Minus size={16} />}
      />
      <StatCard
        label="Changed (30d)"
        value={formatNumber(data.changed_30d)}
        subtitle="Rating/route changes"
        color="purple"
        icon={<RefreshCw size={16} />}
      />
    </div>
  );
}
