'use client';

import { useState } from 'react';
import { SignalFeed } from '@/components/signals/SignalFeed';

const typeFilters = [
  { value: 'all', label: 'ALL' },
  { value: 'new_sponsor', label: 'SPONSOR ADDED' },
  { value: 'removed_sponsor', label: 'REMOVED' },
  { value: 'rating_upgrade', label: 'RATING +' },
  { value: 'rating_downgrade', label: 'RATING -' },
  { value: 'job_spike', label: 'NEW JOB' },
  { value: 'risk_flag', label: 'SCORE CHG' },
];

export default function SignalsPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  return (
    <div className="space-y-3">
      {/* Terminal Header */}
      <div className="border-b border-amber/30 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
              SIGNALS FEED
            </h1>
            <p className="font-data text-xs text-dim">
              REAL-TIME MARKET EVENTS // INTELLIGENCE SIGNALS // LIVE
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green" />
            <span className="font-data text-[10px] text-green">CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Filter Bar - Type Checkboxes */}
      <div className="flex flex-wrap items-center gap-1 border border-s3 bg-s1 p-2">
        <span className="mr-2 font-data text-[10px] text-dim">FILTER:</span>
        {typeFilters.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`px-2 py-1 font-data text-[10px] uppercase transition-colors ${
              typeFilter === t.value
                ? 'bg-amber text-bg font-bold'
                : 'text-dim hover:text-amber border border-s3'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-2 text-s3">|</span>
        <span className="font-data text-[10px] text-dim mr-1">SEV:</span>
        {['all', 'critical', 'warning', 'info'].map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-2 py-1 font-data text-[10px] uppercase transition-colors ${
              severityFilter === s
                ? s === 'critical' ? 'bg-red text-bg font-bold'
                : s === 'warning' ? 'bg-amber text-bg font-bold'
                : s === 'info' ? 'bg-green text-bg font-bold'
                : 'bg-amber text-bg font-bold'
                : 'text-dim hover:text-text border border-s3'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      <SignalFeed typeFilter={typeFilter} severityFilter={severityFilter} />
    </div>
  );
}
