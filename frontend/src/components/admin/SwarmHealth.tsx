'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SwarmMetrics, SourceHealth, SwarmAlert } from '@/types';

export function SwarmHealth() {
  const [metrics, setMetrics] = useState<SwarmMetrics[]>([]);
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [alerts, setAlerts] = useState<SwarmAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSwarmData() {
      setLoading(true);
      try {
        const [metricsRes, sourcesRes, alertsRes] = await Promise.all([
          supabase
            .from('swarm_metrics')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(10),
          supabase
            .from('source_health_log')
            .select('*')
            .order('logged_at', { ascending: false })
            .limit(30),
          supabase
            .from('swarm_alerts')
            .select('*')
            .eq('acknowledged', false)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

        setMetrics(metricsRes.data || []);
        setSources(sourcesRes.data || []);
        setAlerts(alertsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch swarm data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSwarmData();
  }, []);

  // Deduplicate sources to show latest per source
  const latestSources = new Map<string, SourceHealth>();
  for (const s of sources) {
    if (!latestSources.has(s.source)) {
      latestSources.set(s.source, s);
    }
  }

  const lastRun = metrics[0];

  if (loading) {
    return (
      <div className="border border-s3 bg-s1 p-4">
        <div className="h-32 animate-pulse bg-s2/30" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-b border-amber/30 pb-1">
        <h2 className="font-data text-sm font-bold uppercase tracking-wider text-amber">
          AGENT SWARM HEALTH
        </h2>
        <p className="font-data text-[9px] text-dim mt-0.5">
          Aria (Sourcing) // Marcus (QA) // Priya (Intel) // James (Lifecycle) // Elena (Research) // Daniel (Compliance) // Sophie (Audit) // Raj (Ops) // Dr. Alex (R&D)
        </p>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-5 gap-px bg-border">
        <div className="bg-s1 px-3 py-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">LAST RUN</p>
          <p className="font-data text-sm font-bold text-text">
            {lastRun ? new Date(lastRun.started_at).toLocaleTimeString() : '--'}
          </p>
        </div>
        <div className="bg-s1 px-3 py-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">SCRAPED</p>
          <p className="font-data text-sm font-bold text-cyan">{lastRun?.jobs_scraped ?? '--'}</p>
        </div>
        <div className="bg-s1 px-3 py-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">VALIDATED</p>
          <p className="font-data text-sm font-bold text-green">{lastRun?.jobs_validated ?? '--'}</p>
        </div>
        <div className="bg-s1 px-3 py-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">ENRICHED</p>
          <p className="font-data text-sm font-bold text-purple">{lastRun?.jobs_enriched ?? '--'}</p>
        </div>
        <div className="bg-s1 px-3 py-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">ERRORS</p>
          <p className="font-data text-sm font-bold text-red">{lastRun?.errors_total ?? '--'}</p>
        </div>
      </div>

      {/* Source Status Grid */}
      <div className="border border-s3 bg-s1 p-3">
        <p className="mb-2 font-data text-[10px] uppercase tracking-widest text-dim">SOURCE STATUS</p>
        <div className="grid grid-cols-4 gap-2">
          {Array.from(latestSources.entries()).map(([name, health]) => {
            const statusColor = health.is_paused
              ? 'bg-red'
              : health.success_rate >= 0.8
              ? 'bg-green'
              : health.success_rate >= 0.5
              ? 'bg-amber'
              : 'bg-red';
            return (
              <div key={name} className="flex items-center gap-2 border border-s3/50 bg-s2/30 px-2 py-1">
                <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
                <span className="font-data text-[10px] uppercase text-text">{name}</span>
                <span className="ml-auto font-data text-[10px] text-dim">
                  {health.jobs_returned ?? 0}
                </span>
              </div>
            );
          })}
          {latestSources.size === 0 && (
            <p className="col-span-4 font-data text-xs text-dim">No source data yet — run the pipeline first</p>
          )}
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="border border-red/30 bg-red/5 p-3">
          <p className="mb-2 font-data text-[10px] uppercase tracking-widest text-red">
            ACTIVE ALERTS ({alerts.length})
          </p>
          <div className="space-y-1">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 font-data text-xs">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                  alert.severity === 'critical' ? 'bg-red' : 'bg-amber'
                }`} />
                <span className="text-dim">[{alert.alert_type}]</span>
                <span className="text-text">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      <div className="border border-s3 bg-s1 p-3">
        <p className="mb-2 font-data text-[10px] uppercase tracking-widest text-dim">RECENT PIPELINE RUNS</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-s3">
              <th className="px-2 py-1 text-left font-data text-[10px] uppercase text-dim">TIME</th>
              <th className="px-2 py-1 text-left font-data text-[10px] uppercase text-dim">SCRAPED</th>
              <th className="px-2 py-1 text-left font-data text-[10px] uppercase text-dim">VALID</th>
              <th className="px-2 py-1 text-left font-data text-[10px] uppercase text-dim">ERRORS</th>
              <th className="px-2 py-1 text-left font-data text-[10px] uppercase text-dim">DURATION</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id} className="border-b border-s3/30">
                <td className="px-2 py-1 font-data text-[10px] text-text">
                  {new Date(m.started_at).toLocaleString()}
                </td>
                <td className="px-2 py-1 font-data text-[10px] text-cyan">{m.jobs_scraped}</td>
                <td className="px-2 py-1 font-data text-[10px] text-green">{m.jobs_validated}</td>
                <td className="px-2 py-1 font-data text-[10px] text-red">{m.errors_total}</td>
                <td className="px-2 py-1 font-data text-[10px] text-dim">
                  {m.duration_seconds ? `${m.duration_seconds}s` : '--'}
                </td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center font-data text-xs text-dim">
                  No pipeline runs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
