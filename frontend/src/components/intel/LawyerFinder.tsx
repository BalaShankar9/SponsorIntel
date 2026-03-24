'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { LawyerCard } from './LawyerCard';
import type { LawyerSearchParams, LawyerSearchResponse } from '@/types/intel';

const VISA_ROUTES = [
  'Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder',
  'Family', 'Student', 'Visitor', 'Asylum', 'Appeals',
];

const COMPLEXITIES = [
  { value: 'straightforward', label: 'Straightforward' },
  { value: 'complex', label: 'Complex' },
  { value: 'appeal', label: 'Appeal' },
];

export function LawyerFinder() {
  const [params, setParams] = useState<LawyerSearchParams>({
    visa_route: '',
    case_complexity: 'straightforward',
  });
  const [results, setResults] = useState<LawyerSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!params.visa_route) return;
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/v1/intel/lawyers/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data: LawyerSearchResponse = await resp.json();
      setResults(data);
    } catch (err) {
      console.error('Lawyer search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search form */}
      <Card>
        <CardHeader>
          <CardTitle>Find an Immigration Lawyer</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-2 gap-3">
          {/* Visa route */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Visa Route *</label>
            <select
              value={params.visa_route}
              onChange={(e) => setParams({ ...params, visa_route: e.target.value })}
              className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-xs text-text focus:border-amber outline-none"
            >
              <option value="">Select route...</option>
              {VISA_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Location</label>
            <input
              type="text"
              placeholder="City or 'remote'"
              value={params.location || ''}
              onChange={(e) => setParams({ ...params, location: e.target.value || undefined })}
              className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-xs text-text focus:border-amber outline-none"
            />
          </div>

          {/* Complexity */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Case Complexity</label>
            <div className="flex gap-1.5">
              {COMPLEXITIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setParams({ ...params, case_complexity: c.value as any })}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    params.case_complexity === c.value
                      ? 'border-amber text-amber bg-amber/10'
                      : 'border-border text-dim hover:text-text'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Language Preference</label>
            <input
              type="text"
              placeholder="e.g., Hindi, Mandarin"
              value={params.language_pref || ''}
              onChange={(e) => setParams({ ...params, language_pref: e.target.value || undefined })}
              className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-xs text-text focus:border-amber outline-none"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button variant="primary" size="md" onClick={handleSearch} disabled={!params.visa_route || loading}>
            {loading ? 'Searching...' : 'Find Lawyers'}
          </Button>
          <p className="text-[8px] text-dim italic">
            This is informational only. We do not endorse any specific lawyer. Verify credentials independently.
          </p>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-2">
          <p className="text-[10px] font-data text-dim">
            {results.total} lawyers found &middot; Showing top {results.results.length}
          </p>
          {results.results.map((lawyer, idx) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
