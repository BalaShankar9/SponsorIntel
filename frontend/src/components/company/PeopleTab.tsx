'use client';

import { Users, TrendingUp, TrendingDown, ExternalLink, Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompanyProfile } from '@/types';

interface PeopleTabProps {
  profile: CompanyProfile | null;
}

export function PeopleTab({ profile }: PeopleTabProps) {
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-s1">
        <div className="text-center">
          <Users size={24} className="mx-auto text-muted mb-2" />
          <p className="font-data text-[11px] text-dim uppercase tracking-wider">No People Data</p>
          <p className="mt-1 text-[10px] text-muted">Company profile has not been enriched yet.</p>
        </div>
      </div>
    );
  }

  const hasWorkforce = profile.employee_count_estimate !== null;

  return (
    <div className="space-y-3">
      {/* Workforce Stats */}
      {hasWorkforce && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {/* Employee count */}
          <div className="border border-border bg-s1 p-3">
            <p className="font-data text-[10px] text-dim uppercase tracking-wider">Employees (est.)</p>
            <p className="mt-1 font-data text-2xl font-bold text-text">
              {profile.employee_count_estimate?.toLocaleString() ?? '--'}
            </p>
            {profile.employee_count_source && (
              <p className="mt-0.5 font-data text-[9px] text-muted">Source: {profile.employee_count_source}</p>
            )}
          </div>

          {/* 6m growth */}
          {profile.employee_growth_6m !== null && (
            <div className={cn(
              'border p-3',
              profile.employee_growth_6m >= 0 ? 'border-green/20 bg-green/5' : 'border-red/20 bg-red/5'
            )}>
              <p className="font-data text-[10px] text-dim uppercase tracking-wider">Growth (6m)</p>
              <div className="mt-1 flex items-center gap-1">
                {profile.employee_growth_6m >= 0 ? (
                  <TrendingUp size={16} className="text-green" />
                ) : (
                  <TrendingDown size={16} className="text-red" />
                )}
                <span className={cn(
                  'font-data text-2xl font-bold',
                  profile.employee_growth_6m >= 0 ? 'text-green' : 'text-red'
                )}>
                  {profile.employee_growth_6m > 0 ? '+' : ''}{profile.employee_growth_6m}%
                </span>
              </div>
            </div>
          )}

          {/* 12m growth */}
          {profile.employee_growth_12m !== null && (
            <div className={cn(
              'border p-3',
              profile.employee_growth_12m >= 0 ? 'border-green/20 bg-green/5' : 'border-red/20 bg-red/5'
            )}>
              <p className="font-data text-[10px] text-dim uppercase tracking-wider">Growth (12m)</p>
              <div className="mt-1 flex items-center gap-1">
                {profile.employee_growth_12m >= 0 ? (
                  <TrendingUp size={16} className="text-green" />
                ) : (
                  <TrendingDown size={16} className="text-red" />
                )}
                <span className={cn(
                  'font-data text-2xl font-bold',
                  profile.employee_growth_12m >= 0 ? 'text-green' : 'text-red'
                )}>
                  {profile.employee_growth_12m > 0 ? '+' : ''}{profile.employee_growth_12m}%
                </span>
              </div>
            </div>
          )}

          {/* LinkedIn followers */}
          {profile.linkedin_follower_count !== null && (
            <div className="border border-border bg-s1 p-3">
              <p className="font-data text-[10px] text-dim uppercase tracking-wider">LinkedIn Followers</p>
              <p className="mt-1 font-data text-2xl font-bold text-cyan">
                {profile.linkedin_follower_count?.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* LinkedIn Link */}
      {profile.linkedin_url && (
        <div className="border border-border bg-s1 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-cyan/10">
                <Linkedin size={16} className="text-cyan" />
              </div>
              <div>
                <p className="text-[12px] text-text">LinkedIn Company Page</p>
                <p className="font-data text-[10px] text-muted">View full company profile and employees</p>
              </div>
            </div>
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-cyan/10 px-3 py-1.5 font-data text-[10px] text-cyan ring-1 ring-cyan/20 hover:bg-cyan/20 transition-colors"
            >
              OPEN
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* Glassdoor employment data */}
      {(profile.glassdoor_ceo_approval !== null || profile.glassdoor_recommend_pct !== null) && (
        <div className="border border-border bg-s1 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber mb-3">Employee Satisfaction</h4>
          <div className="grid grid-cols-2 gap-3">
            {profile.glassdoor_ceo_approval !== null && (
              <div>
                <p className="font-data text-[10px] text-dim">CEO Approval</p>
                <p className={cn(
                  'font-data text-xl font-bold mt-0.5',
                  profile.glassdoor_ceo_approval >= 70 ? 'text-green' : profile.glassdoor_ceo_approval >= 50 ? 'text-amber' : 'text-red'
                )}>
                  {profile.glassdoor_ceo_approval}%
                </p>
              </div>
            )}
            {profile.glassdoor_recommend_pct !== null && (
              <div>
                <p className="font-data text-[10px] text-dim">Would Recommend</p>
                <p className={cn(
                  'font-data text-xl font-bold mt-0.5',
                  profile.glassdoor_recommend_pct >= 70 ? 'text-green' : profile.glassdoor_recommend_pct >= 50 ? 'text-amber' : 'text-red'
                )}>
                  {profile.glassdoor_recommend_pct}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Companies House directors note */}
      {profile.companies_house_number && (
        <div className="border border-border/50 bg-s2/30 px-3 py-2">
          <p className="font-data text-[10px] text-dim">
            Director and officer data available via{' '}
            <a
              href={`https://find-and-update.company-information.service.gov.uk/company/${profile.companies_house_number}/officers`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber hover:text-text transition-colors"
            >
              Companies House <ExternalLink size={9} className="inline" />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
