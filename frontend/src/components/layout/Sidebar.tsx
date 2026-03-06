'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  MapPin,
  Briefcase,
  TrendingUp,
  Zap,
  GitCompareArrows,
  Star,
  KanbanSquare,
  Bell,
  StickyNote,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const navSections: NavSection[] = [
  {
    title: 'CORE',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
      { href: '/search', label: 'Search', icon: <Search size={16} /> },
      { href: '/map', label: 'Map', icon: <MapPin size={16} /> },
      { href: '/jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
    ],
  },
  {
    title: 'INTEL',
    items: [
      { href: '/trends', label: 'Trends', icon: <TrendingUp size={16} /> },
      { href: '/signals', label: 'Signals', icon: <Zap size={16} /> },
      { href: '/compare', label: 'Compare', icon: <GitCompareArrows size={16} /> },
    ],
  },
  {
    title: 'PERSONAL',
    items: [
      { href: '/watchlist', label: 'Watchlist', icon: <Star size={16} /> },
      { href: '/tracker', label: 'Tracker', icon: <KanbanSquare size={16} /> },
      { href: '/alerts', label: 'Alerts', icon: <Bell size={16} /> },
      { href: '/notes', label: 'Notes', icon: <StickyNote size={16} /> },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { href: '/admin/engine', label: 'Engine', icon: <Settings size={16} /> },
    ],
    adminOnly: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[220px] flex-col border-r border-border bg-s1">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent2 text-xs font-bold text-white">
          SI
        </div>
        <span className="text-sm font-bold text-text">SponsorIntel</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-dim2">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'border-l-2 border-accent bg-accent/10 font-medium text-accent'
                      : 'border-l-2 border-transparent text-dim hover:bg-s2 hover:text-text'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Version */}
      <div className="border-t border-border px-4 py-2">
        <p className="text-[10px] text-dim2">v0.1.0 beta</p>
      </div>
    </aside>
  );
}
