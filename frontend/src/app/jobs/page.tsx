'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { JobFilters, type JobFilterValues } from '@/components/jobs/JobFilters';
import { JobTable } from '@/components/jobs/JobTable';
import { JobStatsPanel } from '@/components/jobs/JobStats';
import { Tabs } from '@/components/ui/Tabs';
import type { PaginatedJobs, JobStats } from '@/types';

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

const tabs = [
  { id: 'browse', label: 'Browse Jobs' },
  { id: 'stats', label: 'Statistics' },
];

export default function JobsPage() {
  const [filters, setFilters] = useState<JobFilterValues>(defaultFilters);
  const [jobs, setJobs] = useState<PaginatedJobs | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.search) params.set('q', filters.search);
        if (filters.company) params.set('company', filters.company);
        if (filters.city) params.set('city', filters.city);
        if (filters.source) params.set('source', filters.source);
        if (filters.salaryMin) params.set('salary_min', filters.salaryMin);
        if (filters.salaryMax) params.set('salary_max', filters.salaryMax);
        if (filters.sponsorshipMin > 0) params.set('sponsorship_min', String(filters.sponsorshipMin));
        if (filters.contractType) params.set('contract_type', filters.contractType);
        if (filters.seniority) params.set('seniority', filters.seniority);
        if (filters.shortageOnly) params.set('shortage_only', 'true');
        if (filters.meetsThreshold) params.set('meets_threshold', 'true');

        const qs = params.toString();
        const [jobsData, statsData] = await Promise.all([
          api.get<PaginatedJobs>(`/api/v1/jobs?${qs}`),
          api.get<JobStats>('/api/v1/jobs/stats'),
        ]);
        setJobs(jobsData);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [filters]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Job Intelligence</h1>
        <p className="text-sm text-dim">Visa-sponsorship jobs across the UK</p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div>
          <JobFilters
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(defaultFilters)}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'browse' ? (
            <JobTable jobs={jobs?.data || []} loading={loading} />
          ) : (
            <JobStatsPanel stats={stats} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
