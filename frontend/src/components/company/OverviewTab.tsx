'use client';

import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, getScoreColor, formatDate } from '@/lib/utils';
import type { SponsorDetail, ScoreBreakdown } from '@/types';

interface OverviewTabProps {
  sponsor: SponsorDetail;
}

function ScoreBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  const factors = [
    { label: 'Compliance', value: breakdown.compliance_score },
    { label: 'Financial Health', value: breakdown.financial_health_score },
    { label: 'Hiring Activity', value: breakdown.hiring_activity_score },
    { label: 'Reputation', value: breakdown.reputation_score },
    { label: 'Legitimacy', value: breakdown.legitimacy_score },
    { label: 'Track Record', value: breakdown.track_record_score },
    { label: 'Growth Signal', value: breakdown.growth_signal_score },
  ];

  return (
    <div className="space-y-3">
      {factors.map((f) => (
        <div key={f.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-dim">{f.label}</span>
            <span className={cn('font-medium', getScoreColor(f.value ?? null))}>
              {f.value ?? '--'}/100
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-s3">
            <div
              className={cn('h-full rounded-full transition-all', {
                'bg-green': (f.value ?? 0) >= 80,
                'bg-cyan': (f.value ?? 0) >= 60 && (f.value ?? 0) < 80,
                'bg-orange': (f.value ?? 0) >= 40 && (f.value ?? 0) < 60,
                'bg-red': (f.value ?? 0) < 40,
              })}
              style={{ width: `${f.value ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ sponsor }: OverviewTabProps) {
  const profile = sponsor.profile;
  const breakdown = sponsor.score_breakdown;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Sponsorship Status */}
        <Card>
          <CardHeader>
            <CardTitle>Sponsorship Status</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-dim">Status</p>
              <p className="flex items-center gap-1 text-sm">
                {sponsor.is_active ? (
                  <><CheckCircle size={14} className="text-green" /> <span className="text-green">Active</span></>
                ) : (
                  <><XCircle size={14} className="text-red" /> <span className="text-red">Inactive</span></>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-dim">Rating</p>
              <Badge variant={sponsor.rating === 'A' ? 'green' : 'red'}>
                {sponsor.rating || '--'}-Rated
              </Badge>
            </div>
            <div>
              <p className="text-xs text-dim">Routes</p>
              <p className="text-sm text-text">{sponsor.route?.join(', ') || '--'}</p>
            </div>
            <div>
              <p className="text-xs text-dim">Type</p>
              <p className="text-sm text-text">{sponsor.type_and_rating || '--'}</p>
            </div>
            <div>
              <p className="text-xs text-dim">First Seen</p>
              <p className="text-sm text-text">{formatDate(sponsor.first_seen_date)}</p>
            </div>
            <div>
              <p className="text-xs text-dim">Active Jobs</p>
              <p className="text-sm font-medium text-text">{sponsor.active_job_count ?? '--'}</p>
            </div>
          </div>
        </Card>

        {/* Company Details */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-dim">Companies House</p>
                <p className="text-sm text-accent">{profile.companies_house_number || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-dim">Status</p>
                <p className="text-sm text-text">{profile.company_status || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-dim">Incorporated</p>
                <p className="text-sm text-text">{formatDate(profile.incorporation_date)}</p>
              </div>
              <div>
                <p className="text-xs text-dim">Type</p>
                <p className="text-sm text-text">{profile.company_type || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-dim">Industry</p>
                <p className="text-sm text-text">{profile.industry_primary || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-dim">Employees</p>
                <p className="text-sm text-text">{profile.employee_count_estimate?.toLocaleString() || '--'}</p>
              </div>
              {profile.website_url && (
                <div className="col-span-2">
                  <p className="text-xs text-dim">Website</p>
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                    {profile.website_url}
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Score Bars */}
        {breakdown && (
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <span className="text-2xl font-bold text-accent">{breakdown.overall_score}</span>
            </CardHeader>
            <ScoreBars breakdown={breakdown} />
          </Card>
        )}

        {/* Risk Assessment */}
        {breakdown?.risk_flags && breakdown.risk_flags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
              <Badge variant="red">{breakdown.risk_flags.length} flag(s)</Badge>
            </CardHeader>
            <div className="space-y-2">
              {breakdown.risk_flags.map((flag, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-md bg-red/5 p-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red" />
                  <span className="text-sm text-text">{flag}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
