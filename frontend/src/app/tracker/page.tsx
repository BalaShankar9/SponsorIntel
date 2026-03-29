'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { KanbanBoard } from '@/components/tracker/KanbanBoard';
import { PipelineStats } from '@/components/tracker/PipelineStats';
import type { WatchlistItem } from '@/types';

export default function TrackerPage() {
  const isPro = true; // All features available
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'stats'>('board');

  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('watchlist_items')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error) setItems(data || []);
      } catch (err) {
        console.error('Failed to fetch watchlist:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
    );
    try {
      await supabase.from('watchlist_items').update({ status: newStatus }).eq('id', id);
    } catch (err) {
      console.error('Failed to update status:', err);
      // Refetch on error
      const { data } = await supabase.from('watchlist_items').select('*').order('created_at', { ascending: false });
      if (data) setItems(data);
    }
  };

  const handleNoteUpdate = async (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, notes } : i))
    );
    try {
      await supabase.from('watchlist_items').update({ notes }).eq('id', id);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  const content = loading ? (
    <div className="border border-s3 bg-s1 py-16 text-center">
      <p className="font-data text-sm text-amber animate-pulse">LOADING PIPELINE DATA...</p>
    </div>
  ) : (
    <div className="space-y-3">
      {/* Tab Switcher */}
      <div className="flex gap-px border-b border-s3">
        <button
          onClick={() => setActiveTab('board')}
          className={`font-data px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'board'
              ? 'border-b-2 border-amber bg-s1 text-amber'
              : 'text-dim hover:text-text'
          }`}
        >
          KANBAN BOARD
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`font-data px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'stats'
              ? 'border-b-2 border-amber bg-s1 text-amber'
              : 'text-dim hover:text-text'
          }`}
        >
          PIPELINE STATS
        </button>
      </div>

      {activeTab === 'board' ? (
        <KanbanBoard items={items} onStatusChange={handleStatusChange} onNoteUpdate={handleNoteUpdate} />
      ) : (
        <PipelineStats items={items} />
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="border-b border-amber/30 pb-2">
        <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
          APPLICATION TRACKER
        </h1>
        <p className="font-data text-xs text-dim">
          SPONSORSHIP APPLICATIONS // PIPELINE MANAGEMENT // KANBAN
        </p>
      </div>

      <ProGate isAllowed={isPro} feature="Application Tracker">
        {content}
      </ProGate>
    </div>
  );
}
