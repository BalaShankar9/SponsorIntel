'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { LawyerDetail, LawyerCompareResponse } from '@/types/intel';

interface LawyerCompareProps {
  lawyerIds: string[];
}

export function LawyerCompare({ lawyerIds }: LawyerCompareProps) {
  const [data, setData] = useState<LawyerCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lawyerIds.length < 2) return;
    async function fetch() {
      setLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const resp = await globalThis.fetch(
          `${API_URL}/api/v1/intel/lawyers/compare?ids=${lawyerIds.join(',')}`
        );
        const json: LawyerCompareResponse = await resp.json();
        setData(json);
      } catch (err) {
        console.error('Compare fetch failed:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [lawyerIds]);

  if (loading) return <div className="h-48 bg-s1 border border-border animate-shimmer rounded" />;
  if (!data || data.lawyers.length < 2) return <p className="text-dim text-xs">Select 2-3 lawyers to compare.</p>;

  const rows = [
    { label: 'Registration', render: (l: LawyerDetail) => `${l.registration_type.toUpperCase()} ${l.oisc_level ? `L${l.oisc_level}` : ''} #${l.registration_number}` },
    { label: 'Rating', render: (l: LawyerDetail) => l.combined_rating ? `${l.combined_rating}/5` : 'N/A' },
    { label: 'Reviews', render: (l: LawyerDetail) => `${l.google_review_count + l.trustpilot_review_count}` },
    { label: 'Consultation Fee', render: (l: LawyerDetail) => l.fee_initial_consultation || 'Not listed' },
    { label: 'Hourly Rate', render: (l: LawyerDetail) => l.fee_hourly_range || 'Not listed' },
    { label: 'Location', render: (l: LawyerDetail) => l.city || 'Not listed' },
    { label: 'Remote', render: (l: LawyerDetail) => l.offers_remote ? 'Yes' : 'No' },
    { label: 'Legal Aid', render: (l: LawyerDetail) => l.offers_legal_aid ? 'Yes' : 'No' },
    { label: 'Accreditations', render: (l: LawyerDetail) => (l.accreditations || []).join(', ') || 'None listed' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Lawyer Comparison</CardTitle></CardHeader>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[9px] font-data uppercase text-dim px-2 py-1 border-b border-border w-32" />
            {data.lawyers.map((l) => (
              <th key={l.id} className="text-left text-xs font-medium text-text px-2 py-1 border-b border-border">
                {l.name}
                <br />
                <span className="text-[9px] text-dim font-normal">{l.firm_name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="text-[9px] font-data uppercase text-dim px-2 py-1.5 border-b border-border/50">{row.label}</td>
              {data.lawyers.map((l) => (
                <td key={l.id} className="text-xs text-text px-2 py-1.5 border-b border-border/50 font-data">
                  {row.render(l as any)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
