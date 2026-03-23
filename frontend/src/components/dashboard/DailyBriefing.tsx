'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, ArrowRight, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface BriefingItem {
  type: string;
  text: string;
  link: string;
  color: string;
}

interface BriefingData {
  date: string;
  items: BriefingItem[];
  profile_setup: boolean;
}

const COLOR_MAP: Record<string, string> = {
  green: 'text-green',
  cyan: 'text-cyan',
  amber: 'text-amber',
  dim: 'text-dim',
};

const DOT_COLOR_MAP: Record<string, string> = {
  green: 'bg-green',
  cyan: 'bg-cyan',
  amber: 'bg-amber',
  dim: 'bg-dim',
};

export function DailyBriefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    async function fetchBriefing() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/dashboard/briefing`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Briefing fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBriefing();
  }, [token, isAuthenticated]);

  if (loading) {
    return (
      <Card className="!p-0">
        <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
          <Newspaper size={11} className="text-amber" />
          <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">
            [DAILY BRIEFING]
          </span>
        </div>
        <div className="px-4 py-4 animate-pulse">
          <div className="h-3 bg-s2 rounded w-3/4 mb-2" />
          <div className="h-3 bg-s2 rounded w-1/2" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="!p-0 border-amber/10">
      <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
        <Sparkles size={11} className="text-amber" />
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-dim">
          [DAILY BRIEFING]
        </span>
        <span className="flex-1 border-t border-border/50" />
        <span className="font-data text-[9px] text-dim">{data.date?.toUpperCase()}</span>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-4">
        {data.items.map((item, i) => (
          <Link
            key={i}
            href={item.link}
            className={cn(
              'group flex items-center gap-2 text-xs font-data transition-colors hover:text-text',
              COLOR_MAP[item.color] || 'text-dim'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLOR_MAP[item.color] || 'bg-dim')} />
            {item.text}
            <ArrowRight
              size={10}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        ))}
      </div>
    </Card>
  );
}
