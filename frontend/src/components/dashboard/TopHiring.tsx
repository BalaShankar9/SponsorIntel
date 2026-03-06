'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ScoreBadge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

interface TopHiringItem {
  name: string;
  score: number;
  jobs: number;
  city: string;
  id?: string;
}

interface TopHiringProps {
  data: TopHiringItem[];
  loading: boolean;
}

export function TopHiring({ data, loading }: TopHiringProps) {
  return (
    <Card padding={false}>
      <div className="p-4 pb-0">
        <CardHeader>
          <CardTitle>Top Hiring Sponsors</CardTitle>
        </CardHeader>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-s2" />
          ))}
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Score</th>
              <th>Jobs</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((item, idx) => (
              <tr key={idx}>
                <td className="text-dim2">{idx + 1}</td>
                <td>
                  {item.id ? (
                    <Link href={`/company/${item.id}`} className="text-accent hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    <span className="text-text">{item.name}</span>
                  )}
                </td>
                <td><ScoreBadge score={item.score} /></td>
                <td className="font-medium text-text">{item.jobs}</td>
                <td className="text-dim">{item.city || '--'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
