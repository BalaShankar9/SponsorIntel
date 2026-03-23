'use client';

import { SearchX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  suggestion?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  suggestion,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="mb-3 text-muted">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="font-data text-sm font-semibold text-text uppercase tracking-wider mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-dim max-w-md mb-2">{description}</p>
      )}
      {suggestion && (
        <p className="text-[10px] text-amber font-data mb-3">{suggestion}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-1.5 border border-amber/30 bg-amber/10 text-amber text-xs font-data font-semibold uppercase tracking-wider hover:bg-amber/20 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
