'use client';

import { useEffect, useState } from 'react';
import { Star, Users } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface Rating {
  rating_overall: number;
  interaction_type: string;
  comment: string | null;
  created_at: string;
}

interface CommunityRatingsProps {
  sponsorId: string;
}

export function CommunityRatings({ sponsorId }: CommunityRatingsProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averages, setAverages] = useState<{ overall: number } | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRatings() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/ratings/${sponsorId}`
        );
        if (res.ok) {
          const data = await res.json();
          setRatings(data.ratings || []);
          setAverages(data.averages);
          setCount(data.count || 0);
        }
      } catch (err) {
        console.error('Community ratings fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRatings();
  }, [sponsorId]);

  if (loading) {
    return (
      <Card className="!p-3 animate-pulse">
        <div className="h-3 bg-s2 rounded w-32 mb-2" />
        <div className="h-5 bg-s2 rounded w-16" />
      </Card>
    );
  }

  if (count === 0) {
    return (
      <Card className="!p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={11} className="text-dim" />
          <CardTitle>Community Ratings</CardTitle>
        </div>
        <p className="text-[10px] text-dim font-data">
          No community ratings yet. Be the first to rate this sponsor.
        </p>
      </Card>
    );
  }

  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users size={11} className="text-amber" />
          <CardTitle>Community Ratings</CardTitle>
        </div>
        <span className="font-data text-[9px] text-dim">{count} reviews</span>
      </div>

      {/* Average score */}
      {averages && (
        <div className="flex items-center gap-2 mb-3">
          <span className="font-data text-xl font-bold text-amber tabular-nums">
            {averages.overall.toFixed(1)}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={12}
                className={cn(
                  s <= Math.round(averages.overall)
                    ? 'fill-amber text-amber'
                    : 'text-s4'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {ratings.slice(0, 5).map((r, i) => (
          <div key={i} className="border-t border-border/30 pt-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-data text-cyan uppercase">
                {r.interaction_type.replace('_', ' ')}
              </span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={8}
                    className={cn(
                      s <= r.rating_overall ? 'fill-amber text-amber' : 'text-s4'
                    )}
                  />
                ))}
              </div>
            </div>
            {r.comment && (
              <p className="text-[10px] text-dim leading-relaxed">
                {r.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
