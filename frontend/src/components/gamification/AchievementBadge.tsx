'use client';

import { Trophy, Star, Search, Eye, Users, Flame, Brain, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface AchievementBadgeProps {
  achievementKey: string;
  label: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  size?: 'sm' | 'md';
}

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first_watch: Star,
  analyst: Brain,
  researcher: Search,
  deep_diver: Eye,
  contributor: MessageSquare,
  streak_7: Flame,
  streak_30: Flame,
};

const ACHIEVEMENT_COLORS: Record<string, string> = {
  first_watch: 'text-amber',
  analyst: 'text-purple',
  researcher: 'text-cyan',
  deep_diver: 'text-green',
  contributor: 'text-amber',
  streak_7: 'text-amber',
  streak_30: 'text-red',
};

export function AchievementBadge({
  achievementKey,
  label,
  description,
  unlocked,
  unlockedAt,
  size = 'md',
}: AchievementBadgeProps) {
  const Icon = ACHIEVEMENT_ICONS[achievementKey] || Trophy;
  const color = unlocked
    ? ACHIEVEMENT_COLORS[achievementKey] || 'text-amber'
    : 'text-muted';
  const iconSize = size === 'sm' ? 14 : 20;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 border transition-all',
        unlocked
          ? 'border-amber/20 bg-amber/5'
          : 'border-border bg-s1 opacity-40'
      )}
      title={unlocked ? `Unlocked: ${description}` : `Locked: ${description}`}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          size === 'sm' ? 'h-7 w-7' : 'h-10 w-10',
          unlocked ? 'bg-amber/10' : 'bg-s3'
        )}
      >
        <Icon size={iconSize} className={color} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            'font-data font-bold uppercase tracking-wider truncate',
            size === 'sm' ? 'text-[9px]' : 'text-[10px]',
            color
          )}
        >
          {label}
        </p>
        <p className="text-[8px] text-dim truncate">{description}</p>
        {unlocked && unlockedAt && (
          <p className="text-[7px] text-muted font-data">
            Unlocked {new Date(unlockedAt).toLocaleDateString('en-GB')}
          </p>
        )}
      </div>
    </div>
  );
}
