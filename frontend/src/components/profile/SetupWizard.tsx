'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import {
  Globe,
  Briefcase,
  MapPin,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

const VISA_ROUTES = [
  'Skilled Worker',
  'Health & Care Worker',
  'Global Talent',
  'Innovator Founder',
  'Graduate',
  'Scale-Up',
  'High Potential Individual',
  'Other',
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Engineering',
  'Hospitality',
  'Retail',
  'Construction',
  'Legal',
  'Consulting',
  'Manufacturing',
  'Energy',
  'Charity / Non-profit',
  'Other',
];

const UK_LOCATIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
  'Edinburgh',
  'Glasgow',
  'Liverpool',
  'Sheffield',
  'Cambridge',
  'Oxford',
  'Newcastle',
  'Nottingham',
  'Cardiff',
  'Belfast',
  'Any / Remote',
];

const STATUS_OPTIONS = [
  { value: 'outside_uk', label: 'Outside the UK' },
  { value: 'uk_different_visa', label: 'In UK on a different visa' },
  { value: 'uk_graduate', label: 'In UK on Graduate visa' },
  { value: 'uk_sponsored', label: 'In UK on sponsored visa' },
  { value: 'uk_citizen_pr', label: 'UK citizen / permanent resident' },
  { value: 'other', label: 'Other' },
];

const STEPS = [
  { icon: Globe, label: 'Visa Route' },
  { icon: Briefcase, label: 'Industries' },
  { icon: MapPin, label: 'Locations' },
  { icon: User, label: 'Status' },
];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [visaRoute, setVisaRoute] = useState<string>('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const { token } = useAuthStore();

  const toggleItem = useCallback(
    (list: string[], setList: (v: string[]) => void, item: string) => {
      setList(
        list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
      );
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile/setup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            visa_route: visaRoute || null,
            target_industries: industries.length > 0 ? industries : null,
            target_locations: locations.length > 0 ? locations : null,
            current_status: status || null,
          }),
        }
      );
      if (res.ok) {
        onComplete();
      }
    } catch (err) {
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg !p-0 border-amber/20 animate-slideInUp">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-data text-sm font-bold uppercase tracking-[0.15em] text-amber">
            Mission Briefing
          </h2>
          <p className="text-xs text-dim mt-1">
            Personalize your intelligence terminal in 4 steps
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex border-b border-border">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setStep(i)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-data uppercase tracking-wider transition-colors',
                i === step
                  ? 'text-amber bg-amber/5 border-b-2 border-amber'
                  : i < step
                    ? 'text-green'
                    : 'text-dim'
              )}
            >
              {i < step ? (
                <Check size={10} className="text-green" />
              ) : (
                <s.icon size={10} />
              )}
              {s.label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="p-5 min-h-[260px]">
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                Which visa route are you interested in?
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {VISA_ROUTES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setVisaRoute(r)}
                    className={cn(
                      'px-3 py-2 text-xs font-data border transition-colors text-left',
                      visaRoute === r
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                Select your target industries (multiple allowed)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => toggleItem(industries, setIndustries, ind)}
                    className={cn(
                      'px-3 py-2 text-xs font-data border transition-colors text-left',
                      industries.includes(ind)
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                Where in the UK do you want to work? (multiple allowed)
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {UK_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => toggleItem(locations, setLocations, loc)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-data border transition-colors text-left',
                      locations.includes(loc)
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <p className="text-xs text-dim mb-3">
                What is your current immigration status?
              </p>
              <div className="space-y-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      'w-full px-3 py-2.5 text-xs font-data border transition-colors text-left',
                      status === opt.value
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-border text-dim hover:border-amber/30 hover:text-text'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className={cn(
              'flex items-center gap-1 text-xs font-data',
              step === 0 ? 'text-muted cursor-not-allowed' : 'text-dim hover:text-text'
            )}
          >
            <ChevronLeft size={12} />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 text-xs font-data text-amber hover:text-text transition-colors"
            >
              Next
              <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber/20 border border-amber/30 text-amber text-xs font-data font-bold uppercase tracking-wider hover:bg-amber/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Launch Terminal'}
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
