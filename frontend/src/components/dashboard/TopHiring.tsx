'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface TopSponsor {
  id: string;
  name: string;
  city: string | null;
  rating: string | null;
  overall_score: number;
}

export function TopHiring() {
  const [sponsors, setSponsors] = useState<TopSponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopSponsors() {
      try {
        const { data } = await supabase
          .from('sponsor_scores')
          .select('sponsor_id, overall_score')
          .not('overall_score', 'is', null)
          .order('overall_score', { ascending: false })
          .limit(10);

        if (data && data.length > 0) {
          const sponsorIds = data.map((d) => d.sponsor_id);
          const { data: sponsorData } = await supabase
            .from('sponsors')
            .select('id, organisation_name, town_city, rating')
            .in('id', sponsorIds);

          if (sponsorData) {
            const sponsorMap = new Map(sponsorData.map((s) => [s.id, s]));
            const merged: TopSponsor[] = data
              .map((score) => {
                const s = sponsorMap.get(score.sponsor_id);
                if (!s) return null;
                return {
                  id: s.id,
                  name: s.organisation_name,
                  city: s.town_city,
                  rating: s.rating,
                  overall_score: score.overall_score,
                };
              })
              .filter(Boolean) as TopSponsor[];
            setSponsors(merged);
          }
        }
      } catch (err) {
        console.error('TopHiring fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTopSponsors();
  }, []);

  const maxScore = sponsors.length > 0 ? Math.max(...sponsors.map((s) => s.overall_score)) : 100;

  function scoreColor(score: number): string {
    if (score >= 80) return '#00d4aa';
    if (score >= 60) return '#f5a623';
    return '#ff4757';
  }

  return (
    <div className="border border-border bg-s1 flex flex-col">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[TOP SCORED SPONSORS]</h3>
        <span className="font-data text-[10px] text-dim">BY OVERALL SCORE</span>
      </div>

      {loading ? (
        <div className="space-y-0 flex-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse border-b border-border/30 bg-s1" />
          ))}
        </div>
      ) : sponsors.length === 0 ? (
        <div className="py-12 text-center font-data text-xs text-dim flex-1 flex items-center justify-center">
          NO SCORE DATA AVAILABLE
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[28px_1fr_70px_50px] items-center border-b border-border px-3 py-1.5 text-[9px] font-data uppercase tracking-wider text-dim">
            <span>#</span>
            <span>Sponsor</span>
            <span className="text-right">Score</span>
            <span className="text-right">Rating</span>
          </div>

          {sponsors.map((sponsor, idx) => {
            const barWidth = (sponsor.overall_score / maxScore) * 100;
            const color = scoreColor(sponsor.overall_score);
            return (
              <div
                key={sponsor.id}
                className="group grid grid-cols-[28px_1fr_70px_50px] items-center border-b border-border/20 px-3 py-1.5 hover:bg-s2/50 transition-colors relative"
              >
                {/* Rank */}
                <span className="font-data text-[11px] text-dim">{idx + 1}</span>

                {/* Name + City */}
                <div className="min-w-0 pr-2">
                  <Link
                    href={`/company/${sponsor.id}`}
                    className="block truncate text-[11px] text-amber hover:text-text transition-colors font-data"
                  >
                    {sponsor.name}
                  </Link>
                  <span className="block truncate text-[9px] text-dim">{sponsor.city || '--'}</span>
                </div>

                {/* Score bar + value */}
                <div className="flex items-center gap-1.5 justify-end">
                  <div className="w-[40px] h-[6px] bg-s3 overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="font-data text-[11px] font-bold w-[24px] text-right" style={{ color }}>
                    {sponsor.overall_score}
                  </span>
                </div>

                {/* Rating badge */}
                <div className="flex justify-end">
                  <span
                    className={`font-data text-[10px] font-bold px-1.5 py-0.5 ${
                      sponsor.rating === 'A'
                        ? 'text-green bg-green/10 border border-green/20'
                        : sponsor.rating === 'B'
                          ? 'text-red bg-red/10 border border-red/20'
                          : 'text-dim bg-s3 border border-border'
                    }`}
                  >
                    {sponsor.rating || '--'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
