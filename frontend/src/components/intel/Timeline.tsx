'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { ImpactBadge } from './ImpactBadge';
import { formatDate } from '@/lib/utils';
import type { IntelTimelineNode } from '@/types/intel';

interface TimelineProps {
  visaRoute?: string;
}

export function Timeline({ visaRoute }: TimelineProps) {
  const [nodes, setNodes] = useState<IntelTimelineNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase
        .from('intel_items')
        .select('id, title, published_at, impact_level, visa_routes_affected, summary, before_after')
        .eq('topic', 'rule_change')
        .in('status', ['classified', 'analyzed'])
        .order('published_at', { ascending: false })
        .limit(50);

      if (visaRoute) {
        query = query.contains('visa_routes_affected', [visaRoute]);
      }

      const { data } = await query;
      setNodes(data || []);
      setLoading(false);
    }
    fetch();
  }, [visaRoute]);

  if (loading) return <div className="h-48 bg-s1 border border-border animate-shimmer rounded" />;

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4 pl-10">
        {nodes.map((node) => (
          <div key={node.id} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-10 top-2 h-2.5 w-2.5 rounded-full border-2 border-bg ${
              node.impact_level === 'critical' ? 'bg-red' :
              node.impact_level === 'high' ? 'bg-amber' :
              node.impact_level === 'medium' ? 'bg-blue' : 'bg-dim'
            }`} />

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <ImpactBadge level={node.impact_level} size="sm" />
                <span className="text-[10px] font-data text-dim">
                  {node.published_at ? formatDate(node.published_at) : 'Date unknown'}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text mb-1">{node.title}</h3>
              {node.summary && <p className="text-xs text-dim mb-2">{node.summary}</p>}

              {node.before_after && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded bg-red/5 border border-red/10 p-2">
                    <p className="text-[9px] font-data uppercase text-red mb-0.5">Before</p>
                    <p className="text-[11px] text-dim">{node.before_after.before}</p>
                  </div>
                  <div className="rounded bg-green/5 border border-green/10 p-2">
                    <p className="text-[9px] font-data uppercase text-green mb-0.5">After</p>
                    <p className="text-[11px] text-dim">{node.before_after.after}</p>
                  </div>
                </div>
              )}

              {node.visa_routes_affected && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {node.visa_routes_affected.map((r) => (
                    <span key={r} className="text-[8px] font-data text-dim bg-s3 px-1.5 py-px rounded border border-border">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
