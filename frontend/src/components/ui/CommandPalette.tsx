'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, FileText, Zap, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleSidebar?: () => void;
}

interface SponsorResult {
  id: string;
  organisation_name: string;
  town_city: string | null;
  rating: string | null;
  sponsor_type: string | null;
  overall_score: number | null;
}

interface CommandItem {
  id: string;
  label: string;
  category: 'Sponsors' | 'Pages' | 'Actions';
  icon?: React.ReactNode;
  action: () => void;
  subtitle?: string;
  badge?: { text: string; color: string };
}

const PAGES: Array<{ label: string; path: string }> = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Search', path: '/search' },
  { label: 'Companies', path: '/companies' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Map', path: '/map' },
  { label: 'Trends', path: '/trends' },
  { label: 'Signals', path: '/signals' },
  { label: 'Compare', path: '/compare' },
  { label: 'Tracker', path: '/tracker' },
  { label: 'Alerts', path: '/alerts' },
  { label: 'Admin', path: '/admin' },
];

interface FilterChip {
  type: 'location' | 'rating' | 'industry' | 'route';
  label: string;
  value: string;
}

const FILTER_SUGGESTIONS: Array<{
  pattern: RegExp;
  type: FilterChip['type'];
  label: string;
  value: string;
}> = [
  { pattern: /\blondon\b/i, type: 'location', label: 'Location: London', value: 'London' },
  { pattern: /\bmanchester\b/i, type: 'location', label: 'Location: Manchester', value: 'Manchester' },
  { pattern: /\bbirmingham\b/i, type: 'location', label: 'Location: Birmingham', value: 'Birmingham' },
  { pattern: /\bleeds\b/i, type: 'location', label: 'Location: Leeds', value: 'Leeds' },
  { pattern: /\bbristol\b/i, type: 'location', label: 'Location: Bristol', value: 'Bristol' },
  { pattern: /\ba[- ]?rated\b/i, type: 'rating', label: 'Rating: A', value: 'A' },
  { pattern: /\bb[- ]?rated\b/i, type: 'rating', label: 'Rating: B', value: 'B' },
  { pattern: /\btech(nology)?\b/i, type: 'industry', label: 'Industry: Technology', value: 'Technology' },
  { pattern: /\bhealthcare\b/i, type: 'industry', label: 'Industry: Healthcare', value: 'Healthcare' },
  { pattern: /\bfinance?\b/i, type: 'industry', label: 'Industry: Finance', value: 'Finance' },
  { pattern: /\bskilled\s?worker\b/i, type: 'route', label: 'Route: Skilled Worker', value: 'Skilled Worker' },
];

export function CommandPalette({ isOpen, onClose, onToggleSidebar }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sponsorResults, setSponsorResults] = useState<SponsorResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState<FilterChip[]>([]);

  const matchedSuggestions = FILTER_SUGGESTIONS.filter(
    (s) => query.length > 1 && s.pattern.test(query) && !filters.some((f) => f.value === s.value)
  );

  const addFilter = (chip: FilterChip) => {
    setFilters((prev) => [...prev, chip]);
    setQuery('');
  };

  const removeFilter = (idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    filters.forEach((f) => {
      if (f.type === 'location') params.set('city', f.value);
      if (f.type === 'rating') params.set('rating', f.value);
      if (f.type === 'industry') params.set('industry', f.value);
      if (f.type === 'route') params.set('route', f.value);
    });
    if (query) params.set('search', query);
    router.push(`/search?${params.toString()}`);
    onClose();
  };

  // Build items list
  const buildItems = useCallback((): CommandItem[] => {
    const items: CommandItem[] = [];
    const q = query.toLowerCase();

    // Sponsors from search
    sponsorResults.slice(0, 8).forEach((s) => {
      const ratingBadge = s.rating
        ? { text: s.rating, color: s.rating === 'A' ? 'text-green bg-green/20' : 'text-red bg-red/20' }
        : undefined;

      items.push({
        id: `sponsor-${s.id}`,
        label: s.organisation_name,
        category: 'Sponsors',
        icon: <Building2 size={14} />,
        subtitle: [s.town_city, s.sponsor_type].filter(Boolean).join(' \u00b7 '),
        badge: ratingBadge,
        action: () => {
          router.push(`/company/${s.id}`);
          onClose();
        },
      });
    });

    // Pages
    const filteredPages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q));
    filteredPages.slice(0, 8).forEach((p) => {
      items.push({
        id: `page-${p.path}`,
        label: p.label,
        category: 'Pages',
        icon: <FileText size={14} />,
        action: () => {
          router.push(p.path);
          onClose();
        },
      });
    });

    // Actions
    const actions: Array<{ label: string; action: () => void }> = [
      {
        label: 'Toggle Sidebar',
        action: () => {
          onToggleSidebar?.();
          onClose();
        },
      },
      {
        label: 'Export Data',
        action: () => {
          onClose();
        },
      },
    ];

    actions
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach((a) => {
        items.push({
          id: `action-${a.label}`,
          label: a.label,
          category: 'Actions',
          icon: <Zap size={14} />,
          action: a.action,
        });
      });

    return items;
  }, [query, sponsorResults, router, onClose, onToggleSidebar]);

  const items = buildItems();

  // Debounced sponsor search via Supabase with join
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSponsorResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('sponsors')
          .select(`
            id, organisation_name, town_city, rating, sponsor_type,
            sponsor_scores ( overall_score )
          `)
          .ilike('organisation_name', `%${query}%`)
          .limit(8);

        const results: SponsorResult[] = (data || []).map((r: Record<string, unknown>) => {
          const scores = r.sponsor_scores;
          const scoreObj = Array.isArray(scores) ? scores[0] : scores;
          return {
            id: r.id as string,
            organisation_name: r.organisation_name as string,
            town_city: r.town_city as string | null,
            rating: r.rating as string | null,
            sponsor_type: r.sponsor_type as string | null,
            overall_score: (scoreObj as Record<string, unknown>)?.overall_score as number | null ?? null,
          };
        });

        setSponsorResults(results);
      } catch {
        setSponsorResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  // Focus input on open, reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSponsorResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, items.length - 1);
          scrollToItem(next);
          return next;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          scrollToItem(next);
          return next;
        });
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  const scrollToItem = (idx: number) => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(`[data-index="${idx}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  };

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, sponsorResults]);

  if (!isOpen) return null;

  // Group items by category
  const grouped: Record<string, CommandItem[]> = {};
  items.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const categoryOrder: Array<'Sponsors' | 'Pages' | 'Actions'> = ['Sponsors', 'Pages', 'Actions'];

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative z-10 w-full max-w-xl animate-slideInUp border border-border bg-s1 shadow-2xl shadow-amber/5">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className={searching ? 'text-amber animate-pulse' : 'text-dim'} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sponsors, pages, actions..."
            className="flex-1 bg-transparent text-sm text-text placeholder-dim outline-none"
            style={{ boxShadow: 'none' }}
          />
          <kbd className="rounded border border-border bg-s2 px-1.5 py-0.5 font-data text-[10px] text-dim">
            ESC
          </kbd>
        </div>

        {/* Filter chips */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
            {filters.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber/10 border border-amber/20 text-amber text-[10px] font-data"
              >
                {f.label}
                <button
                  onClick={() => removeFilter(i)}
                  className="hover:text-red transition-colors ml-0.5"
                >
                  x
                </button>
              </span>
            ))}
            <button
              onClick={applyFilters}
              className="px-2 py-0.5 bg-amber/20 border border-amber/30 text-amber text-[10px] font-data font-bold hover:bg-amber/30 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        )}

        {/* Structured filter suggestions */}
        {matchedSuggestions.length > 0 && (
          <div className="border-b border-border py-1">
            <div className="px-3 py-0.5">
              <span className="font-data text-[9px] uppercase tracking-wider text-muted">
                Suggested Filters
              </span>
            </div>
            {matchedSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => addFilter({ type: s.type, label: s.label, value: s.value })}
                className="w-full px-3 py-1.5 text-left text-xs font-data text-cyan hover:bg-s2 transition-colors flex items-center gap-2"
              >
                <Zap size={10} />
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && query.trim() && !searching && (
            <div className="px-3 py-6 text-center text-sm text-dim">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {searching && sponsorResults.length === 0 && (
            <div className="px-3 py-4 text-center">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            </div>
          )}

          {categoryOrder.map((cat) => {
            const catItems = grouped[cat];
            if (!catItems || catItems.length === 0) return null;

            return (
              <div key={cat} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-dim">
                  {cat}
                </div>
                {catItems.map((item) => {
                  globalIndex += 1;
                  const idx = globalIndex;
                  const isSelected = idx === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        isSelected ? 'bg-s2 text-amber' : 'text-text hover:bg-s2'
                      )}
                    >
                      <span className={cn('flex-shrink-0', isSelected ? 'text-amber' : 'text-dim')}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">
                        <span>{item.label}</span>
                        {item.subtitle && (
                          <span className="ml-2 text-[11px] text-dim">{item.subtitle}</span>
                        )}
                      </span>
                      {item.badge && (
                        <span className={cn(
                          'flex-shrink-0 inline-block rounded px-1 py-0.5 font-data text-[9px] font-bold',
                          item.badge.color
                        )}>
                          {item.badge.text}
                        </span>
                      )}
                      {isSelected && (
                        <ArrowRight size={12} className="flex-shrink-0 text-amber" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-dim">
          <span>
            <kbd className="mr-1 rounded border border-border bg-s2 px-1 py-0.5 font-data">
              &uarr;&darr;
            </kbd>
            navigate
          </span>
          <span>
            <kbd className="mr-1 rounded border border-border bg-s2 px-1 py-0.5 font-data">
              &crarr;
            </kbd>
            select
          </span>
          <span>
            <kbd className="mr-1 rounded border border-border bg-s2 px-1 py-0.5 font-data">
              esc
            </kbd>
            close
          </span>
          <span className="ml-auto font-data text-dim/50">
            <kbd className="mr-1 rounded border border-border bg-s2 px-1 py-0.5 font-data">
              Ctrl+K
            </kbd>
            to open
          </span>
        </div>
      </div>
    </div>
  );
}
