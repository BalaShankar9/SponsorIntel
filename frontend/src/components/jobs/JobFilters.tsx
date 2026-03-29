'use client';

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
  { value: '', label: 'ALL SOURCES' },
  { value: 'indeed', label: 'INDEED' },
  { value: 'linkedin', label: 'LINKEDIN' },
  { value: 'reed', label: 'REED' },
  { value: 'totaljobs', label: 'TOTALJOBS' },
  { value: 'glassdoor', label: 'GLASSDOOR' },
  { value: 'gov_find_a_job', label: 'GOV.UK FINDAJOB' },
  { value: 'devitjobs', label: 'DEVITJOBS' },
  { value: 'themuse', label: 'THE MUSE' },
  { value: 'remotive', label: 'REMOTIVE' },
  { value: 'remoteok', label: 'REMOTEOK' },
  { value: 'arbeitnow', label: 'ARBEITNOW' },
  { value: 'jobicy', label: 'JOBICY' },
  { value: 'himalayas', label: 'HIMALAYAS' },
  { value: 'wwr', label: 'WWR' },
  { value: 'hn_hiring', label: 'HN HIRING' },
  { value: 'adzuna', label: 'ADZUNA' },
  { value: 'jooble', label: 'JOOBLE' },
  { value: 'charityjob', label: 'CHARITYJOB' },
  { value: 'nhs_jobs', label: 'NHS JOBS' },
  { value: 'teaching_vacancies', label: 'TEACHING' },
  { value: 'cwjobs', label: 'CWJOBS' },
  { value: 'guardian', label: 'GUARDIAN' },
  { value: 'career_page', label: 'CAREER PAGE' },
];

export function JobFilters({ filters, onChange, onReset }: JobFiltersProps) {
  const update = (partial: Partial<JobFilterValues>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border border-s3 bg-s1 p-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-amber" />
        <input
          type="text"
          placeholder="JOB TITLE OR KEYWORD..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full border border-s3 bg-bg py-1.5 pl-7 pr-2 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
        />
      </div>

      {/* Company */}
      <input
        type="text"
        placeholder="COMPANY..."
        value={filters.company}
        onChange={(e) => update({ company: e.target.value })}
        className="w-32 border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
      />

      {/* Location */}
      <input
        type="text"
        placeholder="CITY / COUNTRY..."
        value={filters.city}
        onChange={(e) => update({ city: e.target.value })}
        className="w-36 border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
      />

      {/* Source */}
      <select
        value={filters.source}
        onChange={(e) => update({ source: e.target.value })}
        className="border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text focus:border-amber focus:outline-none"
      >
        {sourceOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Salary Range */}
      <div className="flex items-center gap-1">
        <span className="font-data text-[10px] text-dim">SAL:</span>
        <input
          type="number"
          placeholder="MIN"
          value={filters.salaryMin}
          onChange={(e) => update({ salaryMin: e.target.value })}
          className="w-20 border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
        />
        <span className="font-data text-xs text-dim">-</span>
        <input
          type="number"
          placeholder="MAX"
          value={filters.salaryMax}
          onChange={(e) => update({ salaryMax: e.target.value })}
          className="w-20 border border-s3 bg-bg px-2 py-1.5 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
        />
      </div>

      {/* Sponsorship Min */}
      <div className="flex items-center gap-1">
        <span className="font-data text-[10px] text-dim">SPONS:</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.sponsorshipMin}
          onChange={(e) => update({ sponsorshipMin: Number(e.target.value) })}
          className="w-16 accent-amber"
        />
        <span className="font-data text-xs text-amber">{filters.sponsorshipMin}%</span>
      </div>

      {/* Remote / Shortage toggles */}
      <label className="flex items-center gap-1 font-data text-[10px] text-dim cursor-pointer">
        <input
          type="checkbox"
          checked={filters.shortageOnly}
          onChange={(e) => update({ shortageOnly: e.target.checked })}
          className="accent-amber"
        />
        SHORTAGE
      </label>
      <label className="flex items-center gap-1 font-data text-[10px] text-dim cursor-pointer">
        <input
          type="checkbox"
          checked={filters.meetsThreshold}
          onChange={(e) => update({ meetsThreshold: e.target.checked })}
          className="accent-amber"
        />
        THRESHOLD
      </label>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1 border border-s3 bg-bg px-2 py-1.5 font-data text-[10px] uppercase text-dim transition-colors hover:border-amber hover:text-amber"
      >
        <RotateCcw size={10} /> RESET
      </button>
    </div>
  );
}
