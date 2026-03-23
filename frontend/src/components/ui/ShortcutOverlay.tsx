'use client';

import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: 'Cmd+K', description: 'Open command palette' },
      { keys: '?', description: 'Show keyboard shortcuts' },
      { keys: 'Esc', description: 'Close overlay / modal' },
      { keys: '[', description: 'Toggle sidebar' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'G D', description: 'Go to Dashboard' },
      { keys: 'G S', description: 'Go to Search' },
      { keys: 'G B', description: 'Go to Companies' },
      { keys: 'G J', description: 'Go to Jobs' },
      { keys: 'G M', description: 'Go to Map' },
      { keys: 'G T', description: 'Go to Trends' },
      { keys: 'G I', description: 'Go to Signals' },
      { keys: 'G C', description: 'Go to Compare' },
      { keys: 'G W', description: 'Go to Watchlist' },
      { keys: 'G K', description: 'Go to Tracker' },
      { keys: 'G A', description: 'Go to Alerts' },
      { keys: 'G N', description: 'Go to Notes' },
      { keys: 'G E', description: 'Go to Engine (admin)' },
    ],
  },
  {
    title: 'Search',
    shortcuts: [
      { keys: '/', description: 'Focus search input' },
      { keys: 'Enter', description: 'Execute search' },
      { keys: 'Tab', description: 'Next filter suggestion' },
    ],
  },
  {
    title: 'Table',
    shortcuts: [
      { keys: 'J / Down', description: 'Next row' },
      { keys: 'K / Up', description: 'Previous row' },
      { keys: 'Enter', description: 'Open selected company' },
      { keys: 'W', description: 'Watch/unwatch selected' },
    ],
  },
];

export function ShortcutOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter(
      (s) =>
        !filter ||
        s.description.toLowerCase().includes(filter.toLowerCase()) ||
        s.keys.toLowerCase().includes(filter.toLowerCase())
    ),
  })).filter((g) => g.shortcuts.length > 0);

  return (
    <div className="fixed inset-0 z-command-palette bg-bg/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl border border-border bg-s1 animate-slideInUp max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-data text-sm font-bold uppercase tracking-[0.15em] text-amber">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-dim hover:text-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-s2 border border-border px-3 py-1.5">
            <Search size={12} className="text-dim" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter shortcuts..."
              className="flex-1 bg-transparent text-xs font-data text-text placeholder:text-muted outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              <h3 className="font-data text-[10px] uppercase tracking-[0.2em] text-muted mb-2">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center justify-between py-1 px-2 hover:bg-s2/30 transition-colors"
                  >
                    <span className="text-xs text-dim">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.split('+').map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-muted text-[9px] mx-0.5">+</span>}
                          <kbd className="px-1.5 py-0.5 bg-s3 border border-border text-[10px] font-data text-text rounded-sm">
                            {key.trim()}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center justify-between">
          <span className="font-data text-[9px] text-muted">
            Press <kbd className="px-1 bg-s3 border border-border text-[9px] rounded-sm">?</kbd> to toggle
          </span>
          <span className="font-data text-[9px] text-muted">
            <kbd className="px-1 bg-s3 border border-border text-[9px] rounded-sm">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
