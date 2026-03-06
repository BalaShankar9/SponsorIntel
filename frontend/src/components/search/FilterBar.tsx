'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Search, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { FilterOptions } from '@/types';

export interface SearchFilters {
  q: string;
  city: string;
  county: string;
  rating: string;
  route: string;
  industry: string;
  score_min: number;
  score_max: number;
  has_jobs: boolean;
  active_only: boolean;
  on_shortage_list: boolean;
}

const defaultFilters: SearchFilters = {
  q: '',
  city: '',
  county: '',
  rating: '',
  route: '',
  industry: '',
  score_min: 0,
  score_max: 100,
  has_jobs: false,
  active_only: true,
  on_shortage_list: false,
};

interface FilterBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  filterOptions: FilterOptions | null;
}

export function FilterBar({ filters, onFiltersChange, onSearch, filterOptions }: FilterBarProps) {
  const [expanded, setExpanded] = useState(true);

  const update = (partial: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const reset = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <div className="rounded-lg border border-border bg-s1">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-text">Filters</span>
        {expanded ? <ChevronUp size={16} className="text-dim" /> : <ChevronDown size={16} className="text-dim" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {/* Row 1: text + dropdowns */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Input
              label="Company Name"
              placeholder="Search..."
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
            />
            <Select
              label="City"
              placeholder="All Cities"
              value={filters.city}
              onChange={(e) => update({ city: e.target.value })}
              options={(filterOptions?.cities || []).map((c) => ({ value: c, label: c }))}
            />
            <Select
              label="County"
              placeholder="All Counties"
              value={filters.county}
              onChange={(e) => update({ county: e.target.value })}
              options={(filterOptions?.counties || []).map((c) => ({ value: c, label: c }))}
            />
            <Select
              label="Rating"
              placeholder="All Ratings"
              value={filters.rating}
              onChange={(e) => update({ rating: e.target.value })}
              options={[
                { value: 'A', label: 'A-Rated' },
                { value: 'B', label: 'B-Rated' },
              ]}
            />
            <Select
              label="Route"
              placeholder="All Routes"
              value={filters.route}
              onChange={(e) => update({ route: e.target.value })}
              options={(filterOptions?.routes || []).map((r) => ({ value: r, label: r }))}
            />
            <Select
              label="Industry"
              placeholder="All Industries"
              value={filters.industry}
              onChange={(e) => update({ industry: e.target.value })}
              options={(filterOptions?.industries || []).map((i) => ({ value: i, label: i }))}
            />
          </div>

          {/* Row 2: score range + checkboxes */}
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="flex items-end gap-2">
              <Input
                label="Score Min"
                type="number"
                min={0}
                max={100}
                value={filters.score_min}
                onChange={(e) => update({ score_min: Number(e.target.value) })}
                className="w-20"
              />
              <span className="pb-2 text-dim">-</span>
              <Input
                label="Score Max"
                type="number"
                min={0}
                max={100}
                value={filters.score_max}
                onChange={(e) => update({ score_max: Number(e.target.value) })}
                className="w-20"
              />
            </div>

            <label className="flex items-center gap-2 pb-2 text-sm text-dim">
              <input
                type="checkbox"
                checked={filters.has_jobs}
                onChange={(e) => update({ has_jobs: e.target.checked })}
                className="rounded border-border bg-s2"
              />
              Has Jobs
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-dim">
              <input
                type="checkbox"
                checked={filters.active_only}
                onChange={(e) => update({ active_only: e.target.checked })}
                className="rounded border-border bg-s2"
              />
              Active Only
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-dim">
              <input
                type="checkbox"
                checked={filters.on_shortage_list}
                onChange={(e) => update({ on_shortage_list: e.target.checked })}
                className="rounded border-border bg-s2"
              />
              On Shortage List
            </label>

            <div className="ml-auto flex gap-2 pb-1">
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw size={14} />
                Reset
              </Button>
              <Button variant="ghost" size="sm">
                <Save size={14} />
                Save
              </Button>
              <Button variant="primary" size="sm" onClick={onSearch}>
                <Search size={14} />
                Search
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { defaultFilters };
