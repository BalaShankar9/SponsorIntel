'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { IntelCard } from './IntelCard';
import type { IntelItem, IntelFeedFilters } from '@/types/intel';

interface IntelFeedProps {
  filters: IntelFeedFilters;
}

export function IntelFeed({ filters }: IntelFeedProps) {
  const [items, setItems] = useState<IntelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('intel_items')
        .select('*', { count: 'exact' })
        .in('status', ['classified', 'analyzed'])
        .order('published_at', { ascending: false });

      if (filters.topic) query = query.eq('topic', filters.topic);
      if (filters.impact) query = query.eq('impact_level', filters.impact);
      if (filters.visa_route) query = query.contains('visa_routes_affected', [filters.visa_route]);
      if (filters.date_from) query = query.gte('published_at', filters.date_from);
      if (filters.date_to) query = query.lte('published_at', filters.date_to);

      const page = filters.page || 1;
      const perPage = filters.per_page || 20;
      const from = (page - 1) * perPage;
      query = query.range(from, from + perPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setItems(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Failed to fetch intel items:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial fetch + refetch on filter change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Supabase Realtime subscription for new analyzed items
  useEffect(() => {
    const channel = supabase
      .channel('intel-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'intel_items',
          filter: 'status=eq.analyzed',
        },
        (payload) => {
          const newItem = payload.new as IntelItem;
          // Prepend to feed if it matches current filters
          setItems((prev) => {
            if (prev.some((i) => i.id === newItem.id)) return prev;
            return [newItem, ...prev];
          });
          setNewIds((prev) => new Set(prev).add(newItem.id));
          // Remove "new" highlight after 5 seconds
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              next.delete(newItem.id);
              return next;
            });
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-s1 border border-border animate-shimmer rounded" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-dim text-sm">
        No intel items found matching your filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <IntelCard key={item.id} item={item} isNew={newIds.has(item.id)} />
      ))}

      {/* Pagination info */}
      <div className="flex items-center justify-between pt-2 text-[10px] font-data text-dim">
        <span>{total} items total</span>
        <span>Page {filters.page || 1} of {Math.ceil(total / (filters.per_page || 20))}</span>
      </div>
    </div>
  );
}
