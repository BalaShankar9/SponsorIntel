'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, ArrowUpDown, Briefcase, AlertTriangle, Zap, Newspaper, Shield, TrendingUp, FileText, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { timeAgo } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import type { LiveEvent } from '@/types';

const eventIcons: Record<string, React.ReactNode> = {
  sponsor_added: <Plus size={14} />,
  sponsor_removed: <Minus size={14} />,
  rating_change: <ArrowUpDown size={14} />,
  new_job_detected: <Briefcase size={14} />,
  job_expired: <Briefcase size={14} />,
  company_enriched: <Zap size={14} />,
  news_detected: <Newspaper size={14} />,
  risk_flag_raised: <AlertTriangle size={14} />,
  risk_flag_cleared: <Shield size={14} />,
  score_changed: <TrendingUp size={14} />,
  csv_imported: <FileText size={14} />,
  officer_change: <Users size={14} />,
};

const severityColors: Record<string, string> = {
  info: 'bg-accent',
  warning: 'bg-orange',
  critical: 'bg-red',
};

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = () => {
      const wsUrl = API_URL.replace(/^http/, 'ws');
      ws = new WebSocket(`${wsUrl}/api/v1/ws/events`);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LiveEvent;
          setEvents((prev) => [data, ...prev].slice(0, 20));
        } catch {
          // ignore malformed messages
        }
      };
    };

    connect();

    return () => {
      ws?.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <Card padding={false}>
      <div className="flex items-center justify-between p-4 pb-2">
        <CardTitle>Live Feed</CardTitle>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green animate-pulse' : 'bg-red'}`} />
          <span className="text-[10px] text-dim2">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
      <div ref={scrollRef} className="h-[360px] overflow-y-auto px-4 pb-4">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-dim2">
            Waiting for events...
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, idx) => (
              <div key={event.id || idx} className="flex items-start gap-2.5 rounded-md p-2 hover:bg-s2/50">
                <div className="mt-0.5 flex-shrink-0 text-dim">
                  {eventIcons[event.event_type] || <Zap size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${severityColors[event.severity] || 'bg-accent'}`} />
                    <p className="truncate text-sm text-text">{event.title}</p>
                  </div>
                  {event.description && (
                    <p className="mt-0.5 truncate text-xs text-dim">{event.description}</p>
                  )}
                </div>
                <span className="flex-shrink-0 text-[10px] text-dim2">{timeAgo(event.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
