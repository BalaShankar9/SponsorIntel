'use client';

import { useState } from 'react';
import { Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

const sourceOptions = [
  { value: '', label: '── DEPARTMENT LEADS ──', disabled: true },
  { value: 'agent:hunter', label: 'Aria Singh — Head of Job Sourcing' },
  { value: 'agent:validator', label: 'Marcus Chen — Head of Data Quality' },
  { value: 'agent:enrichment', label: 'Priya Kapoor — Lead Sponsorship Analyst' },
  { value: 'agent:freshness', label: 'James Okafor — Listings Lifecycle Manager' },
  { value: 'agent:discovery', label: 'Elena Volkov — Company Research Director' },
  { value: 'agent:ch-watcher', label: 'Daniel Mensah — Corporate Intelligence' },
  { value: 'agent:quality', label: 'Sophie Laurent — Data Completeness Auditor' },
  { value: 'agent:orchestrator', label: 'Raj Patel — Chief Operations Coordinator' },
  { value: 'agent:improvement', label: 'Dr. Alex Thornton — Platform Intelligence' },
  { value: '', label: '── SCRAPERS ──', disabled: true },
  { value: 'gov_register', label: 'GOV.UK REGISTER' },
  { value: 'indeed', label: 'INDEED JOBS' },
  { value: 'linkedin', label: 'LINKEDIN JOBS' },
  { value: 'reed', label: 'REED JOBS' },
  { value: 'totaljobs', label: 'TOTALJOBS' },
  { value: 'companies_house', label: 'COMPANIES HOUSE' },
  { value: 'glassdoor', label: 'GLASSDOOR REVIEWS' },
  { value: '', label: '── FREE APIs ──', disabled: true },
  { value: 'remotive', label: 'REMOTIVE' },
  { value: 'arbeitnow', label: 'ARBEITNOW' },
  { value: 'jobicy', label: 'JOBICY' },
  { value: 'remoteok', label: 'REMOTE OK' },
  { value: 'himalayas', label: 'HIMALAYAS' },
  { value: 'adzuna', label: 'ADZUNA' },
];

export function TriggerScrape() {
  const [source, setSource] = useState('gov_register');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post<{ message: string }>('/api/v1/admin/scrape/trigger', { source });
      setResult({ success: true, message: res.message || `${source} SCRAPE TRIGGERED` });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'TRIGGER FAILED' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-s3 bg-s1 p-3">
      <h3 className="mb-3 font-data text-[10px] font-bold uppercase tracking-widest text-amber">
        MANUAL TRIGGER
      </h3>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="font-data text-[9px] text-dim uppercase tracking-wider">SOURCE</label>
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setResult(null); }}
            className="mt-0.5 w-full border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text focus:border-amber focus:outline-none"
          >
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleTrigger}
          disabled={loading}
          className="flex items-center gap-1 bg-amber px-3 py-1.5 font-data text-[10px] font-bold uppercase text-bg transition-colors hover:bg-amber/80 disabled:opacity-50"
        >
          {loading ? (
            <span className="animate-pulse">...</span>
          ) : (
            <Play size={10} />
          )}
          RUN
        </button>
      </div>

      {result && (
        <div className={`mt-2 flex items-center gap-2 px-2 py-1.5 font-data text-[10px] ${result.success ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
          {result.success ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
