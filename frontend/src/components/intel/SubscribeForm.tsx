'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { IntelSubscriptionCreate, IntelTopic, IntelImpactLevel, IntelNotifChannel } from '@/types/intel';

const TOPICS: { value: IntelTopic; label: string }[] = [
  { value: 'rule_change', label: 'Rule Changes' },
  { value: 'policy_update', label: 'Policy Updates' },
  { value: 'court_decision', label: 'Court Decisions' },
  { value: 'statistics', label: 'Statistics' },
];

const VISA_ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Family', 'Student'];

interface SubscribeFormProps {
  onSuccess?: () => void;
}

export function SubscribeForm({ onSuccess }: SubscribeFormProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [minImpact, setMinImpact] = useState<IntelImpactLevel>('medium');
  const [channel, setChannel] = useState<IntelNotifChannel>('in_app');
  const [saving, setSaving] = useState(false);

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const body: IntelSubscriptionCreate = {
        filter_topics: topics.length > 0 ? topics : undefined,
        filter_visa_routes: routes.length > 0 ? routes : undefined,
        filter_min_impact: minImpact,
        channel,
      };
      await fetch(`${API_URL}/api/v1/intel/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSuccess?.();
    } catch (err) {
      console.error('Subscribe failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Subscribe to Alerts</CardTitle></CardHeader>

      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Topics (leave empty for all)</p>
          <div className="flex flex-wrap gap-1">
            {TOPICS.map((t) => (
              <button key={t.value} onClick={() => toggle(topics, t.value, setTopics)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  topics.includes(t.value) ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Visa Routes</p>
          <div className="flex flex-wrap gap-1">
            {VISA_ROUTES.map((r) => (
              <button key={r} onClick={() => toggle(routes, r, setRoutes)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  routes.includes(r) ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Minimum Impact</p>
          <div className="flex gap-1.5">
            {(['low', 'medium', 'high', 'critical'] as IntelImpactLevel[]).map((level) => (
              <button key={level} onClick={() => setMinImpact(level)}
                className={`px-2 py-0.5 text-[10px] rounded border capitalize transition-colors ${
                  minImpact === level ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Notification Channel</p>
          <div className="flex gap-1.5">
            {[
              { value: 'in_app', label: 'In-App' },
              { value: 'email_instant', label: 'Email (Instant)' },
              { value: 'email_digest', label: 'Email (Weekly)' },
            ].map((ch) => (
              <button key={ch.value} onClick={() => setChannel(ch.value as IntelNotifChannel)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  channel === ch.value ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Create Subscription'}
        </Button>
      </div>
    </Card>
  );
}
