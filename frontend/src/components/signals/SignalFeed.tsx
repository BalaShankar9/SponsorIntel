'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  UserPlus,
  UserMinus,
  Briefcase,
  Newspaper,
  AlertTriangle,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { api, API_URL } from '@/lib/api';
import type { LiveEvent } from '@/types';
import Link from 'next/link';

interface SignalFeedProps {
  typeFilter: string;
  severityFilter: string;
}

const eventIcons: Record<string, React.ReactNode> = {
  rating_upgrade: <TrendingUp size={14} className="text-green" />,
  rating_downgrade: <TrendingDown size={14} className="text-red" />,
  new_sponsor: <UserPlus size={14} className="text-cyan" />,
  removed_sponsor: <UserMinus size={14} className="text-red" />,
  job_spike: <Briefcase size={14} className="text-accent" />,
  news: <Newspaper size={14} className="text-purple" />,
  risk_flag: <AlertTriangle size={14} className="text-orange" />,
};

const severityColors: Record<string, string> = {
  critical: 'bg-red',
  warning: 'bg-orange',
  info: 'bg-accent',
};

const severityBadgeVariant: Record<string, 'red' | 'orange' | 'blue'> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

export function SignalFeed({ typeFilter, severityFilter }: SignalFeedProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial fetch
  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await api.get<LiveEvent[]>('/api/v1/signals/recent');
        setEvents(data);
      } catch (err) {
        console.error('Failed to fetch signals:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = API_URL.replace('http', 'ws') + '/ws/signals';
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const newEvent: LiveEvent = JSON.parse(event.data);
          setEvents((prev) => [newEvent, ...prev].slice(0, 200));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        // silently handle WS errors, feed still works from initial fetch
      };

      return () => {
        ws.close();
      };
    } catch {
      // WebSocket not available
    }
  }, []);

  const filtered = events.filter((e) => {
    if (typeFilter && typeFilter !== 'all' && e.event_type !== typeFilter) return false;
    if (severityFilter && severityFilter !== 'all' && e.severity !== severityFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-s1" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-12 text-center">
          <Zap className="mb-3 h-8 w-8 text-dim2" />
          <p className="text-sm text-dim">No signals matching your filters.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((event) => (
        <Card key={event.id} className="transition-colors hover:border-s4">
          <div className="flex items-start gap-3">
            {/* Severity dot */}
            <div className="mt-1.5 flex flex-col items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${severityColors[event.severity] || 'bg-dim2'}`} />
            </div>

            {/* Icon */}
            <div className="mt-0.5">
              {eventIcons[event.event_type] || <Zap size={14} className="text-dim" />}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text">{event.title}</p>
                <Badge variant={severityBadgeVariant[event.severity] || 'blue'}>
                  {event.severity}
                </Badge>
              </div>
              {event.description && (
                <p className="mt-0.5 text-xs text-dim">{event.description}</p>
              )}
              <div className="mt-1 flex items-center gap-3">
                <span className="text-[10px] text-dim2">{timeAgo(event.created_at)}</span>
                {event.sponsor_id && (
                  <Link
                    href={`/company/${event.sponsor_id}`}
                    className="text-[10px] text-accent hover:underline"
                  >
                    {event.sponsor_name || 'View Company'}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
