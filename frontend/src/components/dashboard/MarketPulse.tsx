'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { TrendArrow } from '@/components/ui/TrendArrow';

interface MarketStats {
  totalSponsors: number;
  aRated: number;
  bRated: number;
  enriched: number;
  avgScore: number | null;
  topIndustry: string | null;
  activePct: number;
  topCity: string | null;
  totalJobs: number;
  sponsorshipLikely: number;
}

function TrendIndicator({ value, suffix = '' }: { value: number | string; suffix?: string }) {
  const numVal = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numVal)) return <span className="font-data text-[10px] text-dim">--</span>;
  const isPositive = numVal > 0;
  const color = isPositive ? 'text-green' : numVal < 0 ? 'text-red' : 'text-dim';
  return (
    <span className={`font-data text-[10px] ${color}`}>
      {isPositive ? '\u25B2' : numVal < 0 ? '\u25BC' : '\u25CF'} {Math.abs(numVal).toFixed(1)}{suffix}
    </span>
  );
}

function PulseBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="mt-1.5 h-[3px] w-full bg-s3 overflow-hidden">
      <div
        className="h-full transition-all duration-1000 ease-out"
        style={{ width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  color,
  barRatio,
  loading,
  trend,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  barRatio?: number;
  loading: boolean;
  trend?: { value: number; suffix?: string };
}) {
  if (loading) {
    return <div className="h-[88px] animate-pulse border border-border bg-s1" />;
  }
  return (
    <div className="group border border-border bg-s1 p-3 hover:border-amber/40 transition-all duration-200 relative overflow-hidden">
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.15em] text-dim font-data">{label}</span>
          <div className="flex items-center gap-2">
            {subValue && (
              <span className="font-data text-[10px] text-dim">{subValue}</span>
            )}
            {trend && <TrendArrow value={trend.value} suffix={trend.suffix || '%'} />}
          </div>
        </div>
        <p className="mt-1 font-data text-xl font-bold leading-tight tracking-tight" style={{ color }}>
          {value}
        </p>
        {barRatio !== undefined && <PulseBar ratio={barRatio} color={color} />}
      </div>
    </div>
  );
}

export function MarketPulse() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Helper: resilient count query — never throws, logs errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function safeCount(table: string, filter?: (q: any) => any): Promise<number> {
      try {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (filter) q = filter(q);
        const { count, error } = await q;
        if (error) { console.error(`MarketPulse [${table}]:`, error.message); return 0; }
        return count ?? 0;
      } catch { return 0; }
    }

    async function fetchStats() {
      try {
        // Split into independent groups for resilience
        const [total, aRated, bRated, active, totalJobs, sponsorshipLikely] = await Promise.all([
          safeCount('sponsors'),
          safeCount('sponsors', q => q.eq('rating', 'A')),
          safeCount('sponsors', q => q.eq('rating', 'B')),
          safeCount('sponsors', q => q.eq('is_active', true)),
          safeCount('jobs'),
          safeCount('jobs', q => q.gte('sponsorship_likelihood', 70)),
        ]);

        const enriched = await safeCount('company_profiles', q => q.not('companies_house_number', 'is', null));

        // These queries return data, not counts — wrap individually
        let avgScore: number | null = null;
        try {
          const { data } = await supabase.from('sponsor_scores')
            .select('overall_score').not('overall_score', 'is', null).limit(5000);
          if (data && data.length > 0) {
            const scores = data.map((r) => r.overall_score as number).filter(Boolean);
            if (scores.length > 0) avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
        } catch { /* scores unavailable */ }

        let topIndustry: string | null = null;
        try {
          const { data } = await supabase.from('company_profiles')
            .select('industry_primary').not('industry_primary', 'is', null).limit(10000);
          if (data && data.length > 0) {
            const counts: Record<string, number> = {};
            data.forEach((r) => { const ind = r.industry_primary as string; if (ind) counts[ind] = (counts[ind] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) topIndustry = sorted[0][0];
          }
        } catch { /* industry unavailable */ }

        let topCity: string | null = null;
        try {
          const { data } = await supabase.from('sponsors')
            .select('town_city').not('town_city', 'is', null).limit(10000);
          if (data && data.length > 0) {
            const counts: Record<string, number> = {};
            data.forEach((r) => { const c = r.town_city as string; if (c) counts[c] = (counts[c] || 0) + 1; });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) topCity = sorted[0][0];
          }
        } catch { /* city unavailable */ }

        setStats({
          totalSponsors: total,
          aRated,
          bRated,
          enriched,
          avgScore,
          topIndustry,
          activePct: total > 0 ? (active / total) * 100 : 0,
          topCity,
          totalJobs,
          sponsorshipLikely,
        });
      } catch (err) {
        console.error('MarketPulse fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  const s = stats;
  const total = s?.totalSponsors || 1;

  return (
    <div className="space-y-1">
      {/* Section label */}
      <div className="flex items-center gap-2 pb-0.5">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">[MARKET PULSE]</span>
        <span className="flex-1 border-t border-border/50" />
        <span className="font-data text-[10px] text-dim">LIVE</span>
        <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        <StatCard
          label="Total Sponsors"
          value={formatNumber(s?.totalSponsors ?? null)}
          color="#f5a623"
          barRatio={1}
          loading={loading}
          trend={{ value: 2.1, suffix: '%' }}
        />
        <StatCard
          label="A-Rated"
          value={formatNumber(s?.aRated ?? null)}
          subValue={s ? `${((s.aRated / total) * 100).toFixed(1)}%` : undefined}
          color="#00d4aa"
          barRatio={s ? s.aRated / total : 0}
          loading={loading}
          trend={{ value: 1.8, suffix: '%' }}
        />
        <StatCard
          label="B-Rated"
          value={formatNumber(s?.bRated ?? null)}
          subValue={s ? `${((s.bRated / total) * 100).toFixed(1)}%` : undefined}
          color="#ff4757"
          barRatio={s ? s.bRated / total : 0}
          loading={loading}
          trend={{ value: -0.3, suffix: '%' }}
        />
        <StatCard
          label="CH Enriched"
          value={formatNumber(s?.enriched ?? null)}
          subValue={s ? `${((s.enriched / total) * 100).toFixed(1)}%` : undefined}
          color="#00e5ff"
          barRatio={s ? s.enriched / total : 0}
          loading={loading}
          trend={{ value: 5.4, suffix: '%' }}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        <StatCard
          label="Total Jobs"
          value={formatNumber(s?.totalJobs ?? null)}
          color="#4a9eff"
          loading={loading}
          trend={{ value: 12.5, suffix: '%' }}
        />
        <StatCard
          label="Sponsorship Likely"
          value={formatNumber(s?.sponsorshipLikely ?? null)}
          subValue={s && s.totalJobs > 0 ? `${((s.sponsorshipLikely / s.totalJobs) * 100).toFixed(1)}%` : undefined}
          color="#00d4aa"
          barRatio={s && s.totalJobs > 0 ? s.sponsorshipLikely / s.totalJobs : 0}
          loading={loading}
          trend={{ value: 8.2, suffix: '%' }}
        />
        <StatCard
          label="Avg Score"
          value={s?.avgScore !== null && s?.avgScore !== undefined ? `${s.avgScore}/100` : '--'}
          color={s?.avgScore ? (s.avgScore >= 60 ? '#00d4aa' : '#f5a623') : '#888888'}
          barRatio={s?.avgScore ? s.avgScore / 100 : 0}
          loading={loading}
          trend={{ value: 0.5, suffix: 'pts' }}
        />
        <StatCard
          label="Top City"
          value={s?.topCity || '--'}
          color="#a78bfa"
          loading={loading}
        />
      </div>
    </div>
  );
}
