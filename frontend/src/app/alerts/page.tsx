'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { AlertList } from '@/components/alerts/AlertList';
import { AlertBuilder, type CreateAlertPayload } from '@/components/alerts/AlertBuilder';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { Plus } from 'lucide-react';
import type { Alert } from '@/types';

export default function AlertsPage() {
  const isPro = useAuthStore((s) => s.isPro);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const data = await api.get<Alert[]>('/api/v1/alerts');
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: active } : a)));
    try {
      await api.put(`/api/v1/alerts/${id}`, { is_active: active });
    } catch (err) {
      console.error('Failed to toggle alert:', err);
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
      await api.delete(`/api/v1/alerts/${id}`);
    } catch (err) {
      console.error('Failed to delete alert:', err);
      fetchAlerts();
    }
  };

  const handleSave = async (payload: CreateAlertPayload) => {
    try {
      if (editingAlert) {
        await api.put(`/api/v1/alerts/${editingAlert.id}`, payload);
      } else {
        await api.post('/api/v1/alerts', payload);
      }
      setShowBuilder(false);
      setEditingAlert(null);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to save alert:', err);
    }
  };

  const content = loading ? (
    <PageSpinner />
  ) : (
    <div className="space-y-4">
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
          <div className="flex justify-end">
            <Button onClick={() => setShowBuilder(true)}>
              <Plus size={14} /> New Alert
            </Button>
          </div>
          <AlertList
            alerts={alerts}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Alerts</h1>
        <p className="text-sm text-dim">Configure notifications for market events</p>
      </div>

      <ProGate isAllowed={isPro} feature="Alerts">
        {content}
      </ProGate>
    </div>
  );
}
