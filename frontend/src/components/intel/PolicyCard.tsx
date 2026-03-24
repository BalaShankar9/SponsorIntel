'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { IntelPolicy, IntelPolicyStage } from '@/types/intel';

const stageConfig: Record<IntelPolicyStage, { label: string; variant: 'default' | 'blue' | 'amber' | 'purple' | 'green' }> = {
  proposed: { label: 'Proposed', variant: 'default' },
  consultation: { label: 'Consultation', variant: 'blue' },
  parliamentary_debate: { label: 'In Parliament', variant: 'purple' },
  enacted: { label: 'Enacted', variant: 'amber' },
  effective: { label: 'In Effect', variant: 'green' },
};

interface PolicyCardProps {
  policy: IntelPolicy;
  onFollow?: (id: string) => void;
  onUnfollow?: (id: string) => void;
}

export function PolicyCard({ policy, onFollow, onUnfollow }: PolicyCardProps) {
  const stage = stageConfig[policy.stage] || stageConfig.proposed;

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <Badge variant={stage.variant} size="sm">{stage.label}</Badge>
        {policy.effective_date && (
          <span className="text-[9px] font-data text-dim">
            Effective: {formatDate(policy.effective_date)}
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-text mb-1">{policy.title}</h3>
      {policy.description && <p className="text-xs text-dim mb-2">{policy.description}</p>}

      {policy.last_update_summary && (
        <div className="bg-s2 rounded p-2 border border-border mb-2">
          <p className="text-[9px] font-data uppercase text-dim mb-0.5">Latest Update</p>
          <p className="text-[11px] text-text">{policy.last_update_summary}</p>
          {policy.last_updated_at && (
            <p className="text-[9px] font-data text-dim mt-0.5">{formatDate(policy.last_updated_at)}</p>
          )}
        </div>
      )}

      {policy.visa_routes_affected && (
        <div className="flex flex-wrap gap-1 mb-2">
          {policy.visa_routes_affected.map((r) => (
            <span key={r} className="text-[8px] font-data text-dim bg-s3 px-1.5 py-px rounded border border-border">{r}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        {policy.source_url && (
          <a href={policy.source_url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-cyan font-data hover:text-cyan/80">
            Source &rarr;
          </a>
        )}
        {policy.is_followed ? (
          <Button variant="ghost" size="sm" onClick={() => onUnfollow?.(policy.id)}>Unfollow</Button>
        ) : (
          <Button variant="amber" size="sm" onClick={() => onFollow?.(policy.id)}>Follow</Button>
        )}
      </div>
    </Card>
  );
}
