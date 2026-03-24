'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { IntelFeed } from '@/components/intel/IntelFeed';
import { IntelFilters } from '@/components/intel/IntelFilters';
import type { IntelFeedFilters } from '@/types/intel';
import { Newspaper, Clock, Calendar, BarChart3, FileText, Scale } from 'lucide-react';
import Link from 'next/link';

const subPages = [
  { href: '/intel/timeline', label: 'Timeline', icon: Clock, desc: 'Rule change history' },
  { href: '/intel/calendar', label: 'Calendar', icon: Calendar, desc: 'Key dates' },
  { href: '/intel/stats', label: 'Statistics', icon: BarChart3, desc: 'Visa data' },
  { href: '/intel/policies', label: 'Policies', icon: FileText, desc: 'Track policies' },
  { href: '/intel/lawyers', label: 'Lawyers', icon: Scale, desc: 'Find a lawyer' },
];

export default function IntelPage() {
  const [filters, setFilters] = useState<IntelFeedFilters>({ page: 1, per_page: 20 });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-cyan" />
          <h1 className="text-sm font-semibold text-text">Immigration Intelligence</h1>
          <span className="flex items-center gap-1 ml-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
            <span className="font-data text-[8px] text-cyan uppercase tracking-wider">LIVE</span>
          </span>
        </div>
      </div>

      {/* Sub-page nav cards */}
      <div className="grid grid-cols-5 gap-2">
        {subPages.map((p) => (
          <Link key={p.href} href={p.href}>
            <Card interactive className="flex items-center gap-2 p-2">
              <p.icon size={13} className="text-dim shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-text">{p.label}</p>
                <p className="text-[9px] text-dim">{p.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main content: filters + feed */}
      <div className="flex gap-4">
        {/* Sidebar filters */}
        <div className="w-48 shrink-0">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <IntelFilters filters={filters} onChange={setFilters} />
          </Card>
        </div>

        {/* Feed */}
        <div className="flex-1 min-w-0">
          <IntelFeed filters={filters} />
        </div>
      </div>
    </div>
  );
}
