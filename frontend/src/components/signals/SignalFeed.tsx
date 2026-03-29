'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LiveEvent } from '@/types';

interface SignalFeedProps {
  typeFilter: string;
  severityFilter: string;
}

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: 'text-red', bg: 'bg-red', label: 'CRIT' },
  warning: { color: 'text-amber', bg: 'bg-amber', label: 'WARN' },
  info: { color: 'text-green', bg: 'bg-green', label: 'INFO' },
};

export function SignalFeed({ typeFilter, severityFilter }: SignalFeedProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        // Events table is empty - query it anyway for when data exists
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (!error && data) {
          setEvents(data as LiveEvent[]);
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error('Failed to fetch signals:', err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const filtered = events.filter((e) => {
    if (typeFilter && typeFilter !== 'all' && e.event_type !== typeFilter) return false;
    if (severityFilter && severityFilter !== 'all' && e.severity !== severityFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse border border-s3 bg-s1" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="border border-s3 bg-s1 py-16 text-center">
        <Zap className="mx-auto mb-2 h-6 w-6 text-muted" />
        <p className="font-data text-xs text-dim">NO SIGNALS AVAILABLE.</p>
        <p className="mt-1 font-data text-[10px] text-dim">Signals will appear here when sponsor changes are detected.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-px">
      {filtered.map((event) => {
        const sev = severityConfig[event.severity] || severityConfig.info;
        return (
          <div
            key={event.id}
            className="flex items-start gap-3 border border-s3 bg-s1 px-3 py-2 transition-colors hover:bg-amber/5 cursor-pointer"
          >
            {/* Severity Badge */}
            <span className={`mt-0.5 inline-block px-1.5 py-0.5 font-data text-[9px] font-bold ${sev.bg} text-bg`}>
              {sev.label}
            </span>

            {/* Icon */}
            <span className="mt-0.5">
              <Zap size={12} className="text-dim" />
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-data text-xs text-text">{event.title}</span>
              </div>
              {event.description && (
                <p className="mt-0.5 font-data text-[10px] text-dim">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
