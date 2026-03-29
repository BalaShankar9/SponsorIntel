'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';

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
  { name: 'Compare Tool', free: false, pro: 'Up to 6', enterprise: 'Unlimited' },
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
    name: 'FREE',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Essential tools for job seekers',
    cta: 'SIGN UP FREE',
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
    name: 'PRO',
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    description: 'Full intelligence for serious applicants',
    cta: 'START 14-DAY TRIAL',
    highlighted: true,
    features: [
      'Everything in Free',
      'Full company profiles + scores',
      'Trends & analytics',
      'Real-time signals feed',
      'Compare up to 6 companies',
      'Application tracker',
      'Custom alerts (10)',
      'CSV export',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    description: 'For immigration firms and recruiters',
    cta: 'CONTACT SALES',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-data text-xl font-bold uppercase tracking-wider text-amber">
          CHOOSE YOUR PLAN
        </h1>
        <p className="mt-1 font-data text-xs text-dim">
          START FREE // UPGRADE WHEN YOU NEED MORE INTELLIGENCE
        </p>

        {/* Billing Toggle */}
        <div className="mt-4 inline-flex items-center gap-px border border-s3 bg-s1">
          <button
            className={`px-4 py-2 font-data text-xs font-bold uppercase transition-colors ${
              !annual ? 'bg-amber text-bg' : 'text-dim hover:text-text'
            }`}
            onClick={() => setAnnual(false)}
          >
            MONTHLY
          </button>
          <button
            className={`px-4 py-2 font-data text-xs font-bold uppercase transition-colors ${
              annual ? 'bg-amber text-bg' : 'text-dim hover:text-text'
            }`}
            onClick={() => setAnnual(true)}
          >
            ANNUAL
            <span className="ml-1 bg-green/20 px-1 py-0.5 text-[8px] text-green">-17%</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = annual ? plan.yearlyPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col border bg-s1 p-5 ${
                plan.highlighted
                  ? 'border-amber'
                  : 'border-s3'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber px-2 py-0.5 font-data text-[9px] font-bold text-bg">
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-data text-sm font-bold text-amber">{plan.name}</h3>
                <p className="font-data text-[10px] text-dim">{plan.description}</p>
              </div>

              <div className="mb-5">
                {price === 0 ? (
                  <p className="font-data text-3xl font-bold text-text">FREE</p>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="font-data text-3xl font-bold text-text">
                      £{annual ? (price / 12).toFixed(2) : price.toFixed(2)}
                    </span>
                    <span className="font-data text-xs text-dim">/MO</span>
                    {annual && price > 0 && (
                      <span className="ml-1 font-data text-[10px] text-muted">
                        (£{price.toFixed(2)}/YR)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-5 flex-1 space-y-1.5">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check size={10} className="mt-0.5 shrink-0 text-green" />
                    <span className="font-data text-[10px] text-dim">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={`w-full py-2 font-data text-xs font-bold uppercase tracking-wider transition-colors ${
                  plan.highlighted
                    ? 'bg-amber text-bg hover:bg-amber/80'
                    : 'border border-s3 text-dim hover:border-amber hover:text-amber'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Matrix */}
      <div className="border border-s3 bg-s1">
        <div className="px-4 py-3">
          <h2 className="font-data text-[10px] font-bold uppercase tracking-widest text-amber">
            FEATURE COMPARISON
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-amber/20">
              <th className="px-4 py-2 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim">FEATURE</th>
              <th className="px-4 py-2 text-center font-data text-[9px] font-bold uppercase tracking-widest text-dim">FREE</th>
              <th className="px-4 py-2 text-center font-data text-[9px] font-bold uppercase tracking-widest text-amber">PRO</th>
              <th className="px-4 py-2 text-center font-data text-[9px] font-bold uppercase tracking-widest text-dim">ENTERPRISE</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.name} className="border-b border-s3/30 hover:bg-amber/5">
                <td className="px-4 py-2 font-data text-[10px] text-text">{f.name}</td>
                {(['free', 'pro', 'enterprise'] as const).map((tier) => (
                  <td key={tier} className="px-4 py-2 text-center">
                    {f[tier] === true ? (
                      <Check size={12} className="mx-auto text-green" />
                    ) : f[tier] === false ? (
                      <X size={12} className="mx-auto text-muted" />
                    ) : (
                      <span className="font-data text-[10px] text-dim">{f[tier]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
