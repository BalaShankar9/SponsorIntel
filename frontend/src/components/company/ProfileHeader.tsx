'use client';

import { MapPin, Calendar, Star, StickyNote, Building2 } from 'lucide-react';
import { ScoreBadge, RatingBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { SponsorDetail } from '@/types';

interface ProfileHeaderProps {
  sponsor: SponsorDetail;
  onAddToWatchlist: () => void;
  onAddNote: () => void;
}

export function ProfileHeader({ sponsor, onAddToWatchlist, onAddNote }: ProfileHeaderProps) {
  return (
    <div className="rounded-lg border border-border bg-s1 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Left: name + details */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-s3">
              <Building2 size={24} className="text-dim" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">{sponsor.organisation_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-dim">
                {sponsor.town_city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {sponsor.town_city}
                    {sponsor.county && `, ${sponsor.county}`}
                  </span>
                )}
                {sponsor.profile?.industry_primary && (
                  <span>{sponsor.profile.industry_primary}</span>
                )}
                {sponsor.first_seen_date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Sponsor since {formatDate(sponsor.first_seen_date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <ScoreBadge score={sponsor.overall_score} />
            <RatingBadge rating={sponsor.rating} />
            {sponsor.route && sponsor.route.length > 0 && (
              <span className="rounded bg-s3 px-2 py-0.5 text-xs text-dim">
                {sponsor.route.join(', ')}
              </span>
            )}
            {sponsor.consecutive_a_rating_days > 0 && (
              <span className="text-xs text-green">
                {sponsor.consecutive_a_rating_days} consecutive A-rated days
              </span>
            )}
            {sponsor.times_rating_changed > 0 && (
              <span className="text-xs text-orange">
                {sponsor.times_rating_changed} rating change(s)
              </span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={onAddToWatchlist}>
            <Star size={14} />
            Watchlist
          </Button>
          <Button variant="secondary" size="sm" onClick={onAddNote}>
            <StickyNote size={14} />
            Note
          </Button>
        </div>
      </div>
    </div>
  );
}
