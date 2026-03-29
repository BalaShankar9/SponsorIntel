'use client';

import { useState } from 'react';
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
  { value: 'new_sponsor', label: 'NEW SPONSOR' },
  { value: 'rating_change', label: 'RATING CHANGE' },
  { value: 'new_job', label: 'NEW JOB' },
  { value: 'company_news', label: 'COMPANY NEWS' },
  { value: 'risk_flag', label: 'RISK FLAG' },
];

const channelOptions = [
  { value: 'email', label: 'EMAIL' },
  { value: 'in_app', label: 'IN-APP' },
  { value: 'both', label: 'BOTH' },
];

const frequencyOptions = [
  { value: 'immediate', label: 'IMMEDIATE' },
  { value: 'daily', label: 'DAILY DIGEST' },
  { value: 'weekly', label: 'WEEKLY DIGEST' },
];

const ratingDirectionOptions = [
  { value: 'upgrade', label: 'UPGRADE ONLY' },
  { value: 'downgrade', label: 'DOWNGRADE ONLY' },
  { value: 'both', label: 'BOTH' },
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

  const selectClass = "w-full border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text focus:border-amber focus:outline-none";
  const inputClass = "w-full border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none";
  const labelClass = "font-data text-[9px] text-dim uppercase tracking-wider";

  return (
    <div className="border border-amber/30 bg-s1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-data text-sm font-bold text-amber">
          {existingAlert ? 'EDIT ALERT' : 'CREATE ALERT'}
        </h3>
        <button onClick={onCancel} className="text-dim hover:text-text">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Alert Type */}
        <div>
          <label className={labelClass}>ALERT TYPE</label>
          <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className={selectClass}>
            {alertTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Dynamic conditions */}
        {alertType === 'new_job' && (
          <div className="space-y-2 border border-s3 bg-bg p-3">
            <p className="font-data text-[9px] font-bold text-amber uppercase">JOB CONDITIONS</p>
            <div>
              <label className={labelClass}>TITLE CONTAINS</label>
              <input
                type="text"
                placeholder="E.G. SOFTWARE ENGINEER"
                value={titleContains}
                onChange={(e) => setTitleContains(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>COMPANY</label>
                <input placeholder="ANY" value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CITY</label>
                <input placeholder="ANY" value={jobCity} onChange={(e) => setJobCity(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>MIN SALARY</label>
              <input type="number" placeholder="40000" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>MIN SPONSORSHIP: {minSponsorship}%</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minSponsorship}
                onChange={(e) => setMinSponsorship(Number(e.target.value))}
                className="w-full accent-amber"
              />
            </div>
          </div>
        )}

        {alertType === 'rating_change' && (
          <div className="space-y-2 border border-s3 bg-bg p-3">
            <p className="font-data text-[9px] font-bold text-amber uppercase">RATING CONDITIONS</p>
            <div>
              <label className={labelClass}>DIRECTION</label>
              <select value={ratingDirection} onChange={(e) => setRatingDirection(e.target.value)} className={selectClass}>
                {ratingDirectionOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>COMPANIES (COMMA-SEPARATED)</label>
              <input placeholder="ALL COMPANIES" value={ratingCompanies} onChange={(e) => setRatingCompanies(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        {alertType === 'new_sponsor' && (
          <div className="space-y-2 border border-s3 bg-bg p-3">
            <p className="font-data text-[9px] font-bold text-amber uppercase">SPONSOR CONDITIONS</p>
            <div>
              <label className={labelClass}>INDUSTRY</label>
              <input placeholder="ANY" value={sponsorIndustry} onChange={(e) => setSponsorIndustry(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CITY</label>
              <input placeholder="ANY" value={sponsorCity} onChange={(e) => setSponsorCity(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        {(alertType === 'company_news' || alertType === 'risk_flag') && (
          <div className="border border-s3 bg-bg p-3">
            <p className="font-data text-[10px] text-dim">
              {alertType === 'company_news'
                ? 'NOTIFIED WHEN WATCHLIST COMPANIES HAVE NEWS COVERAGE.'
                : 'NOTIFIED WHEN RISK FLAGS DETECTED FOR ANY SPONSOR.'}
            </p>
          </div>
        )}

        {/* Channel & Frequency */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>CHANNEL</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectClass}>
              {channelOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>FREQUENCY</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={selectClass}>
              {frequencyOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="flex w-full items-center justify-center gap-2 bg-amber py-2 font-data text-xs font-bold uppercase text-bg transition-colors hover:bg-amber/80"
        >
          <Save size={12} /> {existingAlert ? 'UPDATE ALERT' : 'CREATE ALERT'}
        </button>
      </div>
    </div>
  );
}
