'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RatingBadge, ScoreBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { X, Plus, AlertTriangle } from 'lucide-react';
import { cn, getScoreColor, formatNumber } from '@/lib/utils';
import type { SponsorDetail, Sponsor, PaginatedSponsors } from '@/types';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff'];
const MAX_COMPANIES = 4;

interface CompareCompany {
  detail: SponsorDetail;
  color: string;
}

export default function ComparePage() {
  const isPro = useAuthStore((s) => s.isPro);
  const [companies, setCompanies] = useState<CompareCompany[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Sponsor[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.get<PaginatedSponsors>(`/api/v1/sponsors?q=${encodeURIComponent(q)}&limit=5`);
      setSearchResults(data.data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const addCompany = async (sponsor: Sponsor) => {
    if (companies.length >= MAX_COMPANIES) return;
    if (companies.some((c) => c.detail.id === sponsor.id)) return;

    setLoadingDetail(true);
    try {
      const detail = await api.get<SponsorDetail>(`/api/v1/sponsors/${sponsor.id}`);
      setCompanies((prev) => [
        ...prev,
        { detail, color: COLORS[prev.length] },
      ]);
    } catch (err) {
      console.error('Failed to load company detail:', err);
    } finally {
      setLoadingDetail(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeCompany = (id: string) => {
    setCompanies((prev) => {
      const updated = prev.filter((c) => c.detail.id !== id);
      return updated.map((c, i) => ({ ...c, color: COLORS[i] }));
    });
  };

  // Build radar chart data
  const radarData = companies.length > 0
    ? [
        { metric: 'Compliance', ...Object.fromEntries(companies.map((c) => [c.detail.organisation_name, c.detail.score_breakdown?.compliance_score || 0])) },
        { metric: 'Financial', ...Object.fromEntries(companies.map((c) => [c.detail.organisation_name, c.detail.score_breakdown?.financial_health_score || 0])) },
        { metric: 'Hiring', ...Object.fromEntries(companies.map((c) => [c.detail.organisation_name, c.detail.score_breakdown?.hiring_activity_score || 0])) },
        { metric: 'Reputation', ...Object.fromEntries(companies.map((c) => [c.detail.organisation_name, c.detail.score_breakdown?.reputation_score || 0])) },
        { metric: 'Legitimacy', ...Object.fromEntries(companies.map((c) => [c.detail.organisation_name, c.detail.score_breakdown?.legitimacy_score || 0])) },
        { metric: 'Track Record', ...Object.fromEntries(companies.map((c) => [c.detail.organisation_name, c.detail.score_breakdown?.track_record_score || 0])) },
      ]
    : [];

  // Find best/worst for highlighting
  const getHighlight = (values: (number | null)[], isHigherBetter = true) => {
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length === 0) return { best: -1, worst: -1 };
    const best = isHigherBetter ? Math.max(...valid) : Math.min(...valid);
    const worst = isHigherBetter ? Math.min(...valid) : Math.max(...valid);
    return { best, worst };
  };

  const content = (
    <div className="space-y-4">
      {/* Search + Add */}
      {companies.length < MAX_COMPANIES && (
        <Card>
          <div className="relative">
            <Input
              placeholder="Search companies to compare (up to 4)..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-s1 shadow-lg">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-s2"
                    onClick={() => addCompany(s)}
                    disabled={companies.some((c) => c.detail.id === s.id)}
                  >
                    <Plus size={14} className="text-dim" />
                    <span className="text-text">{s.organisation_name}</span>
                    <span className="text-xs text-dim">{s.town_city}</span>
                    {s.overall_score !== null && (
                      <ScoreBadge score={s.overall_score} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadingDetail && (
            <div className="mt-2 flex items-center gap-2 text-xs text-dim">
              <Spinner size="sm" /> Loading company details...
            </div>
          )}
        </Card>
      )}

      {companies.length === 0 && (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-lg font-semibold text-text">Select companies to compare</p>
            <p className="mt-1 text-sm text-dim">Search above to add up to 4 companies for side-by-side analysis</p>
          </div>
        </Card>
      )}

      {/* Radar Chart */}
      {companies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score Comparison</CardTitle>
            <div className="flex gap-2">
              {companies.map((c) => (
                <button
                  key={c.detail.id}
                  onClick={() => removeCompany(c.detail.id)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-text transition-colors hover:bg-s3"
                  style={{ backgroundColor: `${c.color}20`, color: c.color }}
                >
                  {c.detail.organisation_name}
                  <X size={10} />
                </button>
              ))}
            </div>
          </CardHeader>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#21262d" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#8b949e' }} />
                <PolarRadiusAxis tick={{ fontSize: 10, fill: '#6e7681' }} domain={[0, 100]} />
                {companies.map((c) => (
                  <Radar
                    key={c.detail.id}
                    name={c.detail.organisation_name}
                    dataKey={c.detail.organisation_name}
                    stroke={c.color}
                    fill={c.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Side-by-side detail cards */}
      {companies.length > 0 && (
        <div className={`grid gap-4 grid-cols-${Math.min(companies.length, 4)}`} style={{ gridTemplateColumns: `repeat(${companies.length}, 1fr)` }}>
          {companies.map((c) => {
            const d = c.detail;
            const scores = companies.map((co) => co.detail.overall_score);
            const { best: bestScore, worst: worstScore } = getHighlight(scores);

            return (
              <Card key={d.id}>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-text">{d.organisation_name}</p>
                      <p className="text-xs text-dim">{d.town_city}</p>
                    </div>
                    <button onClick={() => removeCompany(d.id)} className="text-dim hover:text-text">
                      <X size={14} />
                    </button>
                  </div>

                  {/* Overall Score */}
                  <div className="text-center">
                    <span className={cn(
                      'inline-block rounded-lg px-4 py-2 text-2xl font-bold',
                      d.overall_score === bestScore ? 'bg-green/20 text-green' :
                      d.overall_score === worstScore && companies.length > 1 ? 'bg-red/20 text-red' :
                      'bg-s3 text-text'
                    )}>
                      {d.overall_score ?? '--'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-dim">Rating</span>
                      <RatingBadge rating={d.rating} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dim">Routes</span>
                      <span className="text-text">{d.route?.join(', ') || '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dim">Years on Register</span>
                      <span className="text-text">
                        {d.first_seen_date
                          ? Math.floor((Date.now() - new Date(d.first_seen_date).getTime()) / (365.25 * 86400000))
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dim">Active Jobs</span>
                      <span className={cn(
                        'font-medium',
                        d.active_job_count === Math.max(...companies.map((co) => co.detail.active_job_count || 0))
                          ? 'text-green' : 'text-text'
                      )}>
                        {d.active_job_count ?? '--'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dim">Employees</span>
                      <span className="text-text">{formatNumber(d.profile?.employee_count_estimate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dim">Glassdoor</span>
                      <span className="text-text">{d.profile?.glassdoor_rating ?? '--'}</span>
                    </div>
                  </div>

                  {/* Risk Flags */}
                  {d.score_breakdown?.risk_flags && d.score_breakdown.risk_flags.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-dim">Risk Flags</p>
                      <div className="flex flex-wrap gap-1">
                        {d.score_breakdown.risk_flags.map((flag) => (
                          <Badge key={flag} variant="red">
                            <AlertTriangle size={10} className="mr-1" />
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Compare Tool</h1>
        <p className="text-sm text-dim">Side-by-side sponsor company comparison</p>
      </div>

      <ProGate isAllowed={isPro} feature="Compare Tool">
        {content}
      </ProGate>
    </div>
  );
}
