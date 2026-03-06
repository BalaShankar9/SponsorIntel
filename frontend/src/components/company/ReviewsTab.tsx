'use client';

import { Star } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { CompanyProfile } from '@/types';

interface ReviewsTabProps {
  profile: CompanyProfile | null;
}

function StarRating({ rating, max = 5 }: { rating: number | null; max?: number }) {
  if (rating === null) return <span className="text-sm text-dim">Not rated</span>;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={cn(
            i < Math.round(rating) ? 'fill-yellow text-yellow' : 'text-s4'
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-text">{rating.toFixed(1)}</span>
    </div>
  );
}

function ReviewSource({
  name,
  rating,
  reviewCount,
  extras,
}: {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  extras?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <StarRating rating={rating} />
          <span className="text-sm text-dim">
            {reviewCount ? `${reviewCount.toLocaleString()} reviews` : 'No reviews'}
          </span>
        </div>
        {extras}
      </div>
    </Card>
  );
}

export function ReviewsTab({ profile }: ReviewsTabProps) {
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-dim">
        No review data available. Company has not been enriched yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <ReviewSource
        name="Glassdoor"
        rating={profile.glassdoor_rating}
        reviewCount={profile.glassdoor_review_count}
        extras={
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-dim">CEO Approval</p>
              <p className="text-text">
                {profile.glassdoor_ceo_approval != null
                  ? `${(profile.glassdoor_ceo_approval * 100).toFixed(0)}%`
                  : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs text-dim">Recommend</p>
              <p className="text-text">
                {profile.glassdoor_recommend_pct != null
                  ? `${(profile.glassdoor_recommend_pct * 100).toFixed(0)}%`
                  : '--'}
              </p>
            </div>
          </div>
        }
      />
      <ReviewSource
        name="Trustpilot"
        rating={profile.trustpilot_rating}
        reviewCount={profile.trustpilot_review_count}
      />
      <ReviewSource
        name="Google"
        rating={profile.google_rating}
        reviewCount={profile.google_review_count}
      />
    </div>
  );
}
