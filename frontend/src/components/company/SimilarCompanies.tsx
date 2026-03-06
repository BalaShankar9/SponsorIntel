'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ScoreBadge, RatingBadge } from '@/components/ui/Badge';
import type { Sponsor } from '@/types';

interface SimilarCompaniesProps {
  sponsors: Sponsor[];
}

export function SimilarCompanies({ sponsors }: SimilarCompaniesProps) {
  if (sponsors.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dim">Similar Companies</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {sponsors.slice(0, 5).map((s) => (
          <Link key={s.id} href={`/company/${s.id}`}>
            <Card className="transition-colors hover:border-accent/50">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-s3">
                  <Building2 size={16} className="text-dim" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{s.organisation_name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <ScoreBadge score={s.overall_score} />
                    <RatingBadge rating={s.rating} />
                  </div>
                  <p className="mt-1 text-xs text-dim">{s.town_city || '--'}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
