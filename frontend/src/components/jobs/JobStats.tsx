'use client';

import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Briefcase, TrendingUp, Target, DollarSign, Percent } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import type { JobStats as JobStatsType } from '@/types';

interface JobStatsProps {
  stats: JobStatsType | null;
  loading: boolean;
}

const sourceBarColors: Record<string, string> = {
  indeed: 'bg-accent',
  linkedin: 'bg-cyan',
  reed: 'bg-orange',
  totaljobs: 'bg-purple',
  glassdoor: 'bg-green',
  gov_find_a_job: 'bg-pink',
};

export function JobStatsPanel({ stats, loading }: JobStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-s1" />
        ))}
      </div>
    );
  }

  const totalBySource = Object.values(stats.by_source).reduce((a, b) => a + b, 0) || 1;
  const sponsorshipPct = stats.total_active > 0
    ? Math.round((stats.sponsorship_likely_count / stats.total_active) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Active Jobs"
          value={formatNumber(stats.total_active)}
          color="blue"
          icon={<Briefcase size={18} />}
        />
        <StatCard
          label="New (7 days)"
          value={formatNumber(stats.new_7_days)}
          color="green"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Sponsorship Likely"
          value={formatNumber(stats.sponsorship_likely_count)}
          color="cyan"
          icon={<Target size={18} />}
        />
        <StatCard
          label="Median Salary"
          value={stats.median_salary ? `£${formatNumber(stats.median_salary)}` : '--'}
          color="purple"
          icon={<DollarSign size={18} />}
        />
        <StatCard
          label="% with Sponsorship"
          value={`${sponsorshipPct}%`}
          color="orange"
          icon={<Percent size={18} />}
        />
      </div>

      {/* Source Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source Breakdown</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {Object.entries(stats.by_source)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <div key={source}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-dim">{source}</span>
                    <span className="text-xs text-dim2">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-s3">
                    <div
                      className={`h-2 rounded-full ${sourceBarColors[source] || 'bg-accent'}`}
                      style={{ width: `${(count / totalBySource) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Cities</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {stats.by_city.slice(0, 8).map((item) => (
              <div key={item.city} className="flex items-center justify-between">
                <span className="text-sm text-dim">{item.city}</span>
                <span className="text-sm font-medium text-text">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
