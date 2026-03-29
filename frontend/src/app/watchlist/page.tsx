'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface WatchlistItem {
  id: string;
  sponsor_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  sponsors?: { organisation_name: string; rating: string; town_city: string; routes: string[] };
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('watchlist_items')
          .select('*, sponsors(organisation_name, rating, town_city, routes)')
          .order('created_at', { ascending: false })
          .limit(50);
        setItems(data || []);
      } catch {
        // Table may not exist yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusColor = (s: string) =>
    s === 'interested' ? 'text-cyan' : s === 'applied' ? 'text-amber' : s === 'interviewing' ? 'text-purple' : s === 'offered' ? 'text-green' : 'text-dim';

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold">Watchlist</h1>
          <p className="text-[10px] font-data text-dim">Companies you're tracking for visa sponsorship</p>
        </div>
        <Link href="/search" className="text-[10px] bg-amber text-bg px-3 py-1.5 rounded font-semibold hover:bg-amber/90">
          + Add Companies
        </Link>
      </div>

      {loading ? (
        <div className="text-xs text-dim">Loading watchlist...</div>
      ) : items.length === 0 ? (
        <Card padding>
          <div className="text-center py-8">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="text-sm font-semibold mb-1">Your watchlist is empty</h3>
            <p className="text-xs text-dim mb-4">Start by searching for sponsors and adding them to your watchlist</p>
            <Link href="/search" className="text-xs bg-amber text-bg px-4 py-2 rounded font-semibold hover:bg-amber/90">
              Search Sponsors
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} interactive padding>
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/company/${item.sponsor_id}`} className="text-sm font-semibold hover:text-amber">
                    {item.sponsors?.organisation_name || 'Unknown Company'}
                  </Link>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-data text-dim">{item.sponsors?.town_city}</span>
                    {item.sponsors?.rating && (
                      <span className={`text-[10px] font-data font-bold ${item.sponsors.rating === 'A' ? 'text-green' : 'text-red'}`}>
                        {item.sponsors.rating}-rated
                      </span>
                    )}
                    <span className={`text-[10px] font-data ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <Link href="/tracker" className="text-[10px] text-dim hover:text-text">
                  View in Tracker →
                </Link>
              </div>
              {item.notes && (
                <p className="text-[10px] text-dim mt-2 border-t border-border pt-2">{item.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link href="/tracker" className="text-xs text-cyan hover:underline">
          Switch to Kanban Tracker View →
        </Link>
      </div>
    </div>
  );
}
