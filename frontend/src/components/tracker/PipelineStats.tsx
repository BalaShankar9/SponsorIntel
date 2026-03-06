'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import type { WatchlistItem } from '@/types';

interface PipelineStatsProps {
  items: WatchlistItem[];
}

const statusColors: Record<string, string> = {
  watching: 'bg-accent',
  applied: 'bg-cyan',
  interviewing: 'bg-purple',
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

  // Group by status for breakdown bar
  const statusCounts: Record<string, number> = {};
  items.forEach((i) => {
    const s = i.status || 'watching';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const total = items.length || 1;

  // Upcoming follow-ups
  const upcoming = items
    .filter((i) => i.next_followup && new Date(i.next_followup) > new Date())
    .sort((a, b) => new Date(a.next_followup!).getTime() - new Date(b.next_followup!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Applications"
          value={applied.length}
          color="blue"
          icon={<CheckCircle size={18} />}
        />
        <StatCard
          label="Response Rate"
          value={`${responseRate}%`}
          color="green"
          icon={<Timer size={18} />}
        />
        <StatCard
          label="Offers"
          value={offered.length}
          color="cyan"
          icon={<CheckCircle size={18} />}
        />
        <StatCard
          label="Rejections"
          value={rejected.length}
          color="red"
          icon={<XCircle size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Breakdown</CardTitle>
          </CardHeader>
          <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-s3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className={`${statusColors[status] || 'bg-s4'} transition-all`}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${status}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <span className={`inline-block h-2 w-2 rounded-full ${statusColors[status] || 'bg-s4'}`} />
                <span className="capitalize text-dim">{status}</span>
                <span className="font-medium text-text">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Follow-ups</CardTitle>
          </CardHeader>
          {upcoming.length === 0 ? (
            <p className="text-sm text-dim">No upcoming follow-ups scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md bg-s2 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-text">{item.sponsor_name}</p>
                    <p className="text-xs text-dim capitalize">{item.status}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-orange">
                    <Clock size={12} />
                    {new Date(item.next_followup!).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
