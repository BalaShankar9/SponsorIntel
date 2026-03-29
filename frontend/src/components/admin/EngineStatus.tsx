'use client';

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

const statusIndicator: Record<string, { color: string; label: string }> = {
  running: { color: 'bg-green', label: 'RUNNING' },
  idle: { color: 'bg-amber', label: 'IDLE' },
  error: { color: 'bg-red', label: 'ERROR' },
};

export function EngineStatus({ scrapers, loading }: EngineStatusProps) {
  if (loading) {
    return (
      <div className="border border-s3 bg-s1 p-4">
        <div className="h-48 animate-pulse bg-s2/30" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-amber">
        SCRAPER HEALTH
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {scrapers.map((s) => {
          const si = statusIndicator[s.status] || statusIndicator.idle;
          return (
            <div key={s.source} className="border border-s3 bg-s1 p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-data text-xs font-bold text-text">{s.source}</span>
                <span className={`inline-flex items-center gap-1 font-data text-[9px] font-bold`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${si.color} ${s.status === 'running' ? 'animate-pulse' : ''}`} />
                  <span className={s.status === 'running' ? 'text-green' : s.status === 'error' ? 'text-red' : 'text-amber'}>
                    {si.label}
                  </span>
                </span>
              </div>

              {/* Stats */}
              <div className="space-y-1">
                <div className="flex justify-between font-data text-[10px]">
                  <span className="text-dim">LAST RUN</span>
                  <span className="text-text">
                    {s.last_run
                      ? new Date(s.last_run).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '--'}
                  </span>
                </div>
                <div className="flex justify-between font-data text-[10px]">
                  <span className="text-dim">SUCCESS</span>
                  <span className={`font-bold ${s.success_rate >= 95 ? 'text-green' : s.success_rate >= 80 ? 'text-amber' : 'text-red'}`}>
                    {s.success_rate}%
                  </span>
                </div>
                {/* Success bar */}
                <div className="h-1 w-full bg-s3">
                  <div
                    className={`h-1 ${s.success_rate >= 95 ? 'bg-green' : s.success_rate >= 80 ? 'bg-amber' : 'bg-red'}`}
                    style={{ width: `${s.success_rate}%` }}
                  />
                </div>
                <div className="flex justify-between font-data text-[10px]">
                  <span className="text-dim">QUEUE</span>
                  <span className="text-text">{s.queue_size}</span>
                </div>
                <div className="flex justify-between font-data text-[10px]">
                  <span className="text-dim">RATE</span>
                  <span className="text-text">{s.rate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
