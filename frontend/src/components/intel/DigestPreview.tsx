'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImpactBadge } from './ImpactBadge';
import { Mail } from 'lucide-react';

export function DigestPreview() {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/v1/intel/digest/preview`, { method: 'POST' });
      const data = await resp.json();
      setPreview(data);
    } catch (err) {
      console.error('Digest preview failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Digest Preview</CardTitle>
        <Button variant="ghost" size="sm" onClick={generatePreview} disabled={loading}>
          <Mail size={12} />
          {loading ? 'Generating...' : 'Preview'}
        </Button>
      </CardHeader>

      {preview ? (
        <div className="space-y-3">
          <div className="bg-s2 rounded p-3 border border-border">
            <p className="text-[9px] font-data uppercase text-dim mb-1">Subject</p>
            <p className="text-sm font-medium text-text">{preview.subject}</p>
          </div>
          {preview.top_items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2">
              <ImpactBadge level={item.impact_level || item.impact_badge} size="sm" />
              <div>
                <p className="text-xs text-text">{item.title || item.headline}</p>
                {item.summary && <p className="text-[11px] text-dim">{item.summary || item.one_liner}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-dim">Click Preview to generate a sample weekly digest.</p>
      )}
    </Card>
  );
}
