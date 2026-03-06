'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  new_sponsor: 'New Sponsor',
  rating_change: 'Rating Change',
  new_job: 'New Job',
  company_news: 'Company News',
  risk_flag: 'Risk Flag',
};

const alertTypeBadge: Record<string, 'green' | 'orange' | 'blue' | 'purple' | 'red'> = {
  new_sponsor: 'green',
  rating_change: 'orange',
  new_job: 'blue',
  company_news: 'purple',
  risk_flag: 'red',
};

export function AlertList({ alerts, onToggle, onEdit, onDelete }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="mb-3 h-8 w-8 text-dim2" />
          <p className="text-sm text-dim">No alerts configured yet.</p>
          <p className="text-xs text-dim2">Create your first alert to get notified.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Card key={alert.id}>
          <div className="flex items-center gap-4">
            {/* Status toggle */}
            <button
              onClick={() => onToggle(alert.id, !alert.is_active)}
              className={`rounded-md p-2 transition-colors ${
                alert.is_active
                  ? 'bg-green/10 text-green hover:bg-green/20'
                  : 'bg-s3 text-dim hover:bg-s4'
              }`}
            >
              {alert.is_active ? <Bell size={16} /> : <BellOff size={16} />}
            </button>

            {/* Alert info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={alertTypeBadge[alert.alert_type] || 'blue'}>
                  {alertTypeLabels[alert.alert_type] || alert.alert_type}
                </Badge>
                <Badge>{alert.channel}</Badge>
                {!alert.is_active && (
                  <Badge variant="default">Paused</Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-dim2">
                <span>Last triggered: {alert.last_triggered ? formatDate(alert.last_triggered) : 'Never'}</span>
                <span>Created: {formatDate(alert.created_at)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onEdit(alert)}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(alert.id)}>
                <Trash2 size={14} className="text-red" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
