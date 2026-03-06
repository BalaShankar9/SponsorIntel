'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Job } from '@/types';

interface JobTableProps {
  jobs: Job[];
  loading: boolean;
}

type SortKey = 'sponsorship_likelihood' | 'title_raw' | 'company_name_raw' | 'location_raw' | 'salary_min' | 'source' | 'posted_date';

const sourceColors: Record<string, string> = {
  indeed: 'bg-accent',
  linkedin: 'bg-cyan',
  reed: 'bg-orange',
  totaljobs: 'bg-purple',
  glassdoor: 'bg-green',
  gov_find_a_job: 'bg-pink',
};

function getSponsorshipBadge(likelihood: number | null) {
  if (likelihood === null) return <Badge>--</Badge>;
  if (likelihood >= 80) return <Badge variant="green">{likelihood}%</Badge>;
  if (likelihood >= 50) return <Badge variant="orange">{likelihood}%</Badge>;
  return <Badge>{likelihood}%</Badge>;
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
    return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const headers: { key: SortKey; label: string; className?: string }[] = [
    { key: 'sponsorship_likelihood', label: 'Sponsor %', className: 'w-24' },
    { key: 'title_raw', label: 'Title' },
    { key: 'company_name_raw', label: 'Company' },
    { key: 'location_raw', label: 'Location' },
    { key: 'salary_min', label: 'Salary' },
    { key: 'source', label: 'Source', className: 'w-24' },
    { key: 'posted_date', label: 'Posted', className: 'w-28' },
  ];

  if (loading) {
    return (
      <Card>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-s2" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <Table>
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th
                key={h.key}
                className={`cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dim hover:text-text ${h.className || ''}`}
                onClick={() => handleSort(h.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {h.label}
                  <SortIcon col={h.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => (
            <>
              <tr
                key={job.id}
                className="cursor-pointer border-b border-border/50 transition-colors hover:bg-s2"
                onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
              >
                <td className="px-4 py-2.5">{getSponsorshipBadge(job.sponsorship_likelihood)}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-text">{job.title_raw}</td>
                <td className="px-4 py-2.5 text-sm text-dim">{job.company_name_raw}</td>
                <td className="px-4 py-2.5 text-sm text-dim">{job.location_raw || '--'}</td>
                <td className="px-4 py-2.5 text-sm text-dim">
                  {job.salary_min ? `£${job.salary_min.toLocaleString()}` : '--'}
                  {job.salary_max ? ` - £${job.salary_max.toLocaleString()}` : ''}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-dim">
                    <span className={`h-2 w-2 rounded-full ${sourceColors[job.source] || 'bg-s4'}`} />
                    {job.source}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-dim2">{formatDate(job.posted_date)}</td>
              </tr>
              {expandedId === job.id && (
                <tr key={`${job.id}-detail`} className="border-b border-border/50">
                  <td colSpan={7} className="bg-s2/50 px-4 py-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-dim">
                          Salary: {job.salary_text_raw || 'Not specified'}
                        </span>
                        {job.is_on_shortage_list && (
                          <Badge variant="purple">Shortage List</Badge>
                        )}
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Original <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-sm text-dim">
                No jobs found matching your filters.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}
