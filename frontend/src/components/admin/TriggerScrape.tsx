'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';

const sourceOptions = [
  { value: 'gov_register', label: 'Gov.uk Sponsor Register' },
  { value: 'indeed', label: 'Indeed Jobs' },
  { value: 'linkedin', label: 'LinkedIn Jobs' },
  { value: 'reed', label: 'Reed Jobs' },
  { value: 'totaljobs', label: 'Totaljobs' },
  { value: 'companies_house', label: 'Companies House' },
  { value: 'glassdoor', label: 'Glassdoor Reviews' },
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
      setResult({ success: true, message: res.message || `${source} scrape triggered successfully` });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to trigger scrape' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trigger Manual Scrape</CardTitle>
      </CardHeader>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Select
            label="Source"
            options={sourceOptions}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setResult(null);
            }}
          />
        </div>
        <Button onClick={handleTrigger} disabled={loading}>
          {loading ? <Spinner size="sm" /> : <Play size={14} />}
          Trigger
        </Button>
      </div>

      {result && (
        <div className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${result.success ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
          {result.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {result.message}
        </div>
      )}
    </Card>
  );
}
