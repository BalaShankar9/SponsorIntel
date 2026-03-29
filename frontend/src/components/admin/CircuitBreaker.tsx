'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';

interface SourceHealth {
  consecutive_failures?: string;
  last_success?: string;
  last_failure?: string;
  last_error?: string;
  status?: string;
  paused_at?: string;
}

interface CircuitBreakerData {
  paused_sources: string[];
  source_health: Record<string, SourceHealth>;
}

export function CircuitBreaker() {
  const [data, setData] = useState<CircuitBreakerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await api.get<CircuitBreakerData>('/api/v1/admin/circuit-breaker');
      setData(res);
    } catch {
      // API might not be available yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleResume = async (source: string) => {
    setResuming(source);
    try {
      await api.post(`/api/v1/admin/circuit-breaker/resume/${source}`);
      await fetchData();
    } catch {
      // silent
    } finally {
      setResuming(null);
    }
  };

  if (loading) {
    return (
      <div className="border border-s3 bg-s1 p-3">
        <div className="h-16 animate-pulse bg-s2/30" />
      </div>
    );
  }

  const healthEntries = Object.entries(data?.source_health || {});
  const pausedSet = new Set(data?.paused_sources || []);

  return (
    <div className="border border-s3 bg-s1 p-3">
      <div className="flex items-center gap-2 mb-2">
        {pausedSet.size > 0 ? (
          <ShieldAlert size={12} className="text-red" />
        ) : (
          <ShieldCheck size={12} className="text-green" />
        )}
        <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-text">
          CIRCUIT BREAKER
        </h3>
        {pausedSet.size > 0 && (
          <span className="ml-auto font-data text-[9px] text-red">
            {pausedSet.size} PAUSED
          </span>
        )}
        {pausedSet.size === 0 && (
          <span className="ml-auto font-data text-[9px] text-green">
            ALL HEALTHY
          </span>
        )}
      </div>

      {healthEntries.length === 0 && (
        <p className="font-data text-[10px] text-dim">No source health data yet — run scrapers first</p>
      )}

      <div className="space-y-1">
        {healthEntries.map(([source, health]) => {
          const isPaused = pausedSet.has(source);
          const failures = parseInt(health.consecutive_failures || '0', 10);
          return (
            <div
              key={source}
              className={`flex items-center gap-2 px-2 py-1 font-data text-[10px] ${
                isPaused ? 'bg-red/10 border border-red/20' : 'bg-s2/20'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                isPaused ? 'bg-red' : failures > 0 ? 'bg-amber' : 'bg-green'
              }`} />
              <span className="uppercase text-text w-24 truncate">{source}</span>
              <span className={`${isPaused ? 'text-red' : 'text-dim'}`}>
                {health.status || 'unknown'}
              </span>
              {failures > 0 && (
                <span className="text-amber">({failures} failures)</span>
              )}
              {isPaused && (
                <button
                  onClick={() => handleResume(source)}
                  disabled={resuming === source}
                  className="ml-auto flex items-center gap-1 text-cyan hover:text-cyan/80"
                >
                  <RotateCcw size={9} className={resuming === source ? 'animate-spin' : ''} />
                  RESUME
                </button>
              )}
              {!isPaused && health.last_success && (
                <span className="ml-auto text-dim">
                  OK {new Date(health.last_success).toLocaleTimeString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
