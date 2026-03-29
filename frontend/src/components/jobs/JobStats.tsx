'use client';

import { formatNumber } from '@/lib/utils';
import type { JobStats as JobStatsType } from '@/types';

interface JobStatsProps {
  stats: JobStatsType | null;
  loading: boolean;
}

const sourceBarColors: Record<string, string> = {
  indeed: 'bg-blue',
  linkedin: 'bg-cyan',
  reed: 'bg-amber',
  totaljobs: 'bg-purple',
  glassdoor: 'bg-green',
  gov_find_a_job: 'bg-red',
};

export function JobStatsPanel({ stats, loading }: JobStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse bg-s1" />
        ))}
      </div>
    );
  }

  const totalBySource = Object.values(stats.by_source).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-3">
      {/* Source Breakdown */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="border border-s3 bg-s1 p-4">
          <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
            SOURCE BREAKDOWN
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.by_source)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <div key={source}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="font-data text-[10px] uppercase text-dim">{source}</span>
                    <span className="font-data text-xs font-bold text-text">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-1 w-full bg-s3">
                    <div
                      className={`h-1 ${sourceBarColors[source] || 'bg-amber'}`}
                      style={{ width: `${(count / totalBySource) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="border border-s3 bg-s1 p-4">
          <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
            TOP CITIES
          </h3>
          <div className="space-y-1">
            {stats.by_city.slice(0, 10).map((item, idx) => (
              <div key={item.city} className="flex items-center justify-between border-b border-s3/30 py-1">
                <span className="font-data text-xs text-dim">
                  <span className="mr-2 text-muted">{String(idx + 1).padStart(2, '0')}</span>
                  {item.city}
                </span>
                <span className="font-data text-xs font-bold text-amber">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
