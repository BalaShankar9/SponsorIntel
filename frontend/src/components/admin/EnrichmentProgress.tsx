'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface EnrichmentLevel {
  level: number;
  label: string;
  count: number;
  total: number;
}

interface EnrichmentProgressProps {
  levels: EnrichmentLevel[];
  loading: boolean;
}

const levelColors = [
  'bg-red',
  'bg-orange',
  'bg-yellow',
  'bg-cyan',
  'bg-accent',
  'bg-green',
];

export function EnrichmentProgress({ levels, loading }: EnrichmentProgressProps) {
  if (loading) {
    return (
      <Card>
        <div className="h-48 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrichment Progress</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {levels.map((level) => {
          const pct = level.total > 0 ? Math.round((level.count / level.total) * 100) : 0;
          return (
            <div key={level.level}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-dim">
                  Level {level.level}: {level.label}
                </span>
                <span className="text-xs text-dim2">
                  {level.count.toLocaleString()} / {level.total.toLocaleString()} ({pct}%)
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-s3">
                <div
                  className={`h-3 rounded-full transition-all ${levelColors[level.level] || 'bg-accent'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
