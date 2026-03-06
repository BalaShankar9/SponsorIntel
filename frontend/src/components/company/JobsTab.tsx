'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import type { Job } from '@/types';

interface JobsTabProps {
  sponsorId: string;
}

function likelihoodBadge(likelihood: number | null) {
  if (likelihood === null) return <Badge>Unknown</Badge>;
  if (likelihood >= 80) return <Badge variant="green">High ({likelihood}%)</Badge>;
  if (likelihood >= 50) return <Badge variant="orange">Medium ({likelihood}%)</Badge>;
  return <Badge variant="red">Low ({likelihood}%)</Badge>;
}

export function JobsTab({ sponsorId }: JobsTabProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Job[] }>(`/api/v1/jobs?sponsor_id=${sponsorId}&per_page=50`)
      .then((res) => setJobs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sponsorId]);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <Card padding={false}>
        <div className="p-4 pb-0">
          <CardHeader>
            <CardTitle>Active Jobs ({jobs.length})</CardTitle>
          </CardHeader>
        </div>
        {jobs.length === 0 ? (
          <p className="p-4 text-sm text-dim">No active jobs found for this sponsor.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Location</th>
                <th>Salary</th>
                <th>Source</th>
                <th>Sponsorship</th>
                <th>Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="max-w-[300px] truncate font-medium text-text">{job.title_raw}</td>
                  <td className="text-dim">{job.location_raw || '--'}</td>
                  <td className="text-dim">{job.salary_text_raw || '--'}</td>
                  <td>
                    <Badge variant="blue">{job.source}</Badge>
                  </td>
                  <td>{likelihoodBadge(job.sponsorship_likelihood)}</td>
                  <td className="text-dim">{formatDate(job.posted_date)}</td>
                  <td>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
