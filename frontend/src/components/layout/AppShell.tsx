'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TickerBar } from './TickerBar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { ShortcutOverlay } from '@/components/ui/ShortcutOverlay';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const toggleSidebar = () => setCollapsed(!collapsed);

  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onToggleSidebar: toggleSidebar,
    onCloseModal: () => setCommandPaletteOpen(false),
  });

  const sidebarWidth = collapsed ? 48 : 200;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div style={{ marginLeft: sidebarWidth }} className="transition-all duration-200">
        <Topbar collapsed={collapsed} onToggleSidebar={toggleSidebar} />
        <TickerBar />
        <main className="min-h-[calc(100vh-68px)] p-3">
          {children}
        </main>
      </div>
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onToggleSidebar={toggleSidebar}
      />
      <ShortcutOverlay />
    </div>
  );
}
