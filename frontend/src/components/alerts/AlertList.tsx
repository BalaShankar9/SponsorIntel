'use client';

import { Bell, BellOff, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Alert } from '@/types';

interface AlertListProps {
  alerts: Alert[];
  onToggle: (id: string, active: boolean) => void;
  onEdit: (alert: Alert) => void;
  onDelete: (id: string) => void;
}

const alertTypeLabels: Record<string, string> = {
  new_sponsor: 'NEW SPONSOR',
  rating_change: 'RATING CHANGE',
  new_job: 'NEW JOB',
  company_news: 'NEWS',
  risk_flag: 'RISK FLAG',
};

const alertTypeColors: Record<string, string> = {
  new_sponsor: 'bg-green text-bg',
  rating_change: 'bg-amber text-bg',
  new_job: 'bg-blue text-bg',
  company_news: 'bg-purple text-bg',
  risk_flag: 'bg-red text-bg',
};

export function AlertList({ alerts, onToggle, onEdit, onDelete }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="border border-s3 bg-s1 py-16 text-center">
        <Bell className="mx-auto mb-2 h-6 w-6 text-muted" />
        <p className="font-data text-xs text-dim">NO ALERTS CONFIGURED.</p>
        <p className="font-data text-[10px] text-muted">CREATE YOUR FIRST ALERT.</p>
      </div>
    );
  }

  return (
    <div className="space-y-px">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-center gap-3 border border-s3 bg-s1 px-3 py-2 transition-colors hover:bg-amber/5">
          {/* Toggle */}
          <button
            onClick={() => onToggle(alert.id, !alert.is_active)}
            className={`p-1.5 transition-colors ${
              alert.is_active
                ? 'text-green hover:text-green/80'
                : 'text-muted hover:text-dim'
            }`}
          >
            {alert.is_active ? <Bell size={14} /> : <BellOff size={14} />}
          </button>

          {/* Type Badge */}
          <span className={`inline-block px-1.5 py-0.5 font-data text-[9px] font-bold ${alertTypeColors[alert.alert_type] || 'bg-s3 text-dim'}`}>
            {alertTypeLabels[alert.alert_type] || alert.alert_type.toUpperCase()}
          </span>

          {/* Channel */}
          <span className="border border-s3 px-1.5 py-0.5 font-data text-[9px] text-dim uppercase">
            {alert.channel}
          </span>

          {/* Status */}
          {!alert.is_active && (
            <span className="bg-s3 px-1.5 py-0.5 font-data text-[9px] text-muted">PAUSED</span>
          )}

          {/* Info */}
          <div className="flex-1 font-data text-[9px] text-muted">
            <span>LAST: {alert.last_triggered ? formatDate(alert.last_triggered) : 'NEVER'}</span>
            <span className="mx-2">|</span>
            <span>CREATED: {formatDate(alert.created_at)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(alert)}
              className="p-1 text-dim transition-colors hover:text-amber"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(alert.id)}
              className="p-1 text-dim transition-colors hover:text-red"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
