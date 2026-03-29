'use client';

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
  'bg-amber',
  'bg-amber',
  'bg-cyan',
  'bg-blue',
  'bg-green',
];

export function EnrichmentProgress({ levels, loading }: EnrichmentProgressProps) {
  if (loading) {
    return (
      <div className="border border-s3 bg-s1 p-4">
        <div className="h-48 animate-pulse bg-s2/30" />
      </div>
    );
  }

  return (
    <div className="border border-s3 bg-s1 p-3">
      <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
        ENRICHMENT PROGRESS
      </h3>
      <div className="space-y-2">
        {levels.map((level) => {
          const pct = level.total > 0 ? Math.round((level.count / level.total) * 100) : 0;
          return (
            <div key={level.level}>
              <div className="mb-0.5 flex items-center justify-between">
                <span className="font-data text-[9px] text-dim">
                  L{level.level}: {level.label.toUpperCase()}
                </span>
                <span className="font-data text-[9px] text-muted">
                  {level.count.toLocaleString()}/{level.total.toLocaleString()} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-s3">
                <div
                  className={`h-2 transition-all ${levelColors[level.level] || 'bg-amber'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
