'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Job } from '@/types';

interface JobTableProps {
  jobs: Job[];
  loading: boolean;
}

type SortKey = 'sponsorship_likelihood' | 'title_raw' | 'company_name_raw' | 'location_city' | 'salary_min' | 'source' | 'posted_date';

const sourceColors: Record<string, string> = {
  indeed: 'bg-blue', linkedin: 'bg-cyan', reed: 'bg-amber', totaljobs: 'bg-purple',
  glassdoor: 'bg-green', gov_find_a_job: 'bg-red', devitjobs: 'bg-cyan', themuse: 'bg-purple',
  remoteok: 'bg-green', wwr: 'bg-amber', hn_hiring: 'bg-red', arbeitnow: 'bg-blue',
  jobicy: 'bg-green', himalayas: 'bg-cyan', remotive: 'bg-purple', charityjob: 'bg-amber',
  adzuna: 'bg-blue', jooble: 'bg-green', nhs_jobs: 'bg-blue', teaching_vacancies: 'bg-amber',
  cwjobs: 'bg-cyan', guardian: 'bg-amber', career_page: 'bg-green',
};

function SponsorshipBar({ likelihood }: { likelihood: number | null }) {
  if (likelihood === null) return <span className="font-data text-[10px] text-muted">--</span>;
  const color = likelihood >= 70 ? 'bg-green' : likelihood >= 40 ? 'bg-amber' : 'bg-red/60';
  const textColor = likelihood >= 70 ? 'text-green' : likelihood >= 40 ? 'text-amber' : 'text-red';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 bg-s3 rounded-sm overflow-hidden">
        <div className={`h-full ${color} rounded-sm`} style={{ width: `${Math.min(likelihood, 100)}%` }} />
      </div>
      <span className={`font-data text-[10px] font-bold tabular-nums ${textColor}`}>{likelihood}%</span>
    </div>
  );
}

function WorkModelBadge({ model }: { model: string | null }) {
  if (!model) return null;
  const colors: Record<string, string> = {
    remote: 'border-green/40 text-green', hybrid: 'border-cyan/40 text-cyan',
    office: 'border-dim/40 text-dim', flexible: 'border-purple/40 text-purple',
  };
  return (
    <span className={`ml-1 inline-block border px-1 py-px text-[8px] uppercase ${colors[model] || 'border-dim/40 text-dim'}`}>
      {model}
    </span>
  );
}

export function JobTable({ jobs, loading }: JobTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('posted_date');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...jobs].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={10} className="text-amber" /> : <ChevronDown size={10} className="text-amber" />;
  };

  if (loading) {
    return (
      <div className="border border-s3 bg-s1">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 animate-pulse border-b border-s3 bg-s2/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="border border-s3 bg-s1 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[80px_1fr_180px_120px_130px_80px_70px_60px] border-b border-amber/20 bg-s2/30">
        {[
          { key: 'sponsorship_likelihood' as SortKey, label: 'SPONS' },
          { key: 'title_raw' as SortKey, label: 'JOB TITLE' },
          { key: 'company_name_raw' as SortKey, label: 'COMPANY' },
          { key: 'location_city' as SortKey, label: 'LOCATION' },
          { key: 'salary_min' as SortKey, label: 'SALARY' },
          { key: 'source' as SortKey, label: 'SOURCE' },
          { key: 'posted_date' as SortKey, label: 'DATE' },
        ].map((h) => (
          <button
            key={h.key}
            className="flex items-center gap-1 px-2 py-2 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim transition-colors hover:text-amber"
            onClick={() => handleSort(h.key)}
          >
            {h.label}
            <SortIcon col={h.key} />
          </button>
        ))}
        <span className="px-2 py-2 font-data text-[9px] font-bold uppercase tracking-widest text-dim">APPLY</span>
      </div>

      {/* Body rows */}
      <div className="divide-y divide-s3/40">
        {sorted.map((job) => (
          <Fragment key={job.id}>
            <div
              className="grid grid-cols-[80px_1fr_180px_120px_130px_80px_70px_60px] items-center cursor-pointer transition-colors hover:bg-amber/5"
              onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
            >
              <div className="px-2 py-2">
                <SponsorshipBar likelihood={job.sponsorship_likelihood} />
              </div>
              <div className="px-2 py-2 min-w-0">
                <span className="font-data text-[11px] text-text truncate block">
                  {job.title_raw}
                </span>
                <WorkModelBadge model={job.work_model} />
              </div>
              <div className="px-2 py-2 min-w-0">
                {job.sponsor_id ? (
                  <Link
                    href={`/company/${job.sponsor_id}`}
                    className="font-data text-[11px] text-amber hover:text-text transition-colors truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.company_name_raw}
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green" title="UK Sponsor" />
                  </Link>
                ) : (
                  <span className="font-data text-[11px] text-dim truncate block">{job.company_name_raw || '--'}</span>
                )}
              </div>
              <div className="px-2 py-2">
                <span className="font-data text-[10px] text-dim truncate block">
                  {job.location_city || job.location_raw || '--'}
                </span>
              </div>
              <div className="px-2 py-2">
                {job.salary_min && job.salary_min > 100 ? (
                  <span className="font-data text-[10px]">
                    <span className="text-cyan">
                      {job.salary_currency === 'USD' ? '$' : '£'}
                      {job.salary_min.toLocaleString()}
                    </span>
                    {job.salary_max && job.salary_max > job.salary_min && (
                      <span className="text-dim">
                        –{job.salary_currency === 'USD' ? '$' : '£'}
                        {job.salary_max.toLocaleString()}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="font-data text-[10px] text-muted">--</span>
                )}
              </div>
              <div className="px-2 py-2">
                <span className="inline-flex items-center gap-1 font-data text-[9px] text-dim uppercase">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${sourceColors[job.source] || 'bg-muted'}`} />
                  {job.source}
                </span>
              </div>
              <div className="px-2 py-2">
                <span className="font-data text-[9px] text-muted">{formatDate(job.posted_date)}</span>
              </div>
              <div className="px-2 py-2">
                {job.source_url ? (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 border border-green/40 bg-green/10 px-1.5 py-0.5 font-data text-[9px] font-bold text-green transition-colors hover:bg-green/20"
                  >
                    <ExternalLink size={9} />
                  </a>
                ) : (
                  <span className="font-data text-[9px] text-muted">--</span>
                )}
              </div>
            </div>

            {/* Expanded detail row */}
            {expandedId === job.id && (
              <div className="bg-s2/30 px-4 py-3 border-t border-s3/30">
                <div className="space-y-2">
                  {job.description_snippet && (
                    <p className="font-data text-[11px] text-dim leading-relaxed max-w-3xl">
                      {job.description_snippet.slice(0, 400)}
                      {job.description_snippet.length > 400 ? '...' : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {job.sponsor_id && (
                      <span className="border border-green/30 bg-green/10 px-2 py-0.5 font-data text-[9px] font-bold text-green uppercase">
                        UK Sponsor Register
                      </span>
                    )}
                    {job.is_on_shortage_list && (
                      <span className="border border-amber/30 bg-amber/10 px-2 py-0.5 font-data text-[9px] font-bold text-amber uppercase">
                        Shortage List
                      </span>
                    )}
                    {job.meets_salary_threshold && (
                      <span className="border border-cyan/30 bg-cyan/10 px-2 py-0.5 font-data text-[9px] font-bold text-cyan uppercase">
                        Meets Visa Threshold
                      </span>
                    )}
                    {job.contract_type && (
                      <span className="border border-s3 px-1.5 py-0.5 font-data text-[9px] text-dim uppercase">{job.contract_type}</span>
                    )}
                    {job.seniority && (
                      <span className="border border-s3 px-1.5 py-0.5 font-data text-[9px] text-dim uppercase">{job.seniority}</span>
                    )}
                    {job.salary_text_raw && (
                      <span className="font-data text-[9px] text-dim">
                        Salary: <span className="text-text">{job.salary_text_raw}</span>
                      </span>
                    )}
                  </div>
                  {job.skills_extracted && job.skills_extracted.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {job.skills_extracted.slice(0, 10).map((skill) => (
                        <span key={skill} className="border border-cyan/20 bg-cyan/5 px-1.5 py-0.5 font-data text-[9px] text-cyan">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {job.source_url && (
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-green/40 bg-green/10 px-3 py-1 font-data text-[10px] font-bold text-green transition-colors hover:bg-green/20"
                    >
                      APPLY NOW <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </Fragment>
        ))}
        {sorted.length === 0 && (
          <div className="px-4 py-12 text-center font-data text-sm text-dim">
            NO JOBS FOUND MATCHING FILTERS.
          </div>
        )}
      </div>
    </div>
  );
}
