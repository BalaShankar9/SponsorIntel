'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface TickerItem {
  id: string;
  text: string;
  type: 'sponsor' | 'job' | 'intel' | 'system';
  timestamp: string;
}

export function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    async function loadTicker() {
      try {
        // Get recent sponsor changes
        const { data: changes } = await supabase
          .from('sponsor_changes')
          .select('organisation_name, change_type, detected_at')
          .order('detected_at', { ascending: false })
          .limit(5);

        // Get recent jobs
        const { data: jobs } = await supabase
          .from('jobs')
          .select('title_raw, company_name_raw, created_at')
          .order('created_at', { ascending: false })
          .limit(5);

        const tickerItems: TickerItem[] = [];

        (changes || []).forEach((c, i) => {
          const icon = c.change_type === 'added' ? '🟢' : c.change_type?.includes('rating') ? '🔄' : '🔴';
          tickerItems.push({
            id: `change-${i}`,
            text: `${icon} ${c.organisation_name} — ${c.change_type?.replace('_', ' ')}`,
            type: 'sponsor',
            timestamp: c.detected_at,
          });
        });

        (jobs || []).forEach((j, i) => {
          tickerItems.push({
            id: `job-${i}`,
            text: `💼 ${j.title_raw} at ${j.company_name_raw}`,
            type: 'job',
            timestamp: j.created_at,
          });
        });

        // Add system status
        tickerItems.push({
          id: 'system-1',
          text: '⚡ 181 AI agents active across 6 divisions',
          type: 'system',
          timestamp: new Date().toISOString(),
        });
        tickerItems.push({
          id: 'system-2',
          text: '📡 AEGIS Supreme Commander — all divisions operational',
          type: 'system',
          timestamp: new Date().toISOString(),
        });

        setItems(tickerItems);
      } catch {
        setItems([
          { id: 'fallback', text: '⚡ SponsorIntel — 140,000+ UK sponsors tracked in real-time', type: 'system', timestamp: '' },
        ]);
      }
    }

    loadTicker();
    const interval = setInterval(loadTicker, 60000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg/90 backdrop-blur-sm border-t border-border overflow-hidden h-7">
      <div className="flex items-center h-full animate-ticker-scroll whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={`${item.id}-${i}`} className="inline-flex items-center gap-2 px-6 text-[10px] font-data">
            <span className="text-dim">{item.text}</span>
            <span className="text-border">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}
