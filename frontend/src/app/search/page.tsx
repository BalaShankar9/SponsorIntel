'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, X, Terminal, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FilterBar, defaultFilters, type SearchFilters } from '@/components/search/FilterBar';
import { cn } from '@/lib/utils';
import type { FilterOptions } from '@/types';

const PER_PAGE = 30;

interface SponsorRow {
  id: string;
  organisation_name: string;
  town_city: string | null;
  county: string | null;
  rating: string | null;
  sponsor_type: string | null;
  route: string[] | null;
  is_active: boolean;
  first_seen_date: string | null;
  last_seen_date: string | null;
  score: number | null;
  company_status: string | null;
  companies_house_number: string | null;
  industry_primary: string | null;
  credit_risk_score: number | null;
  enrichment_level: number | null;
  job_count: number;
}

interface PaginatedResults {
  data: SponsorRow[];
  total: number;
  page: number;
  pages: number;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-dim font-data text-xs">LOADING TERMINAL...</div>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    q: searchParams.get('q') || '',
  });
  const [results, setResults] = useState<PaginatedResults>({ data: [], total: 0, page: 1, pages: 0 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [totalSponsorCount, setTotalSponsorCount] = useState<number>(0);
  const [selectedRow, setSelectedRow] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterVersion, setFilterVersion] = useState(0);

  // Load total sponsor count and filter options
  useEffect(() => {
    async function loadInit() {
      const [totalRes, citiesRes, routesRes, sponsorTypesRes] = await Promise.all([
        supabase.from('sponsors').select('id', { count: 'exact', head: true }),
        supabase.from('sponsors').select('town_city').not('town_city', 'is', null).limit(1000),
        supabase.from('sponsors').select('route').not('route', 'is', null).limit(1000),
        supabase.from('sponsors').select('sponsor_type').not('sponsor_type', 'is', null).limit(1000),
      ]);

      setTotalSponsorCount(totalRes.count || 0);

      const unique = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean).sort();
      const cities = unique((citiesRes.data || []).map((r) => r.town_city as string));
      const routes = unique((routesRes.data || []).flatMap((r) => {
        const v = r.route;
        return Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
      }));
      const sponsor_types = unique((sponsorTypesRes.data || []).map((r) => r.sponsor_type as string));

      setFilterOptions({ cities, counties: [], routes, sponsor_types });
    }
    loadInit();
  }, []);

  const doSearch = useCallback(async (f: SearchFilters, p: number = 1) => {
    setLoading(true);
    try {
      const from = (p - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;

      // Main query with joins
      let query = supabase
        .from('sponsors')
        .select(`
          id, organisation_name, town_city, county, rating, sponsor_type, route, is_active, first_seen_date, last_seen_date,
          company_profiles ( companies_house_number, company_status, industry_primary, credit_risk_score, enrichment_level ),
          sponsor_scores ( overall_score )
        `, { count: 'exact' });

      if (f.q) query = query.ilike('organisation_name', `%${f.q}%`);
      if (f.city) query = query.eq('town_city', f.city);
      if (f.county) query = query.eq('county', f.county);
      if (f.rating) query = query.eq('rating', f.rating);
      if (f.sponsor_type) query = query.eq('sponsor_type', f.sponsor_type);
      if (f.route) query = query.contains('route', [f.route]);
      if (f.active_only) query = query.eq('is_active', true);

      query = query.order('organisation_name', { ascending: true }).range(from, to);

      const { data, count, error } = await query;

      if (error) {
        // Fallback without joins
        let fallback = supabase
          .from('sponsors')
          .select('id, organisation_name, town_city, county, rating, sponsor_type, route, is_active, first_seen_date, last_seen_date', { count: 'exact' });

        if (f.q) fallback = fallback.ilike('organisation_name', `%${f.q}%`);
        if (f.city) fallback = fallback.eq('town_city', f.city);
        if (f.county) fallback = fallback.eq('county', f.county);
        if (f.rating) fallback = fallback.eq('rating', f.rating);
        if (f.sponsor_type) fallback = fallback.eq('sponsor_type', f.sponsor_type);
        if (f.route) fallback = fallback.contains('route', [f.route]);
        if (f.active_only) fallback = fallback.eq('is_active', true);
        fallback = fallback.order('organisation_name', { ascending: true }).range(from, to);

        const { data: fbData, count: fbCount } = await fallback;
        const total = fbCount || 0;
        setResults({
          data: (fbData || []).map((r: Record<string, unknown>) => ({
            ...r,
            score: null,
            company_status: null,
            companies_house_number: null,
            industry_primary: null,
            credit_risk_score: null,
            enrichment_level: null,
            job_count: 0,
          } as SponsorRow)),
          total,
          page: p,
          pages: Math.ceil(total / PER_PAGE),
        });
        setPage(p);
        return;
      }

      const total = count || 0;

      // Fetch job counts for these sponsors
      const sponsorIds = (data || []).map((r: Record<string, unknown>) => r.id as string);
      let jobCounts: Record<string, number> = {};
      if (sponsorIds.length > 0) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('sponsor_id')
          .in('sponsor_id', sponsorIds);
        if (jobData) {
          jobData.forEach((j) => {
            if (j.sponsor_id) jobCounts[j.sponsor_id] = (jobCounts[j.sponsor_id] || 0) + 1;
          });
        }
      }

      const rows: SponsorRow[] = (data || []).map((r: Record<string, unknown>) => {
        const profiles = r.company_profiles;
        const profile = Array.isArray(profiles) ? profiles[0] : profiles;
        const scores = r.sponsor_scores;
        const scoreObj = Array.isArray(scores) ? scores[0] : scores;
        return {
          id: r.id as string,
          organisation_name: r.organisation_name as string,
          town_city: r.town_city as string | null,
          county: r.county as string | null,
          rating: r.rating as string | null,
          sponsor_type: r.sponsor_type as string | null,
          route: r.route as string[] | null,
          is_active: r.is_active as boolean,
          first_seen_date: r.first_seen_date as string | null,
          last_seen_date: r.last_seen_date as string | null,
          score: (scoreObj as Record<string, unknown>)?.overall_score as number | null ?? null,
          company_status: (profile as Record<string, unknown>)?.company_status as string | null ?? null,
          companies_house_number: (profile as Record<string, unknown>)?.companies_house_number as string | null ?? null,
          industry_primary: (profile as Record<string, unknown>)?.industry_primary as string | null ?? null,
          credit_risk_score: (profile as Record<string, unknown>)?.credit_risk_score as number | null ?? null,
          enrichment_level: (profile as Record<string, unknown>)?.enrichment_level as number | null ?? null,
          job_count: jobCounts[r.id as string] || 0,
        };
      });

      setResults({ data: rows, total, page: p, pages: Math.ceil(total / PER_PAGE) });
      setPage(p);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial search + re-search when non-query filters change
  useEffect(() => {
    doSearch(filters, 1);
  }, [filterVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryChange = (value: string) => {
    const updated = { ...filters, q: value };
    setFilters(updated);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(updated, 1);
    }, 300);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setFilterVersion((v) => v + 1);
  };

  const handlePageChange = (newPage: number) => {
    doSearch(filters, newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(filters, 1);
  };

  const clearSearch = () => {
    const updated = { ...filters, q: '' };
    setFilters(updated);
    doSearch(updated, 1);
    inputRef.current?.focus();
  };

  // Focus search bar with / key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const activeFilterCount = [filters.city, filters.rating, filters.sponsor_type, filters.route].filter(Boolean).length +
    (filters.active_only ? 0 : 1);

  const fromRow = results.data.length > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const toRow = fromRow + results.data.length - 1;

  function enrichmentLabel(level: number | null): { text: string; color: string } {
    if (level === null || level === undefined) return { text: 'NONE', color: 'text-dim' };
    if (level >= 80) return { text: 'FULL', color: 'text-green' };
    if (level >= 50) return { text: 'PARTIAL', color: 'text-amber' };
    if (level >= 20) return { text: 'BASIC', color: 'text-cyan' };
    return { text: 'MINIMAL', color: 'text-dim' };
  }

  return (
    <div className="space-y-3">
      {/* Terminal header with total count */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-3">
          <Database size={14} className="text-amber" />
          <h1 className="font-data text-sm font-bold uppercase tracking-widest text-amber">
            UK SPONSOR REGISTER
          </h1>
          <span className="font-data text-[10px] text-dim">FULL DATABASE</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-s1 border border-border px-3 py-1.5">
            <span className="font-data text-[10px] text-dim uppercase tracking-wider">Total Sponsors:</span>
            <span className="font-data text-sm font-bold text-amber tabular-nums">
              {totalSponsorCount > 0 ? totalSponsorCount.toLocaleString() : '--'}
            </span>
          </div>
          <span className="font-data text-[10px] text-dim">
            <kbd className="rounded border border-border bg-s2 px-1 py-0.5 font-data text-[9px] text-dim mr-1">/</kbd>
            focus
          </span>
        </div>
      </div>

      {/* Large search bar */}
      <form onSubmit={handleSearchSubmit} className="relative group">
        <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchFocused ? 'text-amber' : 'text-dim'}`} />
        <input
          ref={inputRef}
          type="text"
          value={filters.q}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={`Search ${totalSponsorCount > 0 ? totalSponsorCount.toLocaleString() : '...'} UK visa sponsors by organisation name...`}
          className="w-full border border-border bg-s1 py-3 pl-12 pr-24 font-data text-sm text-text placeholder-dim focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/20 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {filters.q && (
            <button
              type="button"
              onClick={clearSearch}
              className="flex h-6 w-6 items-center justify-center text-dim hover:text-amber transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <div className={`font-data text-[11px] px-2 py-0.5 rounded transition-colors ${loading ? 'text-amber animate-pulse' : 'text-dim'}`}>
            {loading ? 'SEARCHING...' : `${results.total.toLocaleString()}`}
          </div>
        </div>
      </form>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearch={() => doSearch(filters, 1)}
        filterOptions={filterOptions}
        activeCount={activeFilterCount}
      />

      {/* Results Table */}
      <div className="border border-border bg-s1">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Organisation Name', 'Rating', 'Route', 'Town/City', 'Jobs', 'Enrichment', 'Score', 'Profile'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-1.5 text-left font-data text-[9px] font-medium uppercase tracking-wider text-dim whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20" style={{ height: '32px' }}>
                    {Array.from({ length: 8 }).map((_, ci) => (
                      <td key={ci} className="px-3">
                        <div className="h-3 animate-pulse rounded bg-s2" style={{ width: `${30 + Math.random() * 50}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : results.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center font-data text-[12px] text-dim">
                    NO SPONSORS FOUND
                  </td>
                </tr>
              ) : (
                results.data.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border/10 transition-colors',
                      idx === selectedRow ? 'bg-amber/5 border-l-2 border-l-amber' : 'hover:bg-s2/30'
                    )}
                    style={{ height: '32px' }}
                    onClick={() => setSelectedRow(idx)}
                  >
                    {/* Name */}
                    <td className="px-3 text-[12px] max-w-[280px]">
                      <Link
                        href={`/company/${row.id}`}
                        className="text-amber hover:text-text transition-colors font-data font-medium truncate block"
                      >
                        {row.organisation_name}
                      </Link>
                    </td>
                    {/* Rating */}
                    <td className="px-3">
                      {row.rating ? (
                        <span className={cn(
                          'inline-block rounded px-1.5 py-0.5 font-data text-[10px] font-bold',
                          row.rating === 'A' ? 'bg-green/15 text-green border border-green/20' : 'bg-red/15 text-red border border-red/20'
                        )}>
                          {row.rating}
                        </span>
                      ) : (
                        <span className="text-dim font-data text-[10px]">--</span>
                      )}
                    </td>
                    {/* Route */}
                    <td className="px-3 max-w-[180px]">
                      {row.route && row.route.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {row.route.slice(0, 2).map((r) => (
                            <span key={r} className="inline-block rounded bg-s3 px-1 py-0.5 font-data text-[9px] text-text truncate max-w-[80px]">
                              {r}
                            </span>
                          ))}
                          {row.route.length > 2 && (
                            <span className="font-data text-[9px] text-dim">+{row.route.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-dim font-data text-[10px]">--</span>
                      )}
                    </td>
                    {/* City */}
                    <td className="px-3 font-data text-[11px] text-dim whitespace-nowrap">
                      {row.town_city || '--'}
                    </td>
                    {/* Jobs Count */}
                    <td className="px-3 font-data text-[11px] tabular-nums text-center">
                      {row.job_count > 0 ? (
                        <span className="text-green font-bold">{row.job_count}</span>
                      ) : (
                        <span className="text-dim">0</span>
                      )}
                    </td>
                    {/* Enrichment Level */}
                    <td className="px-3">
                      {(() => {
                        const { text, color } = enrichmentLabel(row.enrichment_level);
                        return (
                          <span className={cn('font-data text-[9px] font-bold uppercase tracking-wider', color)}>
                            {text}
                          </span>
                        );
                      })()}
                    </td>
                    {/* Score */}
                    <td className="px-3">
                      {row.score !== null ? (
                        <span className={cn(
                          'inline-block rounded px-1.5 py-0.5 font-data text-[10px] font-bold tabular-nums',
                          row.score >= 70 ? 'text-green bg-green/10' : row.score >= 50 ? 'text-amber bg-amber/10' : 'text-red bg-red/10'
                        )}>
                          {row.score}
                        </span>
                      ) : (
                        <span className="text-dim font-data text-[10px]">--</span>
                      )}
                    </td>
                    {/* Profile link */}
                    <td className="px-3">
                      <Link
                        href={`/company/${row.id}`}
                        className="font-data text-[10px] text-cyan hover:text-amber transition-colors uppercase tracking-wider font-bold"
                      >
                        PROFILE
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <div className="flex items-center gap-3">
            <span className="font-data text-[12px] font-bold text-amber">
              {results.total.toLocaleString()} <span className="font-normal text-dim">sponsors</span>
            </span>
            {results.total > 0 && (
              <span className="font-data text-[10px] text-dim">
                showing {fromRow.toLocaleString()}-{toRow.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="flex h-6 w-6 items-center justify-center border border-border text-dim hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="font-data text-[11px] text-dim tabular-nums">
              {page}<span className="text-dim/50">/</span>{results.pages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= results.pages}
              className="flex h-6 w-6 items-center justify-center border border-border text-dim hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
