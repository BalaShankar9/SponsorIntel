'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const features: PlanFeature[] = [
  { name: 'Sponsor Search', free: true, pro: true, enterprise: true },
  { name: 'Company Profiles', free: 'Basic', pro: 'Full', enterprise: 'Full + API' },
  { name: 'Interactive Map', free: true, pro: true, enterprise: true },
  { name: 'Job Intelligence', free: '50/day', pro: 'Unlimited', enterprise: 'Unlimited + Export' },
  { name: 'Trends & Analytics', free: false, pro: true, enterprise: true },
  { name: 'Signals Feed', free: 'Delayed', pro: 'Real-time', enterprise: 'Real-time + Webhooks' },
  { name: 'Compare Tool', free: false, pro: 'Up to 4', enterprise: 'Unlimited' },
  { name: 'Application Tracker', free: false, pro: true, enterprise: true },
  { name: 'Custom Alerts', free: false, pro: '10 alerts', enterprise: 'Unlimited' },
  { name: 'Notes', free: '10 notes', pro: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'CSV Export', free: false, pro: true, enterprise: true },
  { name: 'API Access', free: false, pro: false, enterprise: true },
  { name: 'Priority Support', free: false, pro: true, enterprise: true },
  { name: 'Dedicated Account Manager', free: false, pro: false, enterprise: true },
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Essential tools for job seekers',
    cta: 'Sign Up Free',
    ctaVariant: 'secondary' as const,
    highlighted: false,
    features: [
      'Search 100k+ sponsors',
      'Basic company profiles',
      'Interactive UK map',
      'Limited job search',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    description: 'Full intelligence suite for serious applicants',
    cta: 'Start 14-Day Trial',
    ctaVariant: 'primary' as const,
    highlighted: true,
    features: [
      'Everything in Free',
      'Full company profiles + scores',
      'Trends & analytics',
      'Real-time signals feed',
      'Compare up to 4 companies',
      'Application tracker',
      'Custom alerts (10)',
      'CSV export',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    description: 'For immigration firms and recruiters',
    cta: 'Contact Sales',
    ctaVariant: 'secondary' as const,
    highlighted: false,
    features: [
      'Everything in Pro',
      'Unlimited compare & alerts',
      'API access',
      'Webhook integrations',
      'Bulk data export',
      'Dedicated account manager',
      'Custom reporting',
      'SLA guarantee',
    ],
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text">Choose Your Plan</h1>
        <p className="mt-1 text-sm text-dim">
          Start free, upgrade when you need more intelligence
        </p>

        {/* Annual toggle */}
        <div className="mt-4 inline-flex items-center gap-3 rounded-lg bg-s2 p-1">
          <button
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              !annual ? 'bg-accent2 text-white' : 'text-dim hover:text-text'
            )}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              annual ? 'bg-accent2 text-white' : 'text-dim hover:text-text'
            )}
            onClick={() => setAnnual(true)}
          >
            Annual <Badge variant="green" className="ml-1">Save 17%</Badge>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = annual ? plan.yearlyPrice : plan.monthlyPrice;
          const period = annual ? '/yr' : '/mo';

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                plan.highlighted && 'border-accent ring-1 ring-accent/30'
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="blue">Recommended</Badge>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-text">{plan.name}</h3>
                <p className="text-xs text-dim">{plan.description}</p>
              </div>

              <div className="mb-6">
                {price === 0 ? (
                  <p className="text-3xl font-bold text-text">Free</p>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-text">
                      £{annual ? (price / 12).toFixed(2) : price.toFixed(2)}
                    </span>
                    <span className="text-sm text-dim">/mo</span>
                    {annual && price > 0 && (
                      <span className="ml-2 text-xs text-dim2">
                        (£{price.toFixed(2)}{period})
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-green" />
                    <span className="text-sm text-dim">{feature}</span>
                  </div>
                ))}
              </div>

              <Button variant={plan.ctaVariant} className="w-full">
                {plan.cta}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <Card padding={false}>
        <div className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
            Feature Comparison
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left text-xs font-semibold text-dim">Feature</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-dim">Free</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-accent">Pro</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-dim">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.name} className="border-b border-border/50">
                <td className="px-4 py-2.5 text-sm text-text">{f.name}</td>
                {(['free', 'pro', 'enterprise'] as const).map((tier) => (
                  <td key={tier} className="px-4 py-2.5 text-center">
                    {f[tier] === true ? (
                      <Check size={14} className="mx-auto text-green" />
                    ) : f[tier] === false ? (
                      <X size={14} className="mx-auto text-dim2" />
                    ) : (
                      <span className="text-xs text-dim">{f[tier]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
