'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { AlertList } from '@/components/alerts/AlertList';
import { AlertBuilder, type CreateAlertPayload } from '@/components/alerts/AlertBuilder';
import { Plus } from 'lucide-react';
import type { Alert, AlertHistory } from '@/types';

export default function AlertsPage() {
  const isPro = true; // All features available
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    fetchAlerts();
    fetchHistory();
  }, []);

  async function fetchAlerts() {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setAlerts(data || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    try {
      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(50);
      if (!error && data) setHistory(data);
    } catch {
      // table may not exist or be empty
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: active } : a)));
    try {
      await supabase.from('alerts').update({ is_active: active }).eq('id', id);
    } catch {
      fetchAlerts();
    }
  };

  const handleEdit = (alert: Alert) => {
    setEditingAlert(alert);
    setShowBuilder(true);
  };

  const handleDelete = async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await supabase.from('alerts').delete().eq('id', id);
    } catch {
      fetchAlerts();
    }
  };

  const handleSave = async (payload: CreateAlertPayload) => {
    try {
      if (editingAlert) {
        await supabase.from('alerts').update(payload).eq('id', editingAlert.id);
      } else {
        await supabase.from('alerts').insert(payload);
      }
      setShowBuilder(false);
      setEditingAlert(null);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to save alert:', err);
    }
  };

  const content = loading ? (
    <div className="border border-s3 bg-s1 py-16 text-center">
      <p className="font-data text-sm text-amber animate-pulse">LOADING ALERTS...</p>
    </div>
  ) : (
    <div className="space-y-3">
      {showBuilder ? (
        <AlertBuilder
          existingAlert={editingAlert}
          onSave={handleSave}
          onCancel={() => {
            setShowBuilder(false);
            setEditingAlert(null);
          }}
        />
      ) : (
        <>
          {/* Tab + New Alert */}
          <div className="flex items-center justify-between border-b border-s3">
            <div className="flex gap-px">
              <button
                onClick={() => setActiveTab('active')}
                className={`font-data px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                  activeTab === 'active'
                    ? 'border-b-2 border-amber bg-s1 text-amber'
                    : 'text-dim hover:text-text'
                }`}
              >
                ACTIVE ALERTS ({alerts.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`font-data px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                  activeTab === 'history'
                    ? 'border-b-2 border-amber bg-s1 text-amber'
                    : 'text-dim hover:text-text'
                }`}
              >
                HISTORY
              </button>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-1 bg-amber px-3 py-1.5 font-data text-[10px] font-bold uppercase text-bg transition-colors hover:bg-amber/80"
            >
              <Plus size={10} /> NEW ALERT
            </button>
          </div>

          {activeTab === 'active' ? (
            <AlertList
              alerts={alerts}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <div className="border border-s3 bg-s1">
              {history.length === 0 ? (
                <div className="py-12 text-center font-data text-xs text-dim">
                  NO ALERT HISTORY AVAILABLE.
                </div>
              ) : (
                <div className="space-y-px">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 border-b border-s3/50 px-3 py-2">
                      <span className={`mt-0.5 inline-block h-2 w-2 ${h.read ? 'bg-muted' : 'bg-amber'}`} />
                      <div className="flex-1">
                        <p className="font-data text-xs text-text">
                          Alert triggered
                        </p>
                        {h.payload && (
                          <p className="mt-0.5 font-data text-[10px] text-dim">
                            {JSON.stringify(h.payload).substring(0, 100)}
                          </p>
                        )}
                      </div>
                      <span className="font-data text-[9px] text-muted">
                        {new Date(h.triggered_at).toLocaleString('en-GB')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="border-b border-amber/30 pb-2">
        <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
          ALERTS
        </h1>
        <p className="font-data text-xs text-dim">
          NOTIFICATION CONFIGURATION // MARKET EVENT TRIGGERS
        </p>
      </div>

      <ProGate isAllowed={isPro} feature="Alerts">
        {content}
      </ProGate>
    </div>
  );
}
