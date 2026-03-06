'use client';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Search, RotateCcw } from 'lucide-react';

export interface JobFilterValues {
  search: string;
  company: string;
  city: string;
  source: string;
  salaryMin: string;
  salaryMax: string;
  sponsorshipMin: number;
  contractType: string;
  seniority: string;
  shortageOnly: boolean;
  meetsThreshold: boolean;
}

interface JobFiltersProps {
  filters: JobFilterValues;
  onChange: (filters: JobFilterValues) => void;
  onReset: () => void;
}

const sourceOptions = [
  { value: '', label: 'All Sources' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'reed', label: 'Reed' },
  { value: 'totaljobs', label: 'Totaljobs' },
  { value: 'glassdoor', label: 'Glassdoor' },
  { value: 'gov_find_a_job', label: 'Find a Job (Gov)' },
];

const contractOptions = [
  { value: '', label: 'All Types' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'part-time', label: 'Part-time' },
];

const seniorityOptions = [
  { value: '', label: 'All Levels' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'director', label: 'Director' },
  { value: 'executive', label: 'Executive' },
];

export function JobFilters({ filters, onChange, onReset }: JobFiltersProps) {
  const update = (partial: Partial<JobFilterValues>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <Card>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim2" />
          <input
            type="text"
            placeholder="Search job titles..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full rounded-md border border-border bg-s2 py-2 pl-9 pr-3 text-sm text-text placeholder-dim2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Company..."
            value={filters.company}
            onChange={(e) => update({ company: e.target.value })}
          />
          <Input
            placeholder="City..."
            value={filters.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </div>

        <Select
          options={sourceOptions}
          value={filters.source}
          onChange={(e) => update({ source: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Min Salary"
            type="number"
            value={filters.salaryMin}
            onChange={(e) => update({ salaryMin: e.target.value })}
          />
          <Input
            placeholder="Max Salary"
            type="number"
            value={filters.salaryMax}
            onChange={(e) => update({ salaryMax: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-dim">
            Min Sponsorship: {filters.sponsorshipMin}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.sponsorshipMin}
            onChange={(e) => update({ sponsorshipMin: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            options={contractOptions}
            value={filters.contractType}
            onChange={(e) => update({ contractType: e.target.value })}
          />
          <Select
            options={seniorityOptions}
            value={filters.seniority}
            onChange={(e) => update({ seniority: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-dim">
            <input
              type="checkbox"
              checked={filters.shortageOnly}
              onChange={(e) => update({ shortageOnly: e.target.checked })}
              className="rounded border-border accent-accent"
            />
            Shortage list only
          </label>
          <label className="flex items-center gap-2 text-sm text-dim">
            <input
              type="checkbox"
              checked={filters.meetsThreshold}
              onChange={(e) => update({ meetsThreshold: e.target.checked })}
              className="rounded border-border accent-accent"
            />
            Meets salary threshold
          </label>
        </div>

        <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
          <RotateCcw size={14} /> Reset Filters
        </Button>
      </div>
    </Card>
  );
}
