'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilterOptions } from '@/types';

export interface SearchFilters {
  q: string;
  city: string;
  county: string;
  rating: string;
  route: string;
  sponsor_type: string;
  active_only: boolean;
}

const defaultFilters: SearchFilters = {
  q: '',
  city: '',
  county: '',
  rating: '',
  route: '',
  sponsor_type: '',
  active_only: true,
};

interface FilterBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  filterOptions: FilterOptions | null;
  activeCount?: number;
}

function TerminalSelect({
  value,
  onChange,
  options,
  placeholder,
  active,
}: {
  value: string;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  active?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-7 border bg-s1 px-2 font-data text-[11px] text-text focus:border-amber focus:outline-none appearance-none cursor-pointer transition-colors',
        active ? 'border-amber/60 text-amber' : 'border-border hover:border-amber/30'
      )}
      style={{ minWidth: '120px' }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-7 border px-2.5 font-data text-[10px] uppercase tracking-wider transition-colors',
        active
          ? 'border-amber/60 bg-amber/10 text-amber'
          : 'border-border bg-s1 text-dim hover:border-amber/30 hover:text-text'
      )}
    >
      {label}
    </button>
  );
}

export function FilterBar({ filters, onFiltersChange, onSearch, filterOptions, activeCount = 0 }: FilterBarProps) {
  const update = (partial: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const reset = () => {
    onFiltersChange({ ...defaultFilters, q: filters.q });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center gap-1.5 mr-1">
        <SlidersHorizontal size={12} className="text-dim" />
        <span className="font-data text-[10px] text-dim uppercase tracking-wider">Filters</span>
        {activeCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber/20 font-data text-[9px] font-bold text-amber">
            {activeCount}
          </span>
        )}
      </div>

      <TerminalSelect
        value={filters.city}
        onChange={(val) => update({ city: val })}
        options={(filterOptions?.cities || []).map((c) => ({ value: c, label: c }))}
        placeholder="All Cities"
        active={!!filters.city}
      />
      <TerminalSelect
        value={filters.rating}
        onChange={(val) => update({ rating: val })}
        options={[
          { value: 'A', label: 'A-Rated' },
          { value: 'B', label: 'B-Rated' },
        ]}
        placeholder="All Ratings"
        active={!!filters.rating}
      />
      <TerminalSelect
        value={filters.sponsor_type}
        onChange={(val) => update({ sponsor_type: val })}
        options={(filterOptions?.sponsor_types || []).map((t) => ({ value: t, label: t }))}
        placeholder="All Types"
        active={!!filters.sponsor_type}
      />
      <TerminalSelect
        value={filters.route}
        onChange={(val) => update({ route: val })}
        options={(filterOptions?.routes || []).map((r) => ({ value: r, label: r }))}
        placeholder="All Routes"
        active={!!filters.route}
      />

      <div className="h-4 w-px bg-border mx-1" />

      <FilterChip
        label="Active Only"
        active={filters.active_only}
        onClick={() => update({ active_only: !filters.active_only })}
      />

      {activeCount > 0 && (
        <button
          onClick={reset}
          className="flex h-7 items-center gap-1 border border-border bg-s1 px-2 font-data text-[10px] text-dim hover:border-red/50 hover:text-red transition-colors"
        >
          <RotateCcw size={10} />
          CLEAR
        </button>
      )}
    </div>
  );
}

export { defaultFilters };
