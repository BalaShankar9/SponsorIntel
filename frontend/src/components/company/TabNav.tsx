'use client';

import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tab: string) => void;
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <div className="border-b border-border">
      <div className="flex gap-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 py-2 font-data text-[11px] font-medium tracking-wider transition-all',
              activeTab === tab.id
                ? 'text-amber'
                : 'text-dim hover:text-text',
            )}
          >
            {tab.label}
            {/* Active indicator */}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber/50 via-amber to-amber/50" />
            )}
            {/* Count indicator dot for non-overview tabs */}
            {tab.id !== 'overview' && activeTab !== tab.id && (
              <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-muted" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
