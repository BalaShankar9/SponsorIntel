'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { SignalFeed } from '@/components/signals/SignalFeed';

const typeOptions = [
  { value: 'all', label: 'All Events' },
  { value: 'rating_upgrade', label: 'Rating Upgrades' },
  { value: 'rating_downgrade', label: 'Rating Downgrades' },
  { value: 'new_sponsor', label: 'New Sponsors' },
  { value: 'removed_sponsor', label: 'Removals' },
  { value: 'job_spike', label: 'Job Spikes' },
  { value: 'news', label: 'News' },
  { value: 'risk_flag', label: 'Risk Flags' },
];

const severityOptions = [
  { value: 'all', label: 'All Severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

export default function SignalsPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Signals Feed</h1>
        <p className="text-sm text-dim">Real-time market events and intelligence signals</p>
      </div>

      <div className="flex gap-3">
        <div className="w-48">
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            options={severityOptions}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          />
        </div>
      </div>

      <SignalFeed typeFilter={typeFilter} severityFilter={severityFilter} />
    </div>
  );
}
