'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface ScraperStatus {
  source: string;
  status: 'running' | 'idle' | 'error';
  last_run: string | null;
  success_rate: number;
  queue_size: number;
  rate: string;
}

interface EngineStatusProps {
  scrapers: ScraperStatus[];
  loading: boolean;
}

const statusDot: Record<string, string> = {
  running: 'bg-green',
  idle: 'bg-orange',
  error: 'bg-red',
};

const statusLabel: Record<string, string> = {
  running: 'Running',
  idle: 'Idle',
  error: 'Error',
};

export function EngineStatus({ scrapers, loading }: EngineStatusProps) {
  if (loading) {
    return (
      <Card>
        <div className="h-48 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <div className="p-4">
        <CardHeader>
          <CardTitle>Scraper Status</CardTitle>
        </CardHeader>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">Source</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">Last Run</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Success %</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Queue</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Rate</th>
          </tr>
        </thead>
        <tbody>
          {scrapers.map((s) => (
            <tr key={s.source} className="border-b border-border/50 transition-colors hover:bg-s2">
              <td className="px-4 py-2.5 text-sm font-medium text-text">{s.source}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-dim">
                  <span className={`inline-block h-2 w-2 rounded-full ${statusDot[s.status]}`} />
                  {statusLabel[s.status]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-dim2">
                {s.last_run
                  ? new Date(s.last_run).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--'}
              </td>
              <td className="px-4 py-2.5 text-right">
                <span className={`text-sm font-medium ${s.success_rate >= 95 ? 'text-green' : s.success_rate >= 80 ? 'text-orange' : 'text-red'}`}>
                  {s.success_rate}%
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-dim">{s.queue_size}</td>
              <td className="px-4 py-2.5 text-right text-xs text-dim2">{s.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
