'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Building2,
  MapPin,
  Briefcase,
  TrendingUp,
  Zap,
  GitCompareArrows,
  Newspaper,
  Star,
  KanbanSquare,
  Bell,
  StickyNote,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
  Users,
  Scale,
  GraduationCap,
  BarChart3,
  BookOpen,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PointsDisplay } from '@/components/gamification/PointsDisplay';
import { StreakCounter } from '@/components/gamification/StreakCounter';
import { useAuthStore } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  badge?: 'live' | 'count';
  badgeValue?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [agentCount, setAgentCount] = useState<number>(0);
  const { token, isAuthenticated } = useAuthStore();
  const [gamStats, setGamStats] = useState<{ total_points: number; current_streak: number } | null>(null);

  useEffect(() => {
    async function fetchAgentCount() {
      try {
        const { data } = await supabase
          .from('source_health')
          .select('source, is_paused')
          .eq('is_paused', false);
        setAgentCount(data?.length || 0);
      } catch {
        // silently fail
      }
    }
    fetchAgentCount();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    async function fetchGamStats() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/gamification/stats`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setGamStats({ total_points: data.total_points, current_streak: data.current_streak });
        }
      } catch { /* silent */ }
    }
    fetchGamStats();
  }, [isAuthenticated, token]);

  const navSections: NavSection[] = [
    {
      title: 'CORE',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} />, shortcut: 'G D', badge: 'live' },
        { href: '/companies', label: 'Companies', icon: <Building2 size={15} />, shortcut: 'G B' },
        { href: '/search', label: 'Search', icon: <Search size={15} />, shortcut: 'G S' },
        { href: '/map', label: 'Map', icon: <MapPin size={15} />, shortcut: 'G M' },
        { href: '/jobs', label: 'Jobs', icon: <Briefcase size={15} />, shortcut: 'G J' },
      ],
    },
    {
      title: 'INTEL',
      items: [
        { href: '/intel', label: 'Intel Hub', icon: <Newspaper size={15} />, shortcut: 'G L', badge: 'live' },
        { href: '/trends', label: 'Trends', icon: <TrendingUp size={15} />, shortcut: 'G T' },
        { href: '/signals', label: 'Signals', icon: <Zap size={15} />, shortcut: 'G I' },
        { href: '/compare', label: 'Compare', icon: <GitCompareArrows size={15} />, shortcut: 'G C' },
      ],
    },
    {
      title: 'PERSONAL',
      items: [
        { href: '/watchlist', label: 'Watchlist', icon: <Star size={15} />, shortcut: 'G W' },
        { href: '/tracker', label: 'Tracker', icon: <KanbanSquare size={15} />, shortcut: 'G K' },
        { href: '/alerts', label: 'Alerts', icon: <Bell size={15} />, shortcut: 'G A' },
        { href: '/notes', label: 'Notes', icon: <StickyNote size={15} />, shortcut: 'G N' },
      ],
    },
    {
      title: 'ECOSYSTEM',
      items: [
        { href: '/consultancies', label: 'Consultancies', icon: <Users size={15} /> },
        { href: '/solicitors', label: 'Solicitors', icon: <Scale size={15} /> },
        { href: '/universities', label: 'Universities', icon: <GraduationCap size={15} /> },
        { href: '/demographics', label: 'Demographics', icon: <BarChart3 size={15} /> },
        { href: '/tools/life-guide', label: 'Life Guide', icon: <BookOpen size={15} /> },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { href: '/raw', label: 'RAW Tools', icon: <FlaskConical size={15} /> },
        { href: '/admin', label: 'Engine', icon: <Settings size={15} />, shortcut: 'G E', badge: 'count', badgeValue: agentCount },
      ],
      adminOnly: true,
    },
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border bg-bg transition-all duration-200',
        collapsed ? 'w-[48px]' : 'w-[200px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-10 items-center border-b border-border',
        collapsed ? 'justify-center px-0' : 'px-3 gap-2'
      )}>
        <span className="font-data text-base font-bold text-amber">SI</span>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-semibold text-text tracking-wide">SponsorIntel</span>
            <span className="text-[8px] uppercase tracking-[0.3em] text-dim">TERMINAL v2</span>
          </div>
        )}
      </div>

      {/* Team Status Indicator */}
      {!collapsed && (
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Bot size={10} className="text-cyan" />
            <span className="font-data text-[8px] uppercase tracking-wider text-dim">Team Status</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
          </div>
          <div className="space-y-px">
            {[
              { name: 'Aria', title: 'Sourcing' },
              { name: 'Marcus', title: 'QA' },
              { name: 'Priya', title: 'Intel' },
              { name: 'Raj', title: 'Ops' },
              { name: 'Alex', title: 'R&D' },
            ].map((a) => (
              <div key={a.name} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-green" />
                <span className="font-data text-[7px] text-dim">{a.name}</span>
                <span className="font-data text-[7px] text-dim/40">{a.title}</span>
              </div>
            ))}
            <span className="font-data text-[7px] text-dim/40">{'+4 more online'}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-data text-[8px] text-green">56 online</span>
            <span className="font-data text-[8px] text-dim">{`// ${agentCount} sources`}</span>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center py-2 border-b border-border" title="56 team members online">
          <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        {navSections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed && (
              <p className="mb-0.5 px-3 text-[9px] font-medium uppercase tracking-[0.2em] text-muted">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex items-center h-7 transition-colors',
                    collapsed ? 'justify-center mx-1 rounded' : 'px-3',
                    isActive
                      ? collapsed
                        ? 'text-amber bg-amber/10'
                        : 'border-l-2 border-amber text-amber bg-amber/5'
                      : collapsed
                        ? 'text-dim hover:text-text hover:bg-s2'
                        : 'border-l-2 border-transparent text-dim hover:text-text hover:bg-s2/30'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="ml-2 text-[12px] font-medium">{item.label}</span>
                      {/* LIVE pulse indicator */}
                      {item.badge === 'live' && (
                        <span className="ml-1.5 flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-green animate-pulse" />
                          <span className="font-data text-[7px] text-green uppercase tracking-wider">LIVE</span>
                        </span>
                      )}
                      {/* Count badge */}
                      {item.badge === 'count' && item.badgeValue !== undefined && item.badgeValue > 0 && (
                        <span className="ml-1.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-cyan/15 px-1 font-data text-[8px] font-bold text-cyan">
                          {item.badgeValue}
                        </span>
                      )}
                      {item.shortcut && (
                        <span className="ml-auto text-[9px] text-muted font-data">{item.shortcut}</span>
                      )}
                    </>
                  )}
                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 z-50 hidden whitespace-nowrap rounded bg-s3 px-2 py-1 text-[11px] text-text shadow-lg group-hover:block border border-border">
                      {item.label}
                      {item.badge === 'live' && (
                        <span className="ml-1 text-green text-[8px]">LIVE</span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border">
        <button
          onClick={onToggle}
          className="flex h-7 w-full items-center justify-center text-dim hover:text-text transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
        </button>
        {!collapsed && gamStats && (
          <div className="px-3 py-1.5 border-t border-border flex items-center justify-between">
            <PointsDisplay points={gamStats.total_points} compact />
            <StreakCounter streak={gamStats.current_streak} compact />
          </div>
        )}
        {!collapsed && (
          <div className="px-3 pb-1.5 flex items-center justify-between">
            <p className="text-[8px] text-muted font-data uppercase tracking-wider">v2.0 terminal</p>
            <span className="h-1 w-1 rounded-full bg-green" />
          </div>
        )}
      </div>
    </aside>
  );
}
