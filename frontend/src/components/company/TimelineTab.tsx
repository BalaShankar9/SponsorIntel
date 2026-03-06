'use client';

import { useEffect, useState } from 'react';
import { Plus, Minus, ArrowUpDown, Briefcase, AlertTriangle, FileText, Users, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProGate } from '@/components/ui/ProGate';
import { PageSpinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { SponsorChange } from '@/types';

interface TimelineTabProps {
  sponsorId: string;
}

const changeTypeIcons: Record<string, React.ReactNode> = {
  added: <Plus size={14} />,
  removed: <Minus size={14} />,
  rating_upgrade: <ArrowUpDown size={14} />,
  rating_downgrade: <ArrowUpDown size={14} />,
  route_added: <Plus size={14} />,
  route_removed: <Minus size={14} />,
  location_change: <Zap size={14} />,
  name_change: <FileText size={14} />,
  reactivated: <Plus size={14} />,
};

const changeTypeColors: Record<string, string> = {
  added: 'bg-green',
  removed: 'bg-red',
  rating_upgrade: 'bg-green',
  rating_downgrade: 'bg-red',
  route_added: 'bg-accent',
  route_removed: 'bg-orange',
  location_change: 'bg-purple',
  name_change: 'bg-cyan',
  reactivated: 'bg-green',
};

export function TimelineTab({ sponsorId }: TimelineTabProps) {
  const { isPro } = useAuthStore();
  const [changes, setChanges] = useState<SponsorChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SponsorChange[]>(`/api/v1/sponsors/${sponsorId}/changes`)
      .then(setChanges)
      .catch(() => setChanges([]))
      .finally(() => setLoading(false));
  }, [sponsorId]);

  if (loading) return <PageSpinner />;

  const content = (
    <Card>
      <CardHeader>
        <CardTitle>Event Timeline ({changes.length})</CardTitle>
      </CardHeader>
      {changes.length === 0 ? (
        <p className="text-sm text-dim">No timeline events recorded yet.</p>
      ) : (
        <div className="relative ml-4 border-l border-border pl-6">
          {changes.map((change, idx) => (
            <div key={change.id} className={cn('relative pb-6', idx === changes.length - 1 && 'pb-0')}>
              {/* Dot */}
              <div className={cn(
                'absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full',
                changeTypeColors[change.change_type] || 'bg-s4'
              )}>
                <span className="text-white">
                  {changeTypeIcons[change.change_type] || <Zap size={10} />}
                </span>
              </div>

              {/* Content */}
              <div>
                <p className="text-xs text-dim2">{formatDate(change.detected_at)}</p>
                <p className="mt-0.5 text-sm font-medium capitalize text-text">
                  {change.change_type.replace(/_/g, ' ')}
                </p>
                {change.field_changed && (
                  <p className="mt-0.5 text-xs text-dim">
                    {change.field_changed}: {change.old_value || '--'} → {change.new_value || '--'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <ProGate isAllowed={isPro} feature="Event timeline">
      {content}
    </ProGate>
  );
}
