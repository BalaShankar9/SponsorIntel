'use client';

import { ExternalLink, MapPin, Shield, Activity, Calendar, Clock } from 'lucide-react';
import { cn, formatDate, getScoreColor, getScoreBg } from '@/lib/utils';
import type { SponsorDetail } from '@/types';

interface ProfileHeaderProps {
  sponsor: SponsorDetail;
}

export function ProfileHeader({ sponsor }: ProfileHeaderProps) {
  const profile = sponsor.profile;
  const scores = sponsor.scores;
  const overallScore = scores?.overall_score ?? null;

  const chNumber = profile?.companies_house_number;
  const chUrl = chNumber
    ? `https://find-and-update.company-information.service.gov.uk/company/${chNumber}`
    : null;

  return (
    <div className="relative overflow-hidden border border-border bg-s1">
      {/* Top gradient accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-amber via-cyan to-amber" />

      <div className="px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Company info */}
          <div className="min-w-0 flex-1">
            {/* Name + Active indicator */}
            <div className="flex items-center gap-3">
              <h1 className="truncate text-2xl font-bold tracking-tight text-text">
                {sponsor.organisation_name}
              </h1>
              {sponsor.is_active !== undefined && (
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-data text-[10px] font-bold uppercase tracking-wider',
                  sponsor.is_active
                    ? 'bg-green/10 text-green ring-1 ring-green/20'
                    : 'bg-red/10 text-red ring-1 ring-red/20'
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    sponsor.is_active ? 'bg-green animate-pulse' : 'bg-red'
                  )} />
                  {sponsor.is_active ? 'ACTIVE' : 'REVOKED'}
                </span>
              )}
            </div>

            {/* Badges row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {/* Rating badge */}
              {sponsor.rating && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-0.5 font-data text-[11px] font-bold',
                  sponsor.rating === 'A'
                    ? 'bg-green/15 text-green ring-1 ring-green/20'
                    : 'bg-red/15 text-red ring-1 ring-red/20'
                )}>
                  <Shield size={11} />
                  {sponsor.rating}-RATED
                </span>
              )}

              {/* Sponsor type */}
              {sponsor.sponsor_type && (
                <span className="inline-flex items-center rounded bg-s2 px-2 py-0.5 font-data text-[10px] text-dim ring-1 ring-border">
                  {sponsor.sponsor_type}
                </span>
              )}

              {/* Routes */}
              {sponsor.route && sponsor.route.length > 0 && sponsor.route.map((r) => (
                <span key={r} className="inline-flex items-center rounded bg-cyan/10 px-2 py-0.5 font-data text-[10px] text-cyan ring-1 ring-cyan/15">
                  {r}
                </span>
              ))}

              {/* Industry */}
              {profile?.industry_primary && (
                <span className="inline-flex items-center rounded bg-purple/10 px-2 py-0.5 font-data text-[10px] text-purple ring-1 ring-purple/15">
                  {profile.industry_primary}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-data text-[11px] text-dim">
              {/* Location */}
              {sponsor.town_city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} className="text-muted" />
                  {sponsor.town_city}{sponsor.county ? `, ${sponsor.county}` : ''}
                </span>
              )}

              {/* CH Number */}
              {chNumber && (
                <span className="inline-flex items-center gap-1">
                  <Activity size={11} className="text-muted" />
                  CH:
                  {chUrl ? (
                    <a
                      href={chUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber hover:text-text transition-colors inline-flex items-center gap-0.5"
                    >
                      {chNumber}
                      <ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="text-text">{chNumber}</span>
                  )}
                </span>
              )}

              {/* First seen */}
              {sponsor.first_seen_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} className="text-muted" />
                  Since {formatDate(sponsor.first_seen_date)}
                </span>
              )}

              {/* Last seen */}
              {sponsor.last_seen_date && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} className="text-muted" />
                  Last seen {formatDate(sponsor.last_seen_date)}
                </span>
              )}

              {/* Website */}
              {profile?.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-amber hover:text-text transition-colors"
                >
                  {profile.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>

          {/* Right: Overall score */}
          {overallScore !== null && (
            <div className="flex flex-shrink-0 flex-col items-center lg:items-end">
              <span className="font-data text-[10px] uppercase tracking-widest text-dim">
                Overall Score
              </span>
              <div className={cn(
                'mt-1 flex h-16 w-16 items-center justify-center rounded-lg font-data text-3xl font-bold',
                getScoreBg(overallScore),
                getScoreColor(overallScore),
                'ring-1',
                overallScore >= 80 ? 'ring-green/20' : overallScore >= 60 ? 'ring-amber/20' : 'ring-red/20'
              )}>
                {overallScore}
              </div>
              <span className="mt-1 font-data text-[9px] text-muted">/ 100</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom gradient accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
