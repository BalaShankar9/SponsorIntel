'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { StreakCounter } from '@/components/gamification/StreakCounter';

interface TopbarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ collapsed, onToggleSidebar }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  const handleCommandK = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    }));
  }, []);

  const planLabel = user?.plan?.toUpperCase() || 'FREE';

  return (
    <header className="sticky top-0 z-20 flex h-10 items-center justify-between border-b border-border bg-s1 px-3">
      {/* Left spacer */}
      <div className="w-8" />

      {/* Center: Command palette trigger */}
      <button
        onClick={handleCommandK}
        className="flex h-7 max-w-md flex-1 items-center justify-between rounded border border-border bg-s2 px-3 text-xs text-dim hover:border-muted hover:text-text transition-colors mx-4"
      >
        <span>Search sponsors, jobs, commands...</span>
        <kbd className="ml-3 shrink-0 rounded border border-border bg-s3 px-1.5 py-0.5 text-[10px] text-muted">
          ⌘K
        </kbd>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Streak */}
        {isAuthenticated && (
          <StreakCounter streak={0} compact className="mr-1" />
        )}
        {/* Notifications */}
        <button className="relative rounded p-1.5 text-dim hover:bg-s2 hover:text-text transition-colors">
          <Bell size={15} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber" />
        </button>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded px-1.5 py-1 text-dim hover:bg-s2 hover:text-text transition-colors"
          >
            <span className={cn(
              'inline-flex h-[18px] items-center rounded px-1.5 text-[9px] font-semibold uppercase tracking-wider',
              planLabel === 'PRO' ? 'bg-amber/20 text-amber' : 'bg-s3 text-muted'
            )}>
              {planLabel}
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-s3 text-[10px] font-bold text-text">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded border border-border bg-s1 py-1 shadow-xl animate-fadeIn">
              {isAuthenticated ? (
                <>
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-xs font-medium text-text">{user?.name}</p>
                    <p className="text-[10px] text-dim">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-dim hover:bg-s2 hover:text-text"
                  >
                    <LogOut size={12} />
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { router.push('/login'); setShowUserMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-dim hover:bg-s2 hover:text-text"
                >
                  <User size={12} />
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
