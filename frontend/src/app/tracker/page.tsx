'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { KanbanBoard } from '@/components/tracker/KanbanBoard';
import { PipelineStats } from '@/components/tracker/PipelineStats';
import { Tabs } from '@/components/ui/Tabs';
import { PageSpinner } from '@/components/ui/Spinner';
import type { WatchlistItem } from '@/types';

const tabs = [
  { id: 'board', label: 'Kanban Board' },
  { id: 'stats', label: 'Pipeline Stats' },
];

export default function TrackerPage() {
  const isPro = useAuthStore((s) => s.isPro);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('board');

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api.get<WatchlistItem[]>('/api/v1/watchlist');
        setItems(data);
      } catch (err) {
        console.error('Failed to fetch watchlist:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
    );
    try {
      await api.put(`/api/v1/watchlist/${id}`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      // Revert on error
      const data = await api.get<WatchlistItem[]>('/api/v1/watchlist');
      setItems(data);
    }
  };

  const content = loading ? (
    <PageSpinner />
  ) : (
    <div className="space-y-4">
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'board' ? (
        <KanbanBoard items={items} onStatusChange={handleStatusChange} />
      ) : (
        <PipelineStats items={items} />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Application Tracker</h1>
        <p className="text-sm text-dim">Track your sponsorship applications pipeline</p>
      </div>

      <ProGate isAllowed={isPro} feature="Application Tracker">
        {content}
      </ProGate>
    </div>
  );
}
