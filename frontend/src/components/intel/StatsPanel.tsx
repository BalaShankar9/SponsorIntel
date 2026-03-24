'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { IntelStatistic } from '@/types/intel';

interface StatsPanelProps {
  visaRoute?: string;
}

export function StatsPanel({ visaRoute }: StatsPanelProps) {
  const [stats, setStats] = useState<IntelStatistic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase.from('intel_statistics').select('*').order('published_at', { ascending: false }).limit(100);
      if (visaRoute) query = query.eq('visa_route', visaRoute);
      const { data } = await query;
      setStats(data || []);
      setLoading(false);
    }
    fetch();
  }, [visaRoute]);

  if (loading) return <div className="h-48 bg-s1 border border-border animate-shimmer rounded" />;

  // Group stats by type
  const grouped = stats.reduce<Record<string, IntelStatistic[]>>((acc, s) => {
    (acc[s.stat_type] = acc[s.stat_type] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, items]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle>{type.replace(/_/g, ' ')}</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 gap-2">
            {items.slice(0, 6).map((stat) => (
              <div key={stat.id} className="bg-s2 rounded p-2 border border-border">
                <p className="text-[9px] font-data text-dim uppercase">{stat.visa_route || 'All'} / {stat.period}</p>
                <p className="text-lg font-data font-bold text-text">{stat.value.toLocaleString()}</p>
                {stat.change_pct !== null && (
                  <p className={`text-[10px] font-data ${stat.change_pct >= 0 ? 'text-green' : 'text-red'}`}>
                    {stat.change_pct >= 0 ? '+' : ''}{stat.change_pct.toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {stats.length === 0 && (
        <div className="text-center text-dim text-sm py-8">No statistics available yet.</div>
      )}
    </div>
  );
}
