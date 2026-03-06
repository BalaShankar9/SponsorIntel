'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { FilterBar, defaultFilters, type SearchFilters } from '@/components/search/FilterBar';
import { ResultsTable } from '@/components/search/ResultsTable';
import { ExportButton } from '@/components/search/ExportButton';
import type { PaginatedSponsors, FilterOptions } from '@/types';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    q: searchParams.get('q') || '',
  });
  const [results, setResults] = useState<PaginatedSponsors>({ data: [], total: 0, page: 1, pages: 0 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Load filter options
  useEffect(() => {
    api.get<FilterOptions>('/api/v1/analytics/filter-options')
      .then(setFilterOptions)
      .catch(console.error);
  }, []);

  const doSearch = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.city) params.set('city', filters.city);
      if (filters.county) params.set('county', filters.county);
      if (filters.rating) params.set('rating', filters.rating);
      if (filters.route) params.set('route', filters.route);
      if (filters.industry) params.set('industry', filters.industry);
      if (filters.score_min > 0) params.set('score_min', String(filters.score_min));
      if (filters.score_max < 100) params.set('score_max', String(filters.score_max));
      if (filters.has_jobs) params.set('has_jobs', 'true');
      if (filters.active_only) params.set('active_only', 'true');
      if (filters.on_shortage_list) params.set('on_shortage_list', 'true');
      params.set('page', String(p));
      params.set('per_page', '25');

      const data = await api.get<PaginatedSponsors>(`/api/v1/sponsors?${params.toString()}`);
      setResults(data);
      setPage(p);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial search
  useEffect(() => {
    doSearch(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (newPage: number) => {
    doSearch(newPage);
  };

  const handleExportCSV = () => {
    window.open(`/api/v1/sponsors/export?format=csv&q=${filters.q}`, '_blank');
  };

  const handleExportXLSX = () => {
    window.open(`/api/v1/sponsors/export?format=xlsx&q=${filters.q}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Search & Explore</h1>
          <p className="text-sm text-dim">Find and filter UK visa sponsor companies</p>
        </div>
        <ExportButton onExportCSV={handleExportCSV} onExportXLSX={handleExportXLSX} />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={() => doSearch(1)}
        filterOptions={filterOptions}
      />

      {/* Results */}
      <ResultsTable
        data={results.data}
        total={results.total}
        page={page}
        pages={results.pages}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
}
