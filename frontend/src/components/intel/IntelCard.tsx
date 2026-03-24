'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ImpactBadge } from './ImpactBadge';
import { cn, formatRelativeDate } from '@/lib/utils';
import type { IntelItem } from '@/types/intel';

const sourceCategoryColors: Record<string, string> = {
  government: 'cyan',
  legal: 'purple',
  news: 'blue',
  community: 'green',
};

const topicLabels: Record<string, string> = {
  rule_change: 'Rule Change',
  policy_update: 'Policy Update',
  court_decision: 'Court Decision',
  statistics: 'Statistics',
  opinion: 'Opinion',
  news: 'News',
  community: 'Community',
};

interface IntelCardProps {
  item: IntelItem;
  className?: string;
  isNew?: boolean;
}

export function IntelCard({ item, className, isNew }: IntelCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      interactive
      className={cn(
        'transition-all duration-300',
        isNew && 'border-cyan/40 shadow-[0_0_12px_-4px_rgba(0,229,255,0.15)]',
        className
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        {/* Header row */}
        <div className="flex items-start gap-2 mb-1.5">
          <ImpactBadge level={item.impact_level} size="sm" />
          {item.topic && (
            <Badge variant="default" size="sm">
              {topicLabels[item.topic] || item.topic}
            </Badge>
          )}
          <Badge
            variant={sourceCategoryColors[item.source_category] as any || 'default'}
            size="sm"
          >
            {item.source_name}
          </Badge>
          <span className="ml-auto text-[9px] font-data text-dim whitespace-nowrap">
            {item.published_at ? formatRelativeDate(item.published_at) : '--'}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-text leading-snug mb-1">
          {item.title}
        </h3>

        {/* Summary snippet */}
        {item.summary && !expanded && (
          <p className="text-xs text-dim line-clamp-2">{item.summary}</p>
        )}

        {/* Visa route tags */}
        {item.visa_routes_affected && item.visa_routes_affected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.visa_routes_affected.map((route) => (
              <span
                key={route}
                className="inline-flex items-center rounded bg-s3 px-1.5 py-px text-[8px] font-data text-dim border border-border"
              >
                {route}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border animate-slideInUp space-y-2">
          {item.summary && (
            <div>
              <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-0.5">Summary</p>
              <p className="text-xs text-text">{item.summary}</p>
            </div>
          )}
          {item.content_snippet && (
            <div>
              <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-0.5">Source Excerpt</p>
              <p className="text-xs text-dim">{item.content_snippet}</p>
            </div>
          )}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-cyan hover:text-cyan/80 font-data"
            >
              View source &rarr;
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
