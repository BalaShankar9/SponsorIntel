'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Save, X } from 'lucide-react';
import type { Alert } from '@/types';

interface AlertBuilderProps {
  existingAlert?: Alert | null;
  onSave: (alertData: CreateAlertPayload) => void;
  onCancel: () => void;
}

export interface CreateAlertPayload {
  alert_type: string;
  config: Record<string, unknown>;
  channel: string;
  frequency: string;
}

const alertTypeOptions = [
  { value: 'new_sponsor', label: 'New Sponsor' },
  { value: 'rating_change', label: 'Rating Change' },
  { value: 'new_job', label: 'New Job' },
  { value: 'company_news', label: 'Company News' },
  { value: 'risk_flag', label: 'Risk Flag' },
];

const channelOptions = [
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-App' },
  { value: 'both', label: 'Both' },
];

const frequencyOptions = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
];

const ratingDirectionOptions = [
  { value: 'upgrade', label: 'Upgrade only' },
  { value: 'downgrade', label: 'Downgrade only' },
  { value: 'both', label: 'Both' },
];

export function AlertBuilder({ existingAlert, onSave, onCancel }: AlertBuilderProps) {
  const [alertType, setAlertType] = useState(existingAlert?.alert_type || 'new_job');
  const [channel, setChannel] = useState(existingAlert?.channel || 'both');
  const [frequency, setFrequency] = useState<string>((existingAlert?.config?.frequency as string) || 'immediate');

  // New Job fields
  const [titleContains, setTitleContains] = useState<string>((existingAlert?.config?.title_contains as string) || '');
  const [jobCompany, setJobCompany] = useState<string>((existingAlert?.config?.company as string) || '');
  const [jobCity, setJobCity] = useState<string>((existingAlert?.config?.city as string) || '');
  const [minSalary, setMinSalary] = useState<string>((existingAlert?.config?.min_salary as string) || '');
  const [minSponsorship, setMinSponsorship] = useState<number>((existingAlert?.config?.min_sponsorship as number) || 50);

  // Rating Change fields
  const [ratingDirection, setRatingDirection] = useState<string>((existingAlert?.config?.direction as string) || 'both');
  const [ratingCompanies, setRatingCompanies] = useState<string>((existingAlert?.config?.companies as string) || '');

  // New Sponsor fields
  const [sponsorIndustry, setSponsorIndustry] = useState<string>((existingAlert?.config?.industry as string) || '');
  const [sponsorCity, setSponsorCity] = useState<string>((existingAlert?.config?.city as string) || '');

  const handleSave = () => {
    let config: Record<string, unknown> = { frequency };

    if (alertType === 'new_job') {
      config = {
        ...config,
        title_contains: titleContains || undefined,
        company: jobCompany || undefined,
        city: jobCity || undefined,
        min_salary: minSalary ? Number(minSalary) : undefined,
        min_sponsorship: minSponsorship,
      };
    } else if (alertType === 'rating_change') {
      config = {
        ...config,
        direction: ratingDirection,
        companies: ratingCompanies || undefined,
      };
    } else if (alertType === 'new_sponsor') {
      config = {
        ...config,
        industry: sponsorIndustry || undefined,
        city: sponsorCity || undefined,
      };
    }

    onSave({ alert_type: alertType, config, channel, frequency });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existingAlert ? 'Edit Alert' : 'Create Alert'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} />
        </Button>
      </CardHeader>

      <div className="space-y-4">
        {/* Alert Type */}
        <Select
          label="Alert Type"
          options={alertTypeOptions}
          value={alertType}
          onChange={(e) => setAlertType(e.target.value)}
        />

        {/* Dynamic conditions based on type */}
        {alertType === 'new_job' && (
          <div className="space-y-3 rounded-md border border-border/50 bg-s2/30 p-3">
            <p className="text-xs font-medium text-dim">Job Conditions</p>
            <Input
              label="Title contains"
              placeholder="e.g. Software Engineer"
              value={titleContains}
              onChange={(e) => setTitleContains(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Company"
                placeholder="Any company"
                value={jobCompany}
                onChange={(e) => setJobCompany(e.target.value)}
              />
              <Input
                label="City"
                placeholder="Any city"
                value={jobCity}
                onChange={(e) => setJobCity(e.target.value)}
              />
            </div>
            <Input
              label="Min Salary"
              type="number"
              placeholder="e.g. 40000"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-dim">
                Min Sponsorship: {minSponsorship}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minSponsorship}
                onChange={(e) => setMinSponsorship(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          </div>
        )}

        {alertType === 'rating_change' && (
          <div className="space-y-3 rounded-md border border-border/50 bg-s2/30 p-3">
            <p className="text-xs font-medium text-dim">Rating Change Conditions</p>
            <Select
              label="Direction"
              options={ratingDirectionOptions}
              value={ratingDirection}
              onChange={(e) => setRatingDirection(e.target.value)}
            />
            <Input
              label="Specific companies (comma-separated, or leave empty for all)"
              placeholder="Company A, Company B"
              value={ratingCompanies}
              onChange={(e) => setRatingCompanies(e.target.value)}
            />
          </div>
        )}

        {alertType === 'new_sponsor' && (
          <div className="space-y-3 rounded-md border border-border/50 bg-s2/30 p-3">
            <p className="text-xs font-medium text-dim">New Sponsor Conditions</p>
            <Input
              label="Industry"
              placeholder="Any industry"
              value={sponsorIndustry}
              onChange={(e) => setSponsorIndustry(e.target.value)}
            />
            <Input
              label="City"
              placeholder="Any city"
              value={sponsorCity}
              onChange={(e) => setSponsorCity(e.target.value)}
            />
          </div>
        )}

        {(alertType === 'company_news' || alertType === 'risk_flag') && (
          <div className="rounded-md border border-border/50 bg-s2/30 p-3">
            <p className="text-xs text-dim">
              {alertType === 'company_news'
                ? 'Get notified when companies in your watchlist have news coverage.'
                : 'Get notified when risk flags are detected for any sponsor.'}
            </p>
          </div>
        )}

        {/* Channel & Frequency */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Channel"
            options={channelOptions}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <Select
            label="Frequency"
            options={frequencyOptions}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          />
        </div>

        {/* Save */}
        <Button onClick={handleSave} className="w-full">
          <Save size={14} /> {existingAlert ? 'Update Alert' : 'Create Alert'}
        </Button>
      </div>
    </Card>
  );
}
