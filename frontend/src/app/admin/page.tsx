'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EngineStatus } from '@/components/admin/EngineStatus';
import { EnrichmentProgress } from '@/components/admin/EnrichmentProgress';
import { ImportHistory } from '@/components/admin/ImportHistory';
import { TriggerScrape } from '@/components/admin/TriggerScrape';
import { SwarmHealth } from '@/components/admin/SwarmHealth';
import { BootstrapControls } from '@/components/admin/BootstrapControls';
import { CircuitBreaker } from '@/components/admin/CircuitBreaker';

interface AdminData {
  scrapers: Array<{
    source: string;
    status: 'running' | 'idle' | 'error';
    last_run: string | null;
    success_rate: number;
    queue_size: number;
    rate: string;
  }>;
  enrichment_levels: Array<{
    level: number;
    label: string;
    count: number;
    total: number;
  }>;
  imports: Array<{
    id: string;
    filename: string;
    date: string;
    total_records: number;
    added: number;
    removed: number;
    changed: number;
    trigger: 'auto' | 'manual';
  }>;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch real stats from Supabase
        const [totalRes, enrichedRes, chRes, enrichmentLevels] = await Promise.all([
          supabase.from('sponsors').select('id', { count: 'exact', head: true }),
          supabase.from('company_profiles').select('id', { count: 'exact', head: true }),
          supabase.from('company_profiles').select('id', { count: 'exact', head: true }).not('companies_house_number', 'is', null),
          // Get enrichment level distribution
          supabase.from('company_profiles').select('enrichment_level').limit(5000),
        ]);

        const totalSponsors = totalRes.count || 0;
        const totalProfiles = enrichedRes.count || 0;
        const chEnriched = chRes.count || 0;

        // Count enrichment levels
        const levelCounts: Record<number, number> = {};
        (enrichmentLevels.data || []).forEach((r) => {
          const level = (r.enrichment_level as number) ?? 0;
          levelCounts[level] = (levelCounts[level] || 0) + 1;
        });

        const levelLabels: Record<number, string> = {
          0: 'Raw import',
          1: 'Basic normalization',
          2: 'Companies House',
          3: 'Financial data',
          4: 'Reputation scores',
          5: 'Full enrichment',
        };

        const enrichmentData = Object.entries(levelLabels).map(([level, label]) => ({
          level: Number(level),
          label,
          count: levelCounts[Number(level)] || 0,
          total: totalProfiles,
        }));

        setData({
          scrapers: [
            { source: 'Gov.uk Register', status: 'idle', last_run: null, success_rate: 0, queue_size: 0, rate: 'N/A' },
            { source: 'Companies House', status: 'idle', last_run: null, success_rate: 0, queue_size: 0, rate: 'N/A' },
          ],
          enrichment_levels: enrichmentData,
          imports: [],
        });

        // Display real counts in console for debugging
        console.log(`Admin: ${totalSponsors} sponsors, ${totalProfiles} profiles, ${chEnriched} CH enriched`);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        setData({
          scrapers: [],
          enrichment_levels: [],
          imports: [],
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-3">
      {/* Terminal Header */}
      <div className="border-b border-amber/30 pb-2">
        <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
          ADMIN DASHBOARD
        </h1>
        <p className="font-data text-xs text-dim">
          ENGINE STATUS // DATA PIPELINE // SYSTEM HEALTH
        </p>
      </div>

      {/* Scraper Grid + Controls */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EngineStatus scrapers={data?.scrapers || []} loading={loading} />
        </div>
        <div className="space-y-3">
          <TriggerScrape />
          <EnrichmentProgress levels={data?.enrichment_levels || []} loading={loading} />
        </div>
      </div>

      <ImportHistory imports={data?.imports || []} loading={loading} />

      {/* Bootstrap & Circuit Breaker */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BootstrapControls />
        <CircuitBreaker />
      </div>

      {/* Agent Swarm Health */}
      <SwarmHealth />
    </div>
  );
}
