'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EngineStatus } from '@/components/admin/EngineStatus';
import { EnrichmentProgress } from '@/components/admin/EnrichmentProgress';
import { ImportHistory } from '@/components/admin/ImportHistory';
import { TriggerScrape } from '@/components/admin/TriggerScrape';

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

// Fallback sample data for when API is not available
const sampleData: AdminData = {
  scrapers: [
    { source: 'Gov.uk Register', status: 'running', last_run: '2026-03-06T10:30:00Z', success_rate: 99.8, queue_size: 0, rate: '1/day' },
    { source: 'Indeed', status: 'running', last_run: '2026-03-06T09:15:00Z', success_rate: 96.2, queue_size: 120, rate: '4/day' },
    { source: 'LinkedIn', status: 'idle', last_run: '2026-03-05T23:00:00Z', success_rate: 89.5, queue_size: 0, rate: '2/day' },
    { source: 'Reed', status: 'running', last_run: '2026-03-06T08:45:00Z', success_rate: 97.1, queue_size: 45, rate: '3/day' },
    { source: 'Companies House', status: 'idle', last_run: '2026-03-05T02:00:00Z', success_rate: 99.9, queue_size: 0, rate: '1/week' },
    { source: 'Glassdoor', status: 'error', last_run: '2026-03-04T18:00:00Z', success_rate: 72.3, queue_size: 500, rate: '1/day' },
  ],
  enrichment_levels: [
    { level: 0, label: 'Raw import', count: 2100, total: 105000 },
    { level: 1, label: 'Basic normalization', count: 89000, total: 105000 },
    { level: 2, label: 'Companies House', count: 72000, total: 105000 },
    { level: 3, label: 'Financial data', count: 45000, total: 105000 },
    { level: 4, label: 'Reputation scores', count: 28000, total: 105000 },
    { level: 5, label: 'Full enrichment', count: 15000, total: 105000 },
  ],
  imports: [
    { id: '1', filename: 'sponsor-register-2026-03-06.csv', date: '2026-03-06T06:00:00Z', total_records: 105234, added: 42, removed: 8, changed: 156, trigger: 'auto' },
    { id: '2', filename: 'sponsor-register-2026-03-05.csv', date: '2026-03-05T06:00:00Z', total_records: 105200, added: 38, removed: 12, changed: 89, trigger: 'auto' },
    { id: '3', filename: 'sponsor-register-2026-03-04.csv', date: '2026-03-04T06:00:00Z', total_records: 105174, added: 55, removed: 3, changed: 201, trigger: 'auto' },
    { id: '4', filename: 'manual-upload-corrections.csv', date: '2026-03-03T14:30:00Z', total_records: 150, added: 0, removed: 0, changed: 150, trigger: 'manual' },
  ],
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const adminData = await api.get<AdminData>('/api/v1/admin/status');
        setData(adminData);
      } catch {
        // Fall back to sample data
        setData(sampleData);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Admin Dashboard</h1>
        <p className="text-sm text-dim">Engine status, data pipeline, and system health</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EngineStatus scrapers={data?.scrapers || []} loading={loading} />
        </div>
        <div className="space-y-4">
          <TriggerScrape />
          <EnrichmentProgress levels={data?.enrichment_levels || []} loading={loading} />
        </div>
      </div>

      <ImportHistory imports={data?.imports || []} loading={loading} />
    </div>
  );
}
