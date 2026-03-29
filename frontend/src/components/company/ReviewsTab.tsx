'use client';

import { Star, ExternalLink, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompanyProfile } from '@/types';

interface ReviewsTabProps {
  profile: CompanyProfile | null;
}

function RatingBar({ rating, maxRating = 5 }: { rating: number; maxRating?: number }) {
  const percentage = (rating / maxRating) * 100;
  const color = rating >= 4 ? '#00d4aa' : rating >= 3 ? '#f5a623' : '#ff4757';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-s3 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-data text-[11px] font-bold" style={{ color }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function ReviewSourceCard({
  name,
  rating,
  reviewCount,
  color,
  children,
}: {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  color: string;
  children?: React.ReactNode;
}) {
  const hasData = rating !== null;

  return (
    <div className={cn(
      'border bg-s1 overflow-hidden transition-colors',
      hasData ? 'border-border' : 'border-border/50 opacity-60'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-s2/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-data text-[11px] font-semibold uppercase tracking-wider text-dim">
            {name}
          </span>
        </div>
        {reviewCount !== null && (
          <span className="flex items-center gap-1 font-data text-[10px] text-muted">
            <MessageSquare size={10} />
            {reviewCount.toLocaleString()}
          </span>
        )}
      </div>

      <div className="p-3">
        {hasData ? (
          <>
            {/* Large rating display */}
            <div className="flex items-end gap-2 mb-3">
              <span
                className="font-data text-4xl font-bold leading-none"
                style={{ color: rating >= 4 ? '#00d4aa' : rating >= 3 ? '#f5a623' : '#ff4757' }}
              >
                {rating.toFixed(1)}
              </span>
              <span className="font-data text-[12px] text-muted mb-1">/5.0</span>
            </div>

            {/* Star visualization */}
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={14}
                  className={cn(
                    i <= Math.round(rating)
                      ? rating >= 4
                        ? 'fill-green text-green'
                        : rating >= 3
                          ? 'fill-amber text-amber'
                          : 'fill-red text-red'
                      : 'text-s3 fill-s3'
                  )}
                />
              ))}
            </div>

            {/* Rating bar */}
            <RatingBar rating={rating} />

            {/* Extra details */}
            {children && (
              <div className="mt-3 border-t border-border/30 pt-3">
                {children}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <Star size={20} className="text-muted mb-2" />
            <p className="font-data text-[10px] text-muted uppercase tracking-wider">No data</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewsTab({ profile }: ReviewsTabProps) {
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-s1">
        <div className="text-center">
          <Star size={24} className="mx-auto text-muted mb-2" />
          <p className="font-data text-[11px] text-dim uppercase tracking-wider">No Review Data</p>
          <p className="mt-1 text-[10px] text-muted">Company has not been enriched yet.</p>
        </div>
      </div>
    );
  }

  const hasAnyReview = profile.glassdoor_rating !== null || profile.trustpilot_rating !== null || profile.google_rating !== null;

  if (!hasAnyReview) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-s1">
        <div className="text-center">
          <Star size={24} className="mx-auto text-muted mb-2" />
          <p className="font-data text-[11px] text-dim uppercase tracking-wider">No Reviews Found</p>
          <p className="mt-1 text-[10px] text-muted">No review data has been collected for this company.</p>
        </div>
      </div>
    );
  }

  // Calculate average across available sources
  const ratings = [profile.glassdoor_rating, profile.trustpilot_rating, profile.google_rating].filter((r): r is number => r !== null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return (
    <div className="space-y-3">
      {/* Average rating summary */}
      {avgRating !== null && ratings.length > 1 && (
        <div className="border border-border bg-s1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-data text-[10px] text-dim uppercase tracking-wider">Average Across Sources</p>
              <p className="font-data text-[10px] text-muted mt-0.5">{ratings.length} review platforms</p>
            </div>
            <div className="flex items-end gap-1">
              <span
                className="font-data text-3xl font-bold"
                style={{ color: avgRating >= 4 ? '#00d4aa' : avgRating >= 3 ? '#f5a623' : '#ff4757' }}
              >
                {avgRating.toFixed(1)}
              </span>
              <span className="font-data text-[11px] text-muted mb-1">/5.0</span>
            </div>
          </div>
        </div>
      )}

      {/* Review source cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ReviewSourceCard
          name="Glassdoor"
          rating={profile.glassdoor_rating}
          reviewCount={profile.glassdoor_review_count}
          color="#0caa41"
        >
          {(profile.glassdoor_ceo_approval !== null || profile.glassdoor_recommend_pct !== null) && (
            <div className="grid grid-cols-2 gap-3">
              {profile.glassdoor_ceo_approval !== null && (
                <div>
                  <p className="font-data text-[9px] text-dim uppercase">CEO Approval</p>
                  <p className={cn(
                    'font-data text-[14px] font-bold mt-0.5',
                    profile.glassdoor_ceo_approval >= 70 ? 'text-green' : profile.glassdoor_ceo_approval >= 50 ? 'text-amber' : 'text-red'
                  )}>
                    {profile.glassdoor_ceo_approval}%
                  </p>
                </div>
              )}
              {profile.glassdoor_recommend_pct !== null && (
                <div>
                  <p className="font-data text-[9px] text-dim uppercase">Recommend</p>
                  <p className={cn(
                    'font-data text-[14px] font-bold mt-0.5',
                    profile.glassdoor_recommend_pct >= 70 ? 'text-green' : profile.glassdoor_recommend_pct >= 50 ? 'text-amber' : 'text-red'
                  )}>
                    {profile.glassdoor_recommend_pct}%
                  </p>
                </div>
              )}
            </div>
          )}
        </ReviewSourceCard>

        <ReviewSourceCard
          name="Trustpilot"
          rating={profile.trustpilot_rating}
          reviewCount={profile.trustpilot_review_count}
          color="#00b67a"
        />

        <ReviewSourceCard
          name="Google"
          rating={profile.google_rating}
          reviewCount={profile.google_review_count}
          color="#4285f4"
        />
      </div>
    </div>
  );
}
