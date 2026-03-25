'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MarketPulse } from '@/components/dashboard/MarketPulse';
import { GrowthChart } from '@/components/dashboard/GrowthChart';
import { TopHiring } from '@/components/dashboard/TopHiring';
import { LiveFeed } from '@/components/dashboard/LiveFeed';
import { IndustryBreakdown } from '@/components/dashboard/IndustryBreakdown';
import { supabase } from '@/lib/supabase';
import { formatNumber, timeAgo } from '@/lib/utils';
import { Activity, Database, Cpu, Clock, ExternalLink, Briefcase, TrendingUp, Bot, Shield, Brain, HeartPulse, Compass, Eye, ClipboardCheck, Network } from 'lucide-react';
import { LoadingTerminal } from '@/components/ui/LoadingTerminal';
import { DailyBriefing } from '@/components/dashboard/DailyBriefing';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';

interface AgentStatus {
  lastRunAt: string | null;
  jobsScrapedToday: number;
  sourcesActive: number;
  enrichmentQueue: number;
}

interface TopSponsorCompany {
  id: string;
  name: string;
  city: string | null;
  rating: string | null;
  jobCount: number;
}

interface RecentJob {
  id: string;
  title: string;
  company: string;
  city: string | null;
  likelihood: number | null;
  sourceUrl: string | null;
  postedDate: string | null;
  sponsorId: string | null;
}

// Helper: run a count query independently so one failure doesn't kill all stats
async function safeCount(table: string, filter?: (q: any) => any): Promise<number> {
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) { console.error(`Count query error [${table}]:`, error.message); return 0; }
    return count ?? 0;
  } catch (err) { console.error(`Count query exception [${table}]:`, err); return 0; }
}

export default function DashboardPage() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [topCompanies, setTopCompanies] = useState<TopSponsorCompany[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [flashedSponsorId, setFlashedSponsorId] = useState<string | null>(null);

  useRealtimeSubscription({
    table: 'sponsors',
    event: '*',
    enabled: true,
    onChange: (payload) => {
      const id = (payload.new as Record<string, unknown>)?.id as string;
      if (id) {
        setFlashedSponsorId(id);
        setTimeout(() => setFlashedSponsorId(null), 500);
      }
    },
  });

  useRealtimeSubscription({
    table: 'sponsor_scores',
    event: 'UPDATE',
    enabled: true,
    onChange: () => {
      // Score updates trigger visual feedback via the 15s polling interval
    },
  });

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live enrichment stats
  const [enrichStats, setEnrichStats] = useState<{
    linkedin: number; websites: number; careers: number;
    aiEnriched: number; total: number;
    l1: number; l2: number; l3: number; l4: number; l5: number;
  } | null>(null);

  useEffect(() => {
    async function fetchEnrichStats() {
      // Batch 1: small result sets (always reliable)
      const [total, careers, l2, l4, l5] = await Promise.all([
        safeCount('sponsors'),
        safeCount('company_profiles', q => q.eq('has_careers_page', true)),
        safeCount('company_profiles', q => q.eq('enrichment_level', 2)),   // ~433
        safeCount('company_profiles', q => q.eq('enrichment_level', 4)),   // ~1,782
        safeCount('company_profiles', q => q.eq('enrichment_level', 5)),   // ~2
      ]);

      // Batch 2: medium queries (staggered from batch 1)
      const [websites, l3plus] = await Promise.all([
        safeCount('company_profiles', q => q.not('website_url', 'is', null)),  // ~5,410
        safeCount('company_profiles', q => q.gte('enrichment_level', 3)),      // ~44,601
      ]);

      // Derive L3 and L1 arithmetically — avoids querying L1 (96K rows) which intermittently 500s
      const l3 = Math.max(0, l3plus - l4 - l5);
      const l1 = Math.max(0, total - l2 - l3 - l4 - l5);
      const aiEnriched = l3plus;

      // Batch 3: heaviest query isolated (NOT NULL over 50K+ rows can 500)
      const linkedin = await safeCount('company_profiles', q => q.not('linkedin_url', 'is', null));

      const newStats = { linkedin, websites, careers, aiEnriched, total: total || 1, l1, l2, l3, l4, l5 };
      setEnrichStats(prev => {
        if (!prev) return newStats;
        // Retain previous non-zero values on transient Supabase timeouts
        return {
          linkedin: linkedin > 0 ? linkedin : prev.linkedin,
          websites: websites > 0 ? websites : prev.websites,
          careers: careers > 0 ? careers : prev.careers,
          aiEnriched: aiEnriched > 0 ? aiEnriched : prev.aiEnriched,
          total: total > 0 ? total : prev.total,
          l1: l1 > 0 ? l1 : prev.l1,
          l2: l2,
          l3: l3 > 0 ? l3 : prev.l3,
          l4: l4,
          l5: l5,
        };
      });
    }
    fetchEnrichStats();
    const interval = setInterval(fetchEnrichStats, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Agent Swarm Status — derive from real data truthfully
  useEffect(() => {
    async function fetchAgentStatus() {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        // Run each query independently for resilience
        const [swarmRes, todayJobsRes, sourcesRes, totalSponsors, l3plus] = await Promise.all([
          // Last scrape run
          Promise.resolve(supabase.from('swarm_metrics').select('completed_at, jobs_scraped')
            .order('completed_at', { ascending: false }).limit(1))
            .catch(() => ({ data: null, error: null })),
          // Jobs added today
          Promise.resolve(supabase.from('jobs').select('id', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString()))
            .catch(() => ({ count: 0, data: null, error: null })),
          // Derive active sources from distinct sources in recent jobs (truthful)
          Promise.resolve(supabase.from('jobs').select('source')
            .gte('posted_date', weekAgo)
            .limit(5000))
            .catch(() => ({ data: [], error: null })),
          // Total sponsors (always reliable)
          safeCount('sponsors'),
          // L3+ enriched (reliable — smaller result set)
          safeCount('company_profiles', q => q.gte('enrichment_level', 3)),
        ]);

        // Derive enrichment queue = total - L3+ (avoids querying L1 directly — 96K rows times out)
        const enrichQueue = Math.max(0, totalSponsors - l3plus);

        const lastRun = swarmRes.data?.[0];
        // Count distinct active sources from recent jobs
        const recentSources = new Set(
          (sourcesRes.data || []).map((j: { source: string }) => j.source).filter(Boolean)
        );

        setAgentStatus({
          lastRunAt: lastRun?.completed_at || null,
          jobsScrapedToday: (todayJobsRes as { count?: number | null }).count || 0,
          sourcesActive: recentSources.size,
          enrichmentQueue: enrichQueue,
        });
        setLastScraped(lastRun?.completed_at || null);
      } catch (err) {
        console.error('Agent status fetch error:', err);
        setAgentStatus({ lastRunAt: null, jobsScrapedToday: 0, sourcesActive: 0, enrichmentQueue: 0 });
      } finally {
        setLoadingAgent(false);
      }
    }
    fetchAgentStatus();
    // Refresh agent status every 30s
    const interval = setInterval(fetchAgentStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Top Sponsoring Companies (companies with most jobs)
  useEffect(() => {
    async function fetchTopCompanies() {
      try {
        // Get jobs grouped by sponsor_id
        const { data: jobData } = await supabase
          .from('jobs')
          .select('sponsor_id')
          .not('sponsor_id', 'is', null)
          .limit(5000);

        if (jobData && jobData.length > 0) {
          const counts: Record<string, number> = {};
          jobData.forEach((j) => {
            if (j.sponsor_id) counts[j.sponsor_id] = (counts[j.sponsor_id] || 0) + 1;
          });

          const topIds = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

          const sponsorIds = topIds.map(([id]) => id);
          const { data: sponsors } = await supabase
            .from('sponsors')
            .select('id, organisation_name, town_city, rating')
            .in('id', sponsorIds);

          if (sponsors) {
            const sponsorMap = new Map(sponsors.map((s) => [s.id, s]));
            const merged: TopSponsorCompany[] = topIds
              .map(([id, count]) => {
                const s = sponsorMap.get(id);
                if (!s) return null;
                return {
                  id: s.id,
                  name: s.organisation_name,
                  city: s.town_city,
                  rating: s.rating,
                  jobCount: count,
                };
              })
              .filter(Boolean) as TopSponsorCompany[];
            setTopCompanies(merged);
          }
        }
      } catch (err) {
        console.error('Top companies fetch error:', err);
      } finally {
        setLoadingCompanies(false);
      }
    }
    fetchTopCompanies();
  }, []);

  // Fetch Recent Sponsorship Jobs
  useEffect(() => {
    async function fetchRecentJobs() {
      try {
        const { data } = await supabase
          .from('jobs')
          .select('id, title_raw, company_name_raw, location_city, sponsorship_likelihood, source_url, posted_date, sponsor_id')
          .gte('sponsorship_likelihood', 60)
          .order('posted_date', { ascending: false, nullsFirst: false })
          .limit(10);

        if (data) {
          setRecentJobs(data.map((j) => ({
            id: j.id,
            title: j.title_raw,
            company: j.company_name_raw,
            city: j.location_city,
            likelihood: j.sponsorship_likelihood,
            sourceUrl: j.source_url,
            postedDate: j.posted_date,
            sponsorId: j.sponsor_id,
          })));
        }
      } catch (err) {
        console.error('Recent jobs fetch error:', err);
      } finally {
        setLoadingJobs(false);
      }
    }
    fetchRecentJobs();
  }, []);

  return (
    <div className="space-y-2">
      <DailyBriefing />
      {/* Terminal header bar */}
      <div className="border border-border bg-s1 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-green rounded-full animate-pulse" />
            <h1 className="font-data text-sm font-bold uppercase tracking-[0.2em] text-amber">
              SponsorIntel Command Centre
            </h1>
          </div>
          <span className="font-data text-[10px] text-dim border-l border-border pl-4">
            UK VISA SPONSORSHIP INTELLIGENCE
          </span>
        </div>
        <div className="flex items-center gap-4">
          {lastScraped && (
            <span className="font-data text-[10px] text-cyan flex items-center gap-1.5">
              <Clock size={10} />
              LAST SCRAPED: {timeAgo(lastScraped).toUpperCase()}
            </span>
          )}
          <span className="font-data text-[10px] text-dim">{date}</span>
          <span className="font-data text-[11px] text-amber tabular-nums">{time}</span>
          <span className="font-data text-[10px] text-green flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-green rounded-full" />
            ONLINE
          </span>
        </div>
      </div>

      {/* Agent Swarm Status Panel */}
      <div className="border border-border bg-s1">
        <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
          <Cpu size={11} className="text-cyan" />
          <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">[AGENT SWARM STATUS]</span>
          <span className="flex-1 border-t border-border/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
          <span className="font-data text-[9px] text-green">OPERATIONAL</span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-border">
          {loadingAgent ? (
            <div className="col-span-4">
              <LoadingTerminal
                messages={[
                  'Connecting to agent swarm...',
                  'Checking scraper health across 23 sources...',
                  'Aggregating today\'s job harvest...',
                  'Computing enrichment queue depth...',
                ]}
              />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 group hover:bg-s2/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={10} className="text-dim" />
                  <span className="font-data text-[9px] uppercase tracking-wider text-dim">Last Run</span>
                </div>
                <p className="font-data text-sm font-bold text-amber tabular-nums">
                  {agentStatus?.lastRunAt ? timeAgo(agentStatus.lastRunAt) : 'Never'}
                </p>
              </div>
              <div className="px-4 py-3 group hover:bg-s2/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Briefcase size={10} className="text-dim" />
                  <span className="font-data text-[9px] uppercase tracking-wider text-dim">Jobs Scraped Today</span>
                </div>
                <p className="font-data text-sm font-bold text-green tabular-nums">
                  {formatNumber(agentStatus?.jobsScrapedToday ?? 0)}
                </p>
              </div>
              <div className="px-4 py-3 group hover:bg-s2/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity size={10} className="text-dim" />
                  <span className="font-data text-[9px] uppercase tracking-wider text-dim">Job Sources</span>
                </div>
                <p className="font-data text-sm font-bold text-cyan tabular-nums">
                  {agentStatus?.sourcesActive ?? 0}
                </p>
              </div>
              <div className="px-4 py-3 group hover:bg-s2/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Database size={10} className="text-dim" />
                  <span className="font-data text-[9px] uppercase tracking-wider text-dim">Enrichment Queue</span>
                </div>
                <p className="font-data text-sm font-bold text-purple tabular-nums">
                  {formatNumber(agentStatus?.enrichmentQueue ?? 0)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Live Enrichment Progress */}
      {enrichStats ? (
        <div className="border border-border bg-s1">
          <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
            <Brain size={11} className="text-purple" />
            <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">[ENRICHMENT ENGINE — LIVE]</span>
            <span className="flex-1 border-t border-border/50" />
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
            <span className="font-data text-[9px] text-green">PROCESSING</span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-border">
            {[
              { label: 'LinkedIn URLs', value: enrichStats.linkedin, pct: (enrichStats.linkedin / enrichStats.total * 100).toFixed(1), color: 'text-cyan' },
              { label: 'Website URLs', value: enrichStats.websites, pct: (enrichStats.websites / enrichStats.total * 100).toFixed(1), color: 'text-amber' },
              { label: 'AI Enriched', value: enrichStats.aiEnriched, pct: (enrichStats.aiEnriched / enrichStats.total * 100).toFixed(1), color: 'text-purple' },
              { label: 'Career Pages', value: enrichStats.careers, pct: null, color: 'text-green' },
              { label: 'Remaining (L1)', value: enrichStats.l1, pct: (enrichStats.l1 / enrichStats.total * 100).toFixed(1), color: 'text-red' },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3 group hover:bg-s2/30 transition-colors">
                <span className="font-data text-[9px] uppercase tracking-wider text-dim block mb-1">{s.label}</span>
                <p className={`font-data text-lg font-bold tabular-nums ${s.color}`}>
                  {formatNumber(s.value)}
                </p>
                {s.pct && <span className="font-data text-[10px] text-dim">{s.pct}%</span>}
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-data text-[9px] text-dim uppercase tracking-wider">Enrichment Level Distribution</span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-s3">
              {[
                { count: enrichStats.l1, color: 'bg-red/60', label: 'L1' },
                { count: enrichStats.l2, color: 'bg-amber/60', label: 'L2' },
                { count: enrichStats.l3, color: 'bg-purple/60', label: 'L3' },
                { count: enrichStats.l4, color: 'bg-cyan/60', label: 'L4' },
                { count: enrichStats.l5, color: 'bg-green/60', label: 'L5' },
              ].map((level) => (
                <div
                  key={level.label}
                  className={`${level.color} transition-all duration-1000`}
                  style={{ width: `${(level.count / enrichStats.total) * 100}%` }}
                  title={`${level.label}: ${formatNumber(level.count)}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {['L1', 'L2', 'L3', 'L4', 'L5'].map((l, i) => {
                const counts = [enrichStats.l1, enrichStats.l2, enrichStats.l3, enrichStats.l4, enrichStats.l5];
                const colors = ['text-red/60', 'text-amber/60', 'text-purple/60', 'text-cyan/60', 'text-green/60'];
                return (
                  <span key={l} className={`font-data text-[8px] ${colors[i]}`}>
                    {l}: {formatNumber(counts[i])}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border bg-s1">
          <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
            <Brain size={11} className="text-purple" />
            <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">[ENRICHMENT ENGINE — LIVE]</span>
            <span className="flex-1 border-t border-border/50" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />
            <span className="font-data text-[9px] text-amber">LOADING</span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 animate-pulse">
                <div className="h-3 bg-s2 rounded w-20 mb-2" />
                <div className="h-5 bg-s2 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Roster */}
      <div className="border border-border bg-s1">
        <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
          <Bot size={11} className="text-amber" />
          <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">[TEAM ROSTER]</span>
          <span className="flex-1 border-t border-border/50" />
          <span className="font-data text-[9px] text-dim">{'9 LEADS // 47 TEAM MEMBERS // 7 DEPARTMENTS'}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {[
            { name: 'Aria Singh', title: 'Head of Job Sourcing', dept: 'Acquisition', mission: 'Leads a team sweeping 23+ job boards every hour to find every sponsorship opportunity', icon: Compass, color: 'text-cyan', schedule: 'Every hour', team: 5 },
            { name: 'Marcus Chen', title: 'Head of Data Quality', dept: 'Quality Assurance', mission: 'Runs QA across all records — cleaning, validating, deduplicating, killing spam', icon: Shield, color: 'text-green', schedule: 'Every 15 min', team: 8 },
            { name: 'Priya Kapoor', title: 'Lead Sponsorship Analyst', dept: 'Intelligence', mission: 'Scores every job 0-100% for sponsorship likelihood using 40+ signals', icon: Brain, color: 'text-purple', schedule: 'Every 15 min', team: 12 },
            { name: 'James Okafor', title: 'Listings Lifecycle Mgr', dept: 'Operations', mission: 'Keeps the board fresh — checks live status, catches reposts, removes stale jobs', icon: HeartPulse, color: 'text-red', schedule: 'Every 4 hours', team: 4 },
            { name: 'Elena Volkov', title: 'Company Research Director', dept: 'Research', mission: 'Maps digital presence of 124K+ sponsors — websites, LinkedIn, careers pages', icon: Compass, color: 'text-amber', schedule: 'Every 2 hours', team: 4 },
            { name: 'Daniel Mensah', title: 'Corporate Intel Officer', dept: 'Compliance', mission: 'Monitors Companies House for filings, status changes, officer moves, red flags', icon: Eye, color: 'text-cyan', schedule: 'Every 3 hours', team: 4 },
            { name: 'Sophie Laurent', title: 'Data Completeness Auditor', dept: 'Quality Assurance', mission: 'Audits every record for gaps, tracks source health, scores hiring activity', icon: ClipboardCheck, color: 'text-green', schedule: 'Every 30 min', team: 4 },
            { name: 'Raj Patel', title: 'Chief Ops Coordinator', dept: 'Operations', mission: 'Keeps everything running — monitors all teams, spots anomalies, raises alerts', icon: Network, color: 'text-amber', schedule: 'Every 30 min', team: 3 },
            { name: 'Dr. Alex Thornton', title: 'Head of Platform Intel', dept: 'Improvement & R&D', mission: 'R&D team continuously optimizes keywords, discovers new sources, calibrates scoring', icon: Brain, color: 'text-purple', schedule: 'Daily at 5 AM', team: 3 },
          ].map((agent) => (
            <div key={agent.name} className="bg-s1 px-3 py-2.5 group hover:bg-s2/30 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <agent.icon size={12} className={agent.color} />
                <span className={`font-data text-[11px] font-bold ${agent.color}`}>
                  {agent.name}
                </span>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
              </div>
              <p className="font-data text-[10px] text-text font-medium mb-0.5">{agent.title}</p>
              <p className="font-data text-[8px] uppercase tracking-wider text-dim/50 mb-1">{agent.dept}</p>
              <p className="font-data text-[9px] text-dim/70 leading-relaxed mb-1.5">{agent.mission}</p>
              <div className="flex items-center gap-2 font-data text-[8px] text-dim">
                <span className="border border-border px-1 py-px">{agent.schedule}</span>
                <span className="border border-border px-1 py-px">{agent.team} in team</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Pulse - 8 stat cards */}
      <MarketPulse />

      {/* Three-column: Top Companies + Recent Jobs + Live Feed */}
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-3">
        {/* Top Sponsoring Companies */}
        <div className="border border-border bg-s1 flex flex-col">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={11} className="text-amber" />
              <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[TOP SPONSORING COMPANIES]</h3>
            </div>
            <span className="font-data text-[10px] text-dim">BY JOB COUNT</span>
          </div>
          {loadingCompanies ? (
            <div className="flex-1 space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse border-b border-border/20 bg-s1" />
              ))}
            </div>
          ) : topCompanies.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <span className="font-data text-[11px] text-dim">NO JOB DATA AVAILABLE</span>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-[24px_1fr_50px_40px] items-center border-b border-border px-3 py-1 text-[9px] font-data uppercase tracking-wider text-dim">
                <span>#</span>
                <span>Company</span>
                <span className="text-right">Jobs</span>
                <span className="text-right">Rate</span>
              </div>
              {topCompanies.map((c, idx) => (
                <div
                  key={c.id}
                  className={cn(
                    'stagger-item grid grid-cols-[24px_1fr_50px_40px] items-center border-b border-border/15 px-3 py-1.5 hover:bg-s2/40 transition-colors',
                    flashedSponsorId === c.id && 'data-updated'
                  )}
                >
                  <span className="font-data text-[10px] text-dim tabular-nums">{idx + 1}</span>
                  <div className="min-w-0 pr-2">
                    <Link
                      href={`/company/${c.id}`}
                      className="block truncate text-[11px] text-amber hover:text-text transition-colors font-data font-medium"
                    >
                      {c.name}
                    </Link>
                    <span className="block truncate text-[9px] text-dim">{c.city || '--'}</span>
                  </div>
                  <span className="text-right font-data text-[11px] font-bold text-green tabular-nums">
                    {c.jobCount}
                  </span>
                  <div className="flex justify-end">
                    <span className={`font-data text-[9px] font-bold px-1 py-0.5 ${
                      c.rating === 'A' ? 'text-green bg-green/10' : c.rating === 'B' ? 'text-red bg-red/10' : 'text-dim bg-s3'
                    }`}>
                      {c.rating || '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sponsorship Jobs */}
        <div className="border border-border bg-s1 flex flex-col">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={11} className="text-green" />
              <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[RECENT SPONSORSHIP JOBS]</h3>
            </div>
            <Link href="/jobs" className="font-data text-[9px] text-amber hover:text-text transition-colors">
              VIEW ALL &rarr;
            </Link>
          </div>
          {loadingJobs ? (
            <div className="flex-1 space-y-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse border-b border-border/20 bg-s1" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <span className="font-data text-[11px] text-dim">NO RECENT SPONSORSHIP JOBS</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: '440px' }}>
              {recentJobs.map((job, idx) => (
                <div
                  key={job.id}
                  className="stagger-item group flex items-start gap-2 px-3 py-2 border-b border-border/20 hover:bg-s2/40 transition-colors"
                >
                  {/* Likelihood indicator */}
                  <div className="flex-shrink-0 pt-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      (job.likelihood ?? 0) >= 80 ? 'bg-green' : (job.likelihood ?? 0) >= 60 ? 'bg-amber' : 'bg-dim'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] text-text font-data font-medium">
                        {job.title}
                      </span>
                      {job.sourceUrl && (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-amber hover:text-green transition-colors opacity-0 group-hover:opacity-100"
                          title="Apply"
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {job.sponsorId ? (
                        <Link href={`/company/${job.sponsorId}`} className="text-[9px] text-amber font-data hover:text-text transition-colors truncate">
                          {job.company}
                        </Link>
                      ) : (
                        <span className="text-[9px] text-dim font-data truncate">{job.company}</span>
                      )}
                      {job.city && <span className="text-[9px] text-dim font-data">{job.city}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <span className={`font-data text-[9px] font-bold px-1 py-0.5 tabular-nums ${
                      (job.likelihood ?? 0) >= 80 ? 'text-green bg-green/10' : 'text-amber bg-amber/10'
                    }`}>
                      {job.likelihood ?? '--'}%
                    </span>
                    {job.postedDate && (
                      <span className="font-data text-[8px] text-dim">{timeAgo(job.postedDate)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Feed */}
        <LiveFeed />
      </div>

      {/* Two-column: Rating Distribution + Industry Breakdown */}
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrowthChart />
        </div>
        <TopHiring />
      </div>

      <IndustryBreakdown />

      {/* Terminal footer */}
      <div className="border-t border-border pt-1.5 flex items-center justify-between">
        <span className="font-data text-[9px] text-dim">
          {'SponsorIntel v2.0 // Aria + Marcus + Priya + James + Elena + Daniel + Sophie + Raj + Dr. Alex // 56 employees'}
        </span>
        <span className="font-data text-[9px] text-dim">
          All data sourced from UK Home Office register + Companies House + Job Boards
        </span>
      </div>
    </div>
  );
}
