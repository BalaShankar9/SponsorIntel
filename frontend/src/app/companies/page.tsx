'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, ChevronLeft, ChevronRight, Search, ChevronDown, Database,
  Shield, MapPin, Briefcase, RotateCcw, ExternalLink, X,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { HoverPreview } from '@/components/ui/HoverPreview';

interface CompanyRow {
  id: string;
  organisation_name: string;
  town_city: string | null;
  county: string | null;
  rating: string | null;
  sponsor_type: string | null;
  route: string[] | null;
  is_active: boolean;
  first_seen_date: string | null;
  companies_house_number: string | null;
  company_status: string | null;
  industry_primary: string | null;
  enrichment_level: number | null;
  overall_score: number | null;
  job_count: number;
  website_url: string | null;
  trading_name: string | null;
}

interface StatsData {
  total: number;
  active: number;
  aRated: number;
  bRated: number;
  withJobs: number;
  enriched: number;
  routeCounts: Record<string, number>;
}

const PAGE_SIZES = [25, 50, 100];

const ROUTE_LABELS: Record<string, string> = {
  'Skilled Worker': 'SW',
  'Global Business Mobility - Senior or Specialist Worker': 'GBM-SSW',
  'Global Business Mobility - Graduate Trainee': 'GBM-GT',
  'Global Business Mobility - UK Expansion Worker': 'GBM-UKE',
  'Global Business Mobility - Service Supplier': 'GBM-SS',
  'Global Business Mobility - Secondment Worker': 'GBM-SEC',
  'Minister of Religion': 'MoR',
  'International Sportsperson': 'Sport',
  'Temporary Worker - Creative Worker': 'TW-CW',
  'Temporary Worker - Charity Worker': 'TW-CH',
  'Temporary Worker - Religious Worker': 'TW-RW',
  'Temporary Worker - Government Authorised Exchange': 'TW-GAE',
  'Temporary Worker - International Agreement': 'TW-IA',
  'Temporary Worker - Seasonal Worker': 'TW-SW',
  'Scale-up': 'Scale-up',
};

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (!direction) return <span className="text-dim/30 ml-0.5">&#x25B4;&#x25BE;</span>;
  return <span className="text-amber ml-0.5">{direction === 'asc' ? '\u25B4' : '\u25BE'}</span>;
}

function enrichmentLabel(level: number | null): { text: string; color: string } {
  if (level === null || level === undefined) return { text: 'NONE', color: 'text-dim' };
  if (level >= 80) return { text: 'FULL', color: 'text-green' };
  if (level >= 50) return { text: 'PARTIAL', color: 'text-amber' };
  if (level >= 20) return { text: 'BASIC', color: 'text-cyan' };
  return { text: 'MINIMAL', color: 'text-dim' };
}

export default function CompaniesPage() {
  const [data, setData] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [sponsorTypeFilter, setSponsorTypeFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [withJobsOnly, setWithJobsOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const [sponsorTypes, setSponsorTypes] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0, active: 0, aRated: 0, bRated: 0, withJobs: 0, enriched: 0, routeCounts: {},
  });
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pages = Math.ceil(total / perPage);

  // Load stats + filter options on mount
  useEffect(() => {
    async function loadInit() {
      const [totalRes, activeRes, aRes, bRes, enrichedRes, routesRes, typesRes, jobSponsorsRes] = await Promise.all([
        supabase.from('sponsors').select('id', { count: 'exact', head: true }),
        supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('rating', 'A'),
        supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('rating', 'B'),
        supabase.from('company_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('sponsors').select('route').not('route', 'is', null).limit(5000),
        supabase.from('sponsors').select('sponsor_type').not('sponsor_type', 'is', null).limit(1000),
        supabase.from('jobs').select('sponsor_id').not('sponsor_id', 'is', null).limit(5000),
      ]);

      // Count routes
      const routeCounts: Record<string, number> = {};
      (routesRes.data || []).forEach((r) => {
        const routes = r.route;
        if (Array.isArray(routes)) {
          routes.forEach((route: string) => {
            routeCounts[route] = (routeCounts[route] || 0) + 1;
          });
        }
      });
      const sortedRoutes = Object.keys(routeCounts).sort((a, b) => routeCounts[b] - routeCounts[a]);
      setAvailableRoutes(sortedRoutes);

      // Unique sponsor types
      const types = Array.from(new Set((typesRes.data || []).map((r) => r.sponsor_type as string))).filter(Boolean).sort();
      setSponsorTypes(types);

      // Count sponsors with jobs
      const uniqueJobSponsors = new Set((jobSponsorsRes.data || []).map((r) => r.sponsor_id));

      setStats({
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        aRated: aRes.count || 0,
        bRated: bRes.count || 0,
        withJobs: uniqueJobSponsors.size,
        enriched: enrichedRes.count || 0,
        routeCounts,
      });
    }
    loadInit();
  }, []);

  const fetchCompanies = useCallback(async (p: number) => {
    setLoading(true);
    const from = (p - 1) * perPage;
    const to = from + perPage - 1;

    // If "with jobs only" is active, first get sponsor IDs that have jobs
    let sponsorIdsWithJobs: string[] | null = null;
    if (withJobsOnly) {
      const { data: jobSponsorData } = await supabase
        .from('jobs')
        .select('sponsor_id')
        .not('sponsor_id', 'is', null)
        .limit(5000);
      sponsorIdsWithJobs = Array.from(new Set((jobSponsorData || []).map((j) => j.sponsor_id as string)));
    }

    let query = supabase
      .from('sponsors')
      .select(`
        id, organisation_name, town_city, county, rating, sponsor_type, route, is_active, first_seen_date,
        company_profiles (
          companies_house_number, company_status, industry_primary, enrichment_level, website_url, name_variants
        ),
        sponsor_scores (
          overall_score
        )
      `, { count: 'exact' });

    if (withJobsOnly && sponsorIdsWithJobs) {
      query = query.in('id', sponsorIdsWithJobs);
    }
    if (search) query = query.ilike('organisation_name', `%${search}%`);
    if (citySearch) query = query.or(`town_city.ilike.%${citySearch}%,county.ilike.%${citySearch}%`);
    if (ratingFilter) query = query.eq('rating', ratingFilter);
    if (sponsorTypeFilter) query = query.eq('sponsor_type', sponsorTypeFilter);
    if (routeFilter) query = query.contains('route', [routeFilter]);
    if (activeOnly) query = query.eq('is_active', true);

    query = query.order('organisation_name', { ascending: true }).range(from, to);

    const { data: rows, count, error } = await query;

    let flatData: CompanyRow[];

    if (error) {
      // Fallback without joins
      let fallback = supabase
        .from('sponsors')
        .select('id, organisation_name, town_city, county, rating, sponsor_type, route, is_active, first_seen_date', { count: 'exact' });

      if (search) fallback = fallback.ilike('organisation_name', `%${search}%`);
      if (citySearch) fallback = fallback.or(`town_city.ilike.%${citySearch}%,county.ilike.%${citySearch}%`);
      if (ratingFilter) fallback = fallback.eq('rating', ratingFilter);
      if (sponsorTypeFilter) fallback = fallback.eq('sponsor_type', sponsorTypeFilter);
      if (routeFilter) fallback = fallback.contains('route', [routeFilter]);
      if (activeOnly) fallback = fallback.eq('is_active', true);
      fallback = fallback.order('organisation_name', { ascending: true }).range(from, to);

      const { data: fbRows, count: fbCount } = await fallback;
      flatData = (fbRows || []).map((r) => ({
        ...r,
        companies_house_number: null,
        company_status: null,
        industry_primary: null,
        enrichment_level: null,
        overall_score: null,
        website_url: null,
        trading_name: null,
        job_count: 0,
      } as CompanyRow));
      setTotal(fbCount || 0);
    } else {
      flatData = (rows || []).map((r: Record<string, unknown>) => {
        const profiles = r.company_profiles;
        const profile = Array.isArray(profiles) ? profiles[0] : profiles;
        const scores = r.sponsor_scores;
        const scoreObj = Array.isArray(scores) ? scores[0] : scores;
        return {
          id: r.id,
          organisation_name: r.organisation_name,
          town_city: r.town_city,
          county: r.county,
          rating: r.rating,
          sponsor_type: r.sponsor_type,
          route: r.route,
          is_active: r.is_active,
          first_seen_date: r.first_seen_date,
          companies_house_number: (profile as Record<string, unknown>)?.companies_house_number || null,
          company_status: (profile as Record<string, unknown>)?.company_status || null,
          industry_primary: (profile as Record<string, unknown>)?.industry_primary || null,
          enrichment_level: (profile as Record<string, unknown>)?.enrichment_level || null,
          overall_score: (scoreObj as Record<string, unknown>)?.overall_score || null,
          website_url: (profile as Record<string, unknown>)?.website_url || null,
          trading_name: ((profile as Record<string, unknown>)?.name_variants as Record<string, unknown>)?.trading_name as string || null,
          job_count: 0,
        } as CompanyRow;
      });
      setTotal(count || 0);
    }

    // Fetch job counts for visible sponsors
    const sponsorIds = flatData.map((r) => r.id);
    if (sponsorIds.length > 0) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('sponsor_id')
        .in('sponsor_id', sponsorIds);
      if (jobData) {
        const jobCounts: Record<string, number> = {};
        jobData.forEach((j) => {
          if (j.sponsor_id) jobCounts[j.sponsor_id] = (jobCounts[j.sponsor_id] || 0) + 1;
        });
        flatData = flatData.map((r) => ({ ...r, job_count: jobCounts[r.id] || 0 }));
      }
    }

    setData(flatData);
    setPage(p);
    setSelectedRow(0);
    setLoading(false);
  }, [search, citySearch, ratingFilter, routeFilter, sponsorTypeFilter, activeOnly, withJobsOnly, perPage]);

  useEffect(() => {
    fetchCompanies(1);
  }, [fetchCompanies]);

  const handleSearchInput = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCompanies(1), 400);
  };

  const handleCityInput = (value: string) => {
    setCitySearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCompanies(1), 400);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1);
  };

  const resetFilters = () => {
    setSearch('');
    setCitySearch('');
    setRatingFilter('');
    setRouteFilter('');
    setSponsorTypeFilter('');
    setActiveOnly(true);
    setWithJobsOnly(false);
  };

  const activeFilterCount = [ratingFilter, routeFilter, sponsorTypeFilter, citySearch].filter(Boolean).length + (activeOnly ? 0 : 1) + (withJobsOnly ? 1 : 0);

  // Focus search with / key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const columns = useMemo<ColumnDef<CompanyRow>[]>(() => [
    {
      accessorKey: 'organisation_name',
      header: 'Sponsor Name',
      cell: ({ row }) => (
        <HoverPreview sponsorId={row.original.id}>
          <div className="flex flex-col gap-0">
            <div className="flex items-center gap-1.5">
              <Link href={`/company/${row.original.id}`} className="text-amber hover:text-text transition-colors font-medium truncate max-w-[200px]">
                {row.original.organisation_name}
              </Link>
              {row.original.website_url && (
                <a
                  href={row.original.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dim hover:text-cyan transition-colors shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
            {row.original.trading_name && (
              <span className="text-[9px] text-cyan/70 truncate max-w-[200px]" title={`Trading as: ${row.original.trading_name}`}>
                t/a {row.original.trading_name}
              </span>
            )}
          </div>
        </HoverPreview>
      ),
      size: 230,
    },
    {
      accessorKey: 'rating',
      header: 'Rating',
      cell: ({ getValue }) => {
        const rating = getValue() as string | null;
        if (!rating) return <span className="text-dim text-[10px]">--</span>;
        return (
          <span className={cn(
            'inline-block rounded px-1.5 py-0.5 font-data text-[10px] font-bold',
            rating === 'A' ? 'bg-green/15 text-green border border-green/20' : 'bg-red/15 text-red border border-red/20'
          )}>
            {rating}
          </span>
        );
      },
      size: 55,
    },
    {
      accessorKey: 'route',
      header: 'Visa Routes',
      cell: ({ getValue }) => {
        const routes = getValue() as string[] | null;
        if (!routes || routes.length === 0) return <span className="text-dim text-[10px]">--</span>;
        return (
          <div className="flex flex-wrap gap-0.5">
            {routes.map((r) => (
              <span
                key={r}
                className="inline-block rounded bg-cyan/10 border border-cyan/20 px-1 py-0.5 font-data text-[8px] text-cyan truncate max-w-[80px]"
                title={r}
              >
                {ROUTE_LABELS[r] || r.split(' ').slice(0, 2).join(' ')}
              </span>
            ))}
          </div>
        );
      },
      size: 170,
    },
    {
      accessorKey: 'sponsor_type',
      header: 'Type',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <span className="inline-block rounded bg-s3 px-1.5 py-0.5 font-data text-[9px] text-text">{v}</span>
        ) : <span className="text-dim text-[10px]">--</span>;
      },
      size: 90,
    },
    {
      accessorKey: 'town_city',
      header: 'Location',
      cell: ({ row }) => {
        const city = row.original.town_city;
        const county = row.original.county;
        if (!city && !county) return <span className="text-dim text-[10px]">--</span>;
        return (
          <div className="font-data text-[11px]">
            <span className="text-text">{city || '--'}</span>
            {county && <span className="text-dim">, {county}</span>}
          </div>
        );
      },
      size: 130,
    },
    {
      accessorKey: 'job_count',
      header: 'Jobs',
      cell: ({ row }) => {
        const count = row.original.job_count;
        return count > 0 ? (
          <Link
            href={`/jobs?company=${encodeURIComponent(row.original.organisation_name)}`}
            className="font-data text-[11px] font-bold text-green tabular-nums hover:text-amber transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {count}
          </Link>
        ) : (
          <span className="font-data text-[11px] text-dim tabular-nums">0</span>
        );
      },
      size: 45,
    },
    {
      accessorKey: 'industry_primary',
      header: 'Industry',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <span className="font-data text-[10px] text-dim truncate max-w-[100px] block" title={v}>{v}</span>
        ) : <span className="text-dim text-[10px]">--</span>;
      },
      size: 110,
    },
    {
      id: 'profile',
      header: '',
      cell: ({ row }) => (
        <Link
          href={`/company/${row.original.id}`}
          className="font-data text-[9px] text-cyan hover:text-amber transition-colors uppercase tracking-wider font-bold"
        >
          VIEW
        </Link>
      ),
      size: 40,
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedRow((prev) => Math.min(prev + 1, data.length - 1));
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedRow((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && data[selectedRow]) {
      router.push(`/company/${data[selectedRow].id}`);
    }
  }, [data, selectedRow, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const fromRow = data.length > 0 ? (page - 1) * perPage + 1 : 0;
  const toRow = fromRow + data.length - 1;

  // Top route chips (show the most common routes)
  const topRoutes = availableRoutes.slice(0, 8);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber/30 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber" />
            <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
              SPONSOR LICENCE REGISTER
            </h1>
          </div>
          <p className="font-data text-[10px] text-dim mt-0.5">
            EVERY UK VISA SPONSOR COMPANY // LIVE FROM HOME OFFICE REGISTER // UPDATED DAILY
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-s1 border border-amber/30 px-3 py-1.5">
            <Database size={11} className="text-amber" />
            <span className="font-data text-sm font-bold text-amber tabular-nums">{stats.total.toLocaleString()}</span>
            <span className="font-data text-[10px] text-dim">licensed sponsors</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-6 gap-px bg-border">
        {[
          { label: 'TOTAL', value: stats.total.toLocaleString(), color: 'text-amber' },
          { label: 'ACTIVE', value: stats.active.toLocaleString(), color: 'text-green' },
          { label: 'A-RATED', value: stats.aRated.toLocaleString(), color: 'text-green' },
          { label: 'B-RATED', value: stats.bRated.toLocaleString(), color: 'text-red' },
          { label: 'WITH JOBS', value: stats.withJobs.toLocaleString(), color: 'text-cyan' },
          { label: 'ENRICHED', value: stats.enriched.toLocaleString(), color: 'text-purple' },
        ].map((s) => (
          <div key={s.label} className="bg-s1 px-3 py-2 text-center">
            <p className={cn('font-data text-lg font-bold tabular-nums', s.color)}>{s.value}</p>
            <p className="font-data text-[8px] text-dim uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Route quick-filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-data text-[9px] text-dim uppercase tracking-wider mr-1">VISA ROUTES:</span>
        <button
          onClick={() => setRouteFilter('')}
          className={cn(
            'h-6 px-2 font-data text-[9px] uppercase tracking-wider border transition-colors',
            !routeFilter
              ? 'border-amber bg-amber/10 text-amber'
              : 'border-border bg-s1 text-dim hover:border-amber/30 hover:text-text'
          )}
        >
          ALL
        </button>
        {topRoutes.map((route) => (
          <button
            key={route}
            onClick={() => setRouteFilter(routeFilter === route ? '' : route)}
            className={cn(
              'h-6 px-2 font-data text-[9px] uppercase tracking-wider border transition-colors',
              routeFilter === route
                ? 'border-cyan bg-cyan/10 text-cyan'
                : 'border-border bg-s1 text-dim hover:border-cyan/30 hover:text-text'
            )}
            title={`${route} (${(stats.routeCounts[route] || 0).toLocaleString()})`}
          >
            {ROUTE_LABELS[route] || route.split(' ').slice(0, 2).join(' ')}
            <span className="ml-1 text-dim/60">{(stats.routeCounts[route] || 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Search + filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search by company name..."
            className="w-full border border-border bg-s1 py-1.5 pl-8 pr-8 font-data text-[12px] text-text placeholder-dim focus:border-amber focus:outline-none transition-colors"
          />
          {search && (
            <button type="button" onClick={() => { setSearch(''); fetchCompanies(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-dim hover:text-amber">
              <X size={12} />
            </button>
          )}
        </form>

        <div className="relative min-w-[160px]">
          <MapPin size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={citySearch}
            onChange={(e) => handleCityInput(e.target.value)}
            placeholder="City or county..."
            className="w-full border border-border bg-s1 py-1.5 pl-7 pr-2 font-data text-[11px] text-text placeholder-dim focus:border-amber focus:outline-none transition-colors"
          />
        </div>

        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className={cn(
            'h-7 border bg-s1 px-2 font-data text-[11px] text-text focus:border-amber focus:outline-none appearance-none cursor-pointer transition-colors',
            ratingFilter ? 'border-amber/60 text-amber' : 'border-border hover:border-amber/30'
          )}
        >
          <option value="">All Ratings</option>
          <option value="A">A-Rated</option>
          <option value="B">B-Rated</option>
        </select>

        <select
          value={sponsorTypeFilter}
          onChange={(e) => setSponsorTypeFilter(e.target.value)}
          className={cn(
            'h-7 border bg-s1 px-2 font-data text-[11px] text-text focus:border-amber focus:outline-none appearance-none cursor-pointer transition-colors',
            sponsorTypeFilter ? 'border-amber/60 text-amber' : 'border-border hover:border-amber/30'
          )}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Sponsor Types</option>
          {sponsorTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={cn(
            'h-7 px-2.5 font-data text-[10px] uppercase tracking-wider border transition-colors',
            activeOnly
              ? 'border-green/60 bg-green/10 text-green'
              : 'border-border bg-s1 text-dim hover:border-green/30'
          )}
        >
          ACTIVE ONLY
        </button>

        <button
          onClick={() => setWithJobsOnly(!withJobsOnly)}
          className={cn(
            'h-7 px-2.5 font-data text-[10px] uppercase tracking-wider border transition-colors',
            withJobsOnly
              ? 'border-cyan/60 bg-cyan/10 text-cyan'
              : 'border-border bg-s1 text-dim hover:border-cyan/30'
          )}
        >
          WITH JOBS
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex h-7 items-center gap-1 border border-border bg-s1 px-2 font-data text-[10px] text-dim hover:border-red/50 hover:text-red transition-colors"
          >
            <RotateCcw size={10} />
            RESET ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Active filter info */}
      {(routeFilter || citySearch) && (
        <div className="flex items-center gap-2 font-data text-[10px] text-dim">
          {routeFilter && (
            <span className="inline-flex items-center gap-1 bg-cyan/10 border border-cyan/20 px-2 py-0.5 text-cyan">
              Route: {routeFilter}
              <button onClick={() => setRouteFilter('')} className="hover:text-amber"><X size={9} /></button>
            </span>
          )}
          {citySearch && (
            <span className="inline-flex items-center gap-1 bg-amber/10 border border-amber/20 px-2 py-0.5 text-amber">
              Location: {citySearch}
              <button onClick={() => { setCitySearch(''); fetchCompanies(1); }} className="hover:text-red"><X size={9} /></button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border border-border bg-s1">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => {
                    const isSorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                        style={{ width: header.getSize() }}
                        className={cn(
                          'px-3 py-1.5 text-left font-data text-[9px] font-medium uppercase tracking-wider cursor-pointer select-none whitespace-nowrap',
                          isSorted ? 'text-amber border-b border-amber' : 'text-dim hover:text-text'
                        )}
                      >
                        <span className="flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <SortIndicator direction={isSorted} />}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: perPage > 25 ? 20 : 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20" style={{ height: '30px' }}>
                    {columns.map((_, ci) => (
                      <td key={ci} className="px-3">
                        <div className="h-3 animate-pulse rounded bg-s2" style={{ width: `${40 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <Building2 size={24} className="mx-auto text-dim/30 mb-2" />
                    <p className="font-data text-[12px] text-dim">NO SPONSORS MATCH YOUR FILTERS</p>
                    <button onClick={resetFilters} className="mt-2 font-data text-[10px] text-amber hover:text-text transition-colors">
                      RESET FILTERS
                    </button>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border/10 transition-colors',
                      idx === selectedRow ? 'bg-amber/5 border-l-2 border-l-amber' : 'hover:bg-s2/40'
                    )}
                    style={{ height: '32px' }}
                    onClick={() => setSelectedRow(idx)}
                    onDoubleClick={() => router.push(`/company/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 text-[12px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with pagination */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <div className="flex items-center gap-3">
            <span className="font-data text-[12px] font-bold text-amber">
              {total.toLocaleString()} <span className="font-normal text-dim">sponsors</span>
            </span>
            {total > 0 && (
              <span className="font-data text-[10px] text-dim">
                showing {fromRow.toLocaleString()}-{toRow.toLocaleString()}
              </span>
            )}
            <span className="font-data text-[9px] text-dim">
              <kbd className="rounded border border-border bg-s2 px-1 py-0.5 font-data text-[8px] mr-0.5">j/k</kbd>
              navigate
              <kbd className="rounded border border-border bg-s2 px-1 py-0.5 font-data text-[8px] mx-0.5">Enter</kbd>
              open
              <kbd className="rounded border border-border bg-s2 px-1 py-0.5 font-data text-[8px] mx-0.5">/</kbd>
              search
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="font-data text-[10px] text-dim">Per page</span>
              <div className="relative">
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="h-6 border border-border bg-s1 px-1.5 pr-5 font-data text-[10px] text-text focus:border-amber focus:outline-none appearance-none cursor-pointer hover:border-amber/30 transition-colors"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
              </div>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCompanies(page - 1)}
                disabled={page <= 1}
                className="flex h-6 w-6 items-center justify-center border border-border text-dim hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="font-data text-[11px] text-dim tabular-nums">
                {page}<span className="text-dim/50">/</span>{pages}
              </span>
              <button
                onClick={() => fetchCompanies(page + 1)}
                disabled={page >= pages}
                className="flex h-6 w-6 items-center justify-center border border-border text-dim hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
