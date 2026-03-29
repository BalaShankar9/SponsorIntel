'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { JobFilters, type JobFilterValues } from '@/components/jobs/JobFilters';
import { JobTable } from '@/components/jobs/JobTable';
import { JobStatsPanel } from '@/components/jobs/JobStats';
import type { PaginatedJobs, JobStats } from '@/types';
import { formatNumber } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE = 50;

const defaultFilters: JobFilterValues = {
  search: '',
  company: '',
  city: '',
  source: '',
  salaryMin: '',
  salaryMax: '',
  sponsorshipMin: 0,
  contractType: '',
  seniority: '',
  shortageOnly: false,
  meetsThreshold: false,
};

export default function JobsPage() {
  const [filters, setFilters] = useState<JobFilterValues>(defaultFilters);
  const [jobs, setJobs] = useState<PaginatedJobs | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'browse' | 'stats'>('browse');

  const fetchJobs = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('jobs')
        .select('id,title_raw,company_name_raw,location_raw,location_city,salary_min,salary_max,salary_text_raw,salary_currency,salary_period,source,source_url,sponsorship_likelihood,posted_date,description_snippet,skills_extracted,contract_type,seniority,work_model,is_on_shortage_list,meets_salary_threshold,sponsor_id,data_quality_score', { count: 'exact' })
        .order('posted_date', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (filters.search) query = query.or(`title_raw.ilike.%${filters.search}%,company_name_raw.ilike.%${filters.search}%`);
      if (filters.company) query = query.ilike('company_name_raw', `%${filters.company}%`);
      if (filters.city) query = query.or(`location_raw.ilike.%${filters.city}%,location_city.ilike.%${filters.city}%`);
      if (filters.source) query = query.eq('source', filters.source);
      if (filters.salaryMin) query = query.gte('salary_min', parseInt(filters.salaryMin));
      if (filters.salaryMax) query = query.lte('salary_max', parseInt(filters.salaryMax));
      if (filters.sponsorshipMin > 0) query = query.gte('sponsorship_likelihood', filters.sponsorshipMin);
      if (filters.shortageOnly) query = query.eq('is_on_shortage_list', true);
      if (filters.meetsThreshold) query = query.eq('meets_salary_threshold', true);

      const { data, count } = await query;

      const totalCount = count || 0;
      setJobs({
        data: data || [],
        total: totalCount,
        page: currentPage,
        pages: Math.ceil(totalCount / PAGE_SIZE),
      });
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setJobs({ data: [], total: 0, page: 1, pages: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch stats once on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const [totalRes, sponsRes, salaryRes, sourceRes, recentRes, cityRes] = await Promise.all([
          supabase.from('jobs').select('id', { count: 'exact', head: true }),
          supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('sponsorship_likelihood', 70),
          supabase.from('jobs').select('salary_min').not('salary_min', 'is', null).gt('salary_min', 100).limit(2000),
          supabase.from('jobs').select('source').limit(10000),
          supabase.from('jobs').select('id', { count: 'exact', head: true })
            .gte('posted_date', new Date(Date.now() - 7 * 86400000).toISOString()),
          supabase.from('jobs').select('location_city').not('location_city', 'is', null).limit(10000),
        ]);

        const salaries = (salaryRes.data || [])
          .map((r: { salary_min: number }) => r.salary_min)
          .sort((a: number, b: number) => a - b);
        const medianSalary = salaries.length > 0 ? salaries[Math.floor(salaries.length / 2)] : null;

        const bySource: Record<string, number> = {};
        (sourceRes.data || []).forEach((j: { source: string }) => {
          bySource[j.source] = (bySource[j.source] || 0) + 1;
        });

        const byCity: Record<string, number> = {};
        (cityRes.data || []).forEach((j: { location_city: string }) => {
          if (j.location_city) byCity[j.location_city] = (byCity[j.location_city] || 0) + 1;
        });
        const topCities = Object.entries(byCity)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)
          .map(([city, count]) => ({ city, count }));

        setStats({
          total_active: totalRes.count || 0,
          new_7_days: recentRes.count || 0,
          sponsorship_likely_count: sponsRes.count || 0,
          median_salary: medianSalary,
          by_source: bySource,
          by_city: topCities,
        });
      } catch (err) {
        console.error('Stats fetch error:', err);
      }
    }
    fetchStats();
  }, []);

  // Fetch jobs when page or filters change
  useEffect(() => {
    fetchJobs(page);
  }, [page, fetchJobs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = jobs?.pages || 0;
  const sponsorshipPct = stats && stats.total_active > 0
    ? Math.round((stats.sponsorship_likely_count / stats.total_active) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Terminal Header */}
      <div className="border-b border-amber/30 pb-2">
        <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
          JOB INTELLIGENCE
        </h1>
        <p className="font-data text-xs text-dim">
          VISA-SPONSORSHIP JOBS // UK MARKET // LIVE FEED
        </p>
      </div>

      {/* Hero Stat Bar */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">TOTAL JOBS</p>
          <p className="font-data text-2xl font-bold text-amber tabular-nums">
            {stats ? formatNumber(stats.total_active) : '--'}
          </p>
        </div>
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">SPONSORSHIP LIKELY</p>
          <p className="font-data text-2xl font-bold text-green tabular-nums">
            {stats ? formatNumber(stats.sponsorship_likely_count) : '--'}
            <span className="ml-1 text-sm text-dim">({sponsorshipPct}%)</span>
          </p>
        </div>
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">MEDIAN SALARY</p>
          <p className="font-data text-2xl font-bold text-cyan tabular-nums">
            {stats?.median_salary ? `£${formatNumber(stats.median_salary)}` : '--'}
          </p>
        </div>
        <div className="bg-s1 px-4 py-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-dim">NEW 7D</p>
          <p className="font-data text-2xl font-bold text-text tabular-nums">
            {stats ? `+${formatNumber(stats.new_7_days)}` : '--'}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-px border-b border-s3">
        <button
          onClick={() => setActiveTab('browse')}
          className={`font-data px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'browse'
              ? 'border-b-2 border-amber bg-s1 text-amber'
              : 'text-dim hover:text-text'
          }`}
        >
          BROWSE JOBS
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`font-data px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
            activeTab === 'stats'
              ? 'border-b-2 border-amber bg-s1 text-amber'
              : 'text-dim hover:text-text'
          }`}
        >
          STATISTICS
        </button>
      </div>

      {/* Filters Row */}
      <JobFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />

      {/* Main Content */}
      {activeTab === 'browse' ? (
        <>
          {/* Results count + pagination info */}
          <div className="flex items-center justify-between px-1">
            <span className="font-data text-[10px] text-dim uppercase tracking-wider">
              {jobs ? `${formatNumber(jobs.total)} results — page ${page} of ${totalPages}` : 'Loading...'}
            </span>
            <span className="font-data text-[10px] text-dim">
              Showing {jobs ? `${((page - 1) * PAGE_SIZE) + 1}–${Math.min(page * PAGE_SIZE, jobs.total)}` : '--'}
            </span>
          </div>

          <JobTable jobs={jobs?.data || []} loading={loading} />

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="flex items-center gap-0.5 border border-s3 bg-s1 px-2 py-1.5 font-data text-[10px] text-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={12} /> FIRST
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-0.5 border border-s3 bg-s1 px-2 py-1.5 font-data text-[10px] text-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={12} /> PREV
              </button>

              {/* Page numbers */}
              {(() => {
                const pages: number[] = [];
                const start = Math.max(1, page - 3);
                const end = Math.min(totalPages, page + 3);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`border px-2.5 py-1.5 font-data text-[10px] tabular-nums transition-colors ${
                      p === page
                        ? 'border-amber bg-amber/10 text-amber font-bold'
                        : 'border-s3 bg-s1 text-dim hover:border-amber hover:text-amber'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-0.5 border border-s3 bg-s1 px-2 py-1.5 font-data text-[10px] text-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed"
              >
                NEXT <ChevronRight size={12} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="flex items-center gap-0.5 border border-s3 bg-s1 px-2 py-1.5 font-data text-[10px] text-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed"
              >
                LAST <ChevronsRight size={12} />
              </button>
            </div>
          )}
        </>
      ) : (
        <JobStatsPanel stats={stats} loading={!stats} />
      )}
    </div>
  );
}
