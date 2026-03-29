'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface FeedItem {
  id: string;
  name: string;
  city: string | null;
  rating: string | null;
  created_at: string;
}

export function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const { data } = await supabase
          .from('sponsors')
          .select('id, organisation_name, town_city, rating, created_at')
          .order('created_at', { ascending: false })
          .limit(20);

        if (data) {
          setItems(
            data.map((s) => ({
              id: s.id,
              name: s.organisation_name,
              city: s.town_city,
              rating: s.rating,
              created_at: s.created_at,
            }))
          );
        }
      } catch (err) {
        console.error('LiveFeed fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [items]);

  return (
    <div className="border border-border bg-s1 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[10px] font-data uppercase tracking-[0.2em] text-dim">[LIVE FEED]</h3>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
          <span className="font-data text-[9px] text-green uppercase tracking-wider">
            Connected
          </span>
        </div>
      </div>

      {/* Scrolling feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ maxHeight: '380px' }}>
        {loading ? (
          <div className="flex h-full items-center justify-center py-12">
            <span className="font-data text-[11px] text-dim animate-pulse">LOADING FEED...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <span className="font-data text-[11px] text-dim">NO RECENT ACTIVITY</span>
          </div>
        ) : (
          <div>
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="group flex items-start gap-2 px-3 py-2 border-b border-border/30 hover:bg-s2/60 transition-colors"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Index + rating dot */}
                <div className="flex flex-col items-center gap-0.5 pt-0.5 flex-shrink-0 w-4">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      item.rating === 'A' ? 'bg-green' : item.rating === 'B' ? 'bg-red' : 'bg-dim'
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-data text-[9px] font-bold px-1 ${
                      item.rating === 'A' ? 'text-green bg-green/10' : item.rating === 'B' ? 'text-red bg-red/10' : 'text-dim bg-s3'
                    }`}>
                      {item.rating || '?'}
                    </span>
                    <Link
                      href={`/company/${item.id}`}
                      className="truncate text-[11px] text-text hover:text-amber transition-colors font-data"
                    >
                      {item.name}
                    </Link>
                  </div>
                  {item.city && (
                    <p className="truncate text-[9px] text-dim font-data mt-0.5">{item.city}</p>
                  )}
                </div>

                {/* Timestamp */}
                <span className="flex-shrink-0 font-data text-[9px] text-dim pt-0.5">
                  {timeAgo(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-1.5 flex items-center justify-between">
        <span className="font-data text-[9px] text-dim">
          SHOWING {items.length} MOST RECENT
        </span>
        <span className="font-data text-[9px] text-dim">
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
