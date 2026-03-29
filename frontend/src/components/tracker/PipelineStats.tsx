'use client';

import { Clock } from 'lucide-react';
import type { WatchlistItem } from '@/types';

interface PipelineStatsProps {
  items: WatchlistItem[];
}

const statusColors: Record<string, string> = {
  watching: 'bg-amber',
  applied: 'bg-blue',
  interviewing: 'bg-cyan',
  offered: 'bg-green',
  rejected: 'bg-red',
};

export function PipelineStats({ items }: PipelineStatsProps) {
  const applied = items.filter((i) => i.status !== 'watching');
  const offered = items.filter((i) => i.status === 'offered');
  const rejected = items.filter((i) => i.status === 'rejected');
  const responseRate = applied.length > 0
    ? Math.round(((offered.length + rejected.length) / applied.length) * 100)
    : 0;

  const statusCounts: Record<string, number> = {};
  items.forEach((i) => {
    const s = i.status || 'watching';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const total = items.length || 1;

  const upcoming = items
    .filter((i) => i.next_followup && new Date(i.next_followup) > new Date())
    .sort((a, b) => new Date(a.next_followup!).getTime() - new Date(b.next_followup!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Stat Row */}
      <div className="grid grid-cols-4 gap-px bg-border">
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">APPLICATIONS</p>
          <p className="font-data text-2xl font-bold text-amber">{applied.length}</p>
        </div>
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">RESPONSE RATE</p>
          <p className="font-data text-2xl font-bold text-green">{responseRate}%</p>
        </div>
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">OFFERS</p>
          <p className="font-data text-2xl font-bold text-cyan">{offered.length}</p>
        </div>
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">REJECTIONS</p>
          <p className="font-data text-2xl font-bold text-red">{rejected.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Pipeline Breakdown */}
        <div className="border border-s3 bg-s1 p-4">
          <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
            PIPELINE BREAKDOWN
          </h3>
          <div className="mb-3 flex h-3 overflow-hidden bg-s3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className={`${statusColors[status] || 'bg-muted'} transition-all`}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${status}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 font-data text-[10px]">
                <span className={`inline-block h-2 w-2 ${statusColors[status] || 'bg-muted'}`} />
                <span className="uppercase text-dim">{status}</span>
                <span className="font-bold text-text">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="border border-s3 bg-s1 p-4">
          <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
            UPCOMING FOLLOW-UPS
          </h3>
          {upcoming.length === 0 ? (
            <p className="font-data text-xs text-dim">NO UPCOMING FOLLOW-UPS SCHEDULED.</p>
          ) : (
            <div className="space-y-1">
              {upcoming.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-s3/30 py-1.5">
                  <div>
                    <p className="font-data text-xs text-text">{item.sponsor_name}</p>
                    <p className="font-data text-[9px] uppercase text-dim">{item.status}</p>
                  </div>
                  <div className="flex items-center gap-1 font-data text-[10px] text-amber">
                    <Clock size={10} />
                    {new Date(item.next_followup!).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
