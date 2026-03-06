'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function Topbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="fixed left-[220px] right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-s1 px-4">
      {/* Global Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sponsors, companies, jobs..."
            className="w-full rounded-md border border-border bg-s2 py-1.5 pl-10 pr-4 text-sm text-text placeholder-dim2 focus:border-accent focus:outline-none"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-s3 px-1.5 py-0.5 text-[10px] text-dim2">/</kbd>
        </div>
      </form>

      {/* Right actions */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notifications */}
        <button className="relative rounded-md p-2 text-dim hover:bg-s2 hover:text-text">
          <Bell size={18} />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red" />
        </button>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-dim hover:bg-s2 hover:text-text"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent2 text-xs font-bold text-white">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm">{user?.name || 'Guest'}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-s1 py-1 shadow-xl">
              {isAuthenticated ? (
                <>
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-sm font-medium text-text">{user?.name}</p>
                    <p className="text-xs text-dim">{user?.email}</p>
                    <span className="mt-1 inline-block rounded bg-accent2/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent">
                      {user?.plan}
                    </span>
                  </div>
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dim hover:bg-s2 hover:text-text"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { router.push('/login'); setShowUserMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dim hover:bg-s2 hover:text-text"
                >
                  <User size={14} />
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
