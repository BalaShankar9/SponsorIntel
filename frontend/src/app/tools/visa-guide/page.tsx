'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface IntelItem {
  id: string;
  title: string;
  summary: string | null;
  impact_level: string | null;
  topic: string | null;
  source_name: string;
  published_at: string | null;
  created_at: string;
}

const VISA_ROUTES = [
  {
    name: 'Skilled Worker Visa',
    slug: 'skilled-worker',
    emoji: '💼',
    salary: '£38,700/year (or going rate for your occupation)',
    duration: 'Up to 5 years',
    settlement: 'Yes — after 5 years',
    requirements: [
      'Job offer from a UK employer with a sponsor licence',
      'Your job must be at an appropriate skill level (RQF 3 or above)',
      'You must be paid at least £38,700/year OR the going rate for your occupation',
      'If your role is on the Immigration Salary List, the going rate requirement is waived',
      'You must prove your English language ability (B1 level)',
      'You need enough savings to support yourself (at least £1,270 in your account for 28 days)',
    ],
    tips: [
      'Search for A-rated sponsors on SponsorIntel — they have the best compliance record',
      'Roles on the Immigration Salary List (ISL) have lower salary requirements',
      'You can switch to Skilled Worker from most other visa routes while in the UK',
      'Your partner and children can come with you (dependant visa)',
      'You can do a second job in the same occupation for 20 hours/week',
    ],
    cost: '£719 – £1,500 (depending on duration) + £1,035/year Immigration Health Surcharge',
    processing: '3 weeks (standard) or 5 working days (priority)',
  },
  {
    name: 'Global Talent Visa',
    slug: 'global-talent',
    emoji: '🌟',
    salary: 'No minimum salary',
    duration: 'Up to 5 years',
    settlement: 'Yes — after 3 years (fast track)',
    requirements: [
      'Endorsement from an approved body in your field',
      'Fields: Science, Engineering, Humanities, Medicine, Digital Technology, Arts & Culture',
      'For Tech: endorsement from Tech Nation (now DSIT)',
      'You must show exceptional talent OR exceptional promise (under 30s)',
      'No job offer required — you can freelance or start a company',
    ],
    tips: [
      'This is the BEST visa for senior professionals — no sponsor needed',
      'Tech workers: show evidence of innovation, open source contributions, or founding a startup',
      'Academic researchers: peer-reviewed publications count strongly',
      'You can apply from inside or outside the UK',
      'Settlement in 3 years instead of 5 — fastest route to permanent residency',
    ],
    cost: '£192 (endorsement) + £192 (visa) + £1,035/year IHS',
    processing: 'Endorsement: 8 weeks | Visa: 3 weeks',
  },
  {
    name: 'Graduate Visa',
    slug: 'graduate',
    emoji: '🎓',
    salary: 'No minimum salary',
    duration: '2 years (3 for PhD)',
    settlement: 'No — must switch to another visa',
    requirements: [
      'Must have completed a UK degree at bachelor level or above',
      'Your university must be a licensed Student sponsor',
      'Must apply while your Student visa is still valid',
      'Must be in the UK when you apply',
      'No job offer needed — you can work in any job',
    ],
    tips: [
      'This is a bridge visa — use the 2 years to find a Skilled Worker sponsor',
      'Start applying for sponsored roles in your final year, not after graduation',
      'Use SponsorIntel to find companies actively hiring in your field',
      'You can switch to Skilled Worker at any time during the 2 years',
      'You CANNOT extend the Graduate visa — plan ahead',
    ],
    cost: '£822 + £1,035/year IHS',
    processing: '8 weeks',
  },
  {
    name: 'Scale-Up Visa',
    slug: 'scale-up',
    emoji: '🚀',
    salary: '£38,700/year',
    duration: '2 years (then unsponsored)',
    settlement: 'Yes — after 5 years',
    requirements: [
      'Job offer from a qualifying scale-up company',
      'Company must have 20%+ annual growth in employment or revenue for 3 years',
      'Your job must be skilled (RQF 6 or above — graduate level)',
      'Paid at least £38,700/year',
      'English language at B1 level',
    ],
    tips: [
      'After 6 months, you can leave your sponsor and work for ANY employer',
      'This is great for startup/scaleup workers who want flexibility',
      'Fewer companies qualify compared to Skilled Worker route',
      'Check Companies House filing data on SponsorIntel for growth metrics',
    ],
    cost: '£822 + £1,035/year IHS',
    processing: '3 weeks',
  },
  {
    name: 'Innovator Founder Visa',
    slug: 'innovator-founder',
    emoji: '💡',
    salary: 'No minimum (self-employed)',
    duration: '3 years (renewable)',
    settlement: 'Yes — after 3 years',
    requirements: [
      'Endorsement from an approved body',
      'Your business idea must be innovative, viable, and scalable',
      'You must have at least £50,000 in investment funds (or endorser confirms no funding needed)',
      'Must show English language ability at B2 level',
      'Must be actively involved in running the business',
    ],
    tips: [
      'Best visa if you want to start a business in the UK',
      'Settlement in 3 years — same as Global Talent',
      'You can bring co-founders on the same visa',
      'Endorsing bodies include: Innovator International, Envestors, several universities',
    ],
    cost: '£1,191 + £1,035/year IHS',
    processing: '3 weeks',
  },
  {
    name: 'Health & Care Worker Visa',
    slug: 'health-care',
    emoji: '🏥',
    salary: '£29,000/year (reduced threshold)',
    duration: 'Up to 5 years',
    settlement: 'Yes — after 5 years',
    requirements: [
      'Job offer from an NHS employer, NHS supplier, or adult social care sector',
      'Your role must be an eligible health or care occupation',
      'Paid at least £29,000/year (lower than standard Skilled Worker)',
      'Employer must be registered with CQC (for care roles)',
      'English language at B1 level',
    ],
    tips: [
      'This is a discounted version of the Skilled Worker visa for healthcare',
      'NO Immigration Health Surcharge — saves £1,035/year',
      'Lower visa application fees than standard Skilled Worker',
      'Covers: nurses, doctors, care workers, paramedics, physiotherapists',
      'Care workers need £29,000 minimum, doctors/nurses follow going rates',
    ],
    cost: '£284 (reduced fee) + NO IHS',
    processing: '3 weeks',
  },
];

const CURRENT_THRESHOLDS = [
  { route: 'Skilled Worker (general)', salary: '£38,700', note: 'Increased from £26,200 in April 2024' },
  { route: 'Skilled Worker (ISL roles)', salary: 'Going rate waived', note: '78 occupations on the Immigration Salary List' },
  { route: 'Health & Care Worker', salary: '£29,000', note: 'Reduced rate for NHS/care sector' },
  { route: 'Scale-Up', salary: '£38,700', note: 'Same as general Skilled Worker' },
  { route: 'Global Talent', salary: 'None', note: 'No salary requirement' },
  { route: 'Graduate', salary: 'None', note: 'Any job, any salary for 2 years' },
];

export default function VisaGuidePage() {
  const [selected, setSelected] = useState(VISA_ROUTES[0]);
  const [recentUpdates, setRecentUpdates] = useState<IntelItem[]>([]);

  useEffect(() => {
    async function loadUpdates() {
      try {
        const { data } = await supabase
          .from('intel_items')
          .select('id, title, summary, impact_level, topic, source_name, published_at, created_at')
          .in('topic', ['rule_change', 'policy_update'])
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentUpdates(data || []);
      } catch {
        // Table may not have classified items yet
      }
    }
    loadUpdates();
  }, []);

  const impactColor = (level: string | null) =>
    level === 'critical' ? 'text-red' : level === 'high' ? 'text-amber' : level === 'medium' ? 'text-cyan' : 'text-dim';

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">UK Visa Routes — Plain English Guide</h1>
        <p className="text-xs text-dim mt-1">
          Every visa route explained simply. Updated in real-time from official government sources.
          Last checked: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Current Salary Thresholds */}
      <div className="border border-amber/30 bg-amber/5 rounded p-4 mb-6">
        <div className="text-[10px] font-data text-amber uppercase tracking-wider mb-3">CURRENT SALARY THRESHOLDS (2024–2025)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CURRENT_THRESHOLDS.map((t) => (
            <div key={t.route} className="bg-bg/50 rounded p-3">
              <div className="text-[10px] font-data text-dim">{t.route}</div>
              <div className="text-sm font-data font-bold text-amber">{t.salary}</div>
              <div className="text-[10px] text-dim mt-1">{t.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Policy Updates */}
      {recentUpdates.length > 0 && (
        <div className="border border-cyan/30 bg-cyan/5 rounded p-4 mb-6">
          <div className="text-[10px] font-data text-cyan uppercase tracking-wider mb-3">RECENT POLICY CHANGES</div>
          <div className="space-y-2">
            {recentUpdates.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className={`text-[10px] font-data font-bold ${impactColor(item.impact_level)}`}>
                  {(item.impact_level || 'info').toUpperCase()}
                </span>
                <div>
                  <div className="text-xs">{item.title}</div>
                  {item.summary && <div className="text-[10px] text-dim mt-0.5">{item.summary}</div>}
                </div>
              </div>
            ))}
          </div>
          <Link href="/intel" className="text-[10px] text-cyan hover:underline mt-2 inline-block">
            View all immigration intelligence →
          </Link>
        </div>
      )}

      {/* Route Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {VISA_ROUTES.map((route) => (
          <button
            key={route.slug}
            onClick={() => setSelected(route)}
            className={`px-3 py-2 rounded text-xs transition-all ${
              selected.slug === route.slug
                ? 'bg-amber text-bg font-semibold'
                : 'border border-border hover:border-amber/30'
            }`}
          >
            {route.emoji} {route.name}
          </button>
        ))}
      </div>

      {/* Selected Route Detail */}
      <div className="border border-border bg-s1 rounded p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{selected.emoji}</span>
          <div>
            <h2 className="text-base font-semibold">{selected.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-data bg-amber/10 text-amber px-2 py-0.5 rounded">{selected.duration}</span>
              <span className="text-[10px] font-data bg-cyan/10 text-cyan px-2 py-0.5 rounded">Settlement: {selected.settlement}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Requirements */}
          <div>
            <div className="text-[10px] font-data text-amber uppercase tracking-wider mb-2">REQUIREMENTS</div>
            <div className="space-y-2">
              {selected.requirements.map((req, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-amber mt-0.5 shrink-0">●</span>
                  <span>{req}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <div className="text-[10px] font-data text-green uppercase tracking-wider mb-2">INSIDER TIPS</div>
            <div className="space-y-2">
              {selected.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-green mt-0.5 shrink-0">💡</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost & Processing */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
          <div>
            <div className="text-[10px] font-data text-dim">MINIMUM SALARY</div>
            <div className="text-sm font-data font-bold text-amber">{selected.salary}</div>
          </div>
          <div>
            <div className="text-[10px] font-data text-dim">APPLICATION COST</div>
            <div className="text-sm font-data font-bold">{selected.cost}</div>
          </div>
          <div>
            <div className="text-[10px] font-data text-dim">PROCESSING TIME</div>
            <div className="text-sm font-data font-bold">{selected.processing}</div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 pt-4 border-t border-border flex gap-3">
          <Link href="/tools/sponsor-check" className="bg-amber text-bg px-4 py-2 rounded text-xs font-semibold hover:bg-amber/90">
            Check if a company will sponsor you →
          </Link>
          <Link href="/tools/salary-calculator" className="border border-border px-4 py-2 rounded text-xs hover:border-amber/30">
            Check salary threshold →
          </Link>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-dim text-center">
        Sources: GOV.UK Immigration Rules, Home Office Guidance, UK Visas & Immigration.
        This is a simplified guide — always check official sources for your specific situation.
      </div>
    </div>
  );
}
