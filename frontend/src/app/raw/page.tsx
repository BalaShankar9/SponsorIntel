'use client';

import Link from 'next/link';

interface Tool {
  name: string;
  slug: string;
  icon: string;
  description: string;
  status: 'live' | 'coming_soon';
  tier: 'free' | 'pro';
  route: string;
}

const TOOLS: Tool[] = [
  {
    name: 'Will They Sponsor Me?',
    slug: 'sponsor-check',
    icon: '🔍',
    description: 'Enter a company name and job title — get an instant AI-powered sponsorship probability assessment backed by government data.',
    status: 'live',
    tier: 'free',
    route: '/tools/sponsor-check',
  },
  {
    name: 'Salary Threshold Calculator',
    slug: 'salary-calculator',
    icon: '💰',
    description: 'Check if your salary meets the Skilled Worker visa threshold. See how it compares to UK market rates with ONS percentile charts.',
    status: 'live',
    tier: 'free',
    route: '/tools/salary-calculator',
  },
  {
    name: 'UK Visa Routes Guide',
    slug: 'visa-guide',
    icon: '📋',
    description: 'Every visa route explained in plain English. Current thresholds, requirements, insider tips, costs — updated in real-time.',
    status: 'live',
    tier: 'free',
    route: '/tools/visa-guide',
  },
  {
    name: 'Sponsor X-Ray',
    slug: 'sponsor-xray',
    icon: '🔬',
    description: 'Deep dive into any sponsor — Companies House filings, financial health, officer changes, hiring patterns, risk signals, and sponsorship history.',
    status: 'coming_soon',
    tier: 'pro',
    route: '#',
  },
  {
    name: 'Route Advisor',
    slug: 'route-advisor',
    icon: '🧭',
    description: 'Answer 10 questions about your background — AI recommends the best visa route with step-by-step action plan and timeline.',
    status: 'coming_soon',
    tier: 'free',
    route: '#',
  },
  {
    name: 'SOC Code Matcher',
    slug: 'soc-matcher',
    icon: '🎯',
    description: 'Enter your job title and description — AI matches you to the correct SOC code with visa threshold and Immigration Salary List status.',
    status: 'coming_soon',
    tier: 'free',
    route: '#',
  },
  {
    name: 'Red Flag Scanner',
    slug: 'red-flag-scanner',
    icon: '🚩',
    description: 'Paste a job listing URL — AI scans for red flags: fake sponsors, below-threshold salaries, suspicious requirements, scam indicators.',
    status: 'coming_soon',
    tier: 'free',
    route: '#',
  },
  {
    name: 'Comparator Pro',
    slug: 'comparator',
    icon: '⚖️',
    description: 'Compare up to 6 sponsors side-by-side — rating, financial health, employee count, Glassdoor scores, visa history, hiring trends.',
    status: 'live',
    tier: 'pro',
    route: '/compare',
  },
  {
    name: 'Market Heatmap',
    slug: 'market-heatmap',
    icon: '🗺️',
    description: 'Interactive UK map showing sponsor density, salary levels, and job availability by region and industry.',
    status: 'live',
    tier: 'free',
    route: '/map',
  },
  {
    name: 'Cover Letter Lab',
    slug: 'cover-letter',
    icon: '✍️',
    description: 'AI generates a tailored cover letter mentioning your visa status professionally. Trained on successful sponsorship applications.',
    status: 'coming_soon',
    tier: 'pro',
    route: '#',
  },
  {
    name: 'Idea Forge',
    slug: 'idea-forge',
    icon: '💡',
    description: 'For Innovator Founder visa applicants — enter your business idea and get a viability report with market analysis, competitors, and endorsing body recommendations.',
    status: 'coming_soon',
    tier: 'pro',
    route: '#',
  },
];

export default function RAWPage() {
  const liveTools = TOOLS.filter(t => t.status === 'live');
  const comingTools = TOOLS.filter(t => t.status === 'coming_soon');

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded bg-cyan/10 flex items-center justify-center">
            <span className="text-cyan text-lg">⚡</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold">RAW — Research & Analysis Wing</h1>
            <p className="text-[10px] font-data text-cyan tracking-wider">AI-POWERED IMMIGRATION TOOLS LABORATORY</p>
          </div>
        </div>
        <p className="text-xs text-dim mt-2 max-w-2xl">
          11 AI-powered tools built on 140K+ sponsor records, government data, and live web intelligence.
          Each tool gives you actionable research — not generic advice.
        </p>
      </div>

      {/* Live Tools */}
      <div className="mb-8">
        <div className="text-[10px] font-data text-green uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
          LIVE TOOLS ({liveTools.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {liveTools.map((tool) => (
            <Link
              key={tool.slug}
              href={tool.route}
              className="border border-border bg-s1 rounded p-4 hover:border-cyan/30 transition-all hover:-translate-y-0.5 group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{tool.icon}</span>
                <span className={`text-[9px] font-data px-2 py-0.5 rounded ${
                  tool.tier === 'free' ? 'bg-green/10 text-green' : 'bg-amber/10 text-amber'
                }`}>
                  {tool.tier.toUpperCase()}
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1 group-hover:text-cyan transition-colors">{tool.name}</h3>
              <p className="text-[11px] text-dim leading-relaxed">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <div className="text-[10px] font-data text-amber uppercase tracking-wider mb-3">
          COMING SOON ({comingTools.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {comingTools.map((tool) => (
            <div
              key={tool.slug}
              className="border border-border/50 bg-s1/50 rounded p-4 opacity-70"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl grayscale">{tool.icon}</span>
                <span className={`text-[9px] font-data px-2 py-0.5 rounded ${
                  tool.tier === 'free' ? 'bg-green/10 text-green/50' : 'bg-amber/10 text-amber/50'
                }`}>
                  {tool.tier.toUpperCase()}
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1">{tool.name}</h3>
              <p className="text-[11px] text-dim leading-relaxed">{tool.description}</p>
              <div className="mt-3 text-[9px] font-data text-amber">LAUNCHING SOON</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center text-[10px] text-dim">
        Free users: 3 tool uses per day | Pro users: Unlimited | Enterprise: API access
      </div>
    </div>
  );
}
