'use client';

import Link from 'next/link';
import { cn, getScoreColor, getScoreBg } from '@/lib/utils';
import type { Sponsor } from '@/types';

interface SimilarSponsor extends Sponsor {
  overall_score?: number | null;
}

interface SimilarCompaniesProps {
  sponsors: SimilarSponsor[];
}

export function SimilarCompanies({ sponsors }: SimilarCompaniesProps) {
  if (sponsors.length === 0) return null;

  return (
    <div className="border border-border bg-s1 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-s2/50 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber">Similar Companies</h3>
        <span className="font-data text-[9px] text-muted">{sponsors.length} found</span>
      </div>

      <div className="divide-y divide-border/20">
        {sponsors.slice(0, 5).map((s) => (
          <Link
            key={s.id}
            href={`/company/${s.id}`}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-s2/50 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-text group-hover:text-amber transition-colors">
                {s.organisation_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {s.town_city && (
                  <span className="font-data text-[10px] text-muted">{s.town_city}</span>
                )}
                {s.sponsor_type && (
                  <span className="font-data text-[9px] text-muted">{s.sponsor_type}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {/* Score */}
              {s.overall_score !== null && s.overall_score !== undefined && (
                <span className={cn(
                  'font-data text-[11px] font-bold rounded px-1.5 py-0.5',
                  getScoreBg(s.overall_score),
                  getScoreColor(s.overall_score)
                )}>
                  {s.overall_score}
                </span>
              )}

              {/* Rating badge */}
              {s.rating && (
                <span className={cn(
                  'font-data text-[10px] font-bold rounded px-1.5 py-0.5',
                  s.rating === 'A' ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                )}>
                  {s.rating}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
