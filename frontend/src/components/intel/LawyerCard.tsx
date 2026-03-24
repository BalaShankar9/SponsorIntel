'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LawyerSummary } from '@/types/intel';

interface LawyerCardProps {
  lawyer: LawyerSummary;
  rank: number;
  onSelect?: (id: string) => void;
}

export function LawyerCard({ lawyer, rank, onSelect }: LawyerCardProps) {
  return (
    <Card interactive className="relative" onClick={() => onSelect?.(lawyer.id)}>
      {/* Rank badge */}
      <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-amber flex items-center justify-center">
        <span className="text-[10px] font-data font-bold text-bg">{rank}</span>
      </div>

      <div className="flex items-start gap-3 pl-4">
        <div className="flex-1 min-w-0">
          {/* Name + firm */}
          <h3 className="text-sm font-medium text-text">{lawyer.name}</h3>
          {lawyer.firm_name && <p className="text-[11px] text-dim">{lawyer.firm_name}</p>}

          {/* Registration */}
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant={lawyer.registration_type === 'oisc' ? 'cyan' : 'purple'} size="sm">
              {lawyer.registration_type.toUpperCase()}
              {lawyer.oisc_level ? ` L${lawyer.oisc_level}` : ''}
            </Badge>
            <span className="text-[9px] font-data text-dim">#{lawyer.registration_number}</span>
          </div>

          {/* Practice areas */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {lawyer.practice_areas.slice(0, 4).map((area) => (
              <span key={area} className="text-[8px] font-data text-dim bg-s3 px-1 py-px rounded border border-border">
                {area}
              </span>
            ))}
          </div>

          {/* AI blurb */}
          <p className="text-xs text-dim mt-2 italic">&ldquo;{lawyer.why_matched}&rdquo;</p>
        </div>

        {/* Right column: score + rating */}
        <div className="text-right shrink-0 space-y-1">
          <div className="bg-amber/10 border border-amber/20 rounded px-2 py-1">
            <p className="text-[8px] font-data text-amber uppercase">Match</p>
            <p className="text-lg font-data font-bold text-amber">{lawyer.match_score}</p>
          </div>

          {lawyer.combined_rating && (
            <div>
              <p className="text-[10px] font-data text-amber">
                {'★'.repeat(Math.round(lawyer.combined_rating))}
              </p>
              <p className="text-[9px] font-data text-dim">
                {(lawyer.google_review_count + lawyer.trustpilot_review_count)} reviews
              </p>
            </div>
          )}

          {lawyer.fee_initial_consultation && (
            <p className="text-[9px] font-data text-dim">{lawyer.fee_initial_consultation}</p>
          )}

          {lawyer.city && (
            <p className="text-[9px] font-data text-dim">{lawyer.city}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
