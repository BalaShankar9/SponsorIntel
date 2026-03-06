'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ImportRecord {
  id: string;
  filename: string;
  date: string;
  total_records: number;
  added: number;
  removed: number;
  changed: number;
  trigger: 'auto' | 'manual';
}

interface ImportHistoryProps {
  imports: ImportRecord[];
  loading: boolean;
}

export function ImportHistory({ imports, loading }: ImportHistoryProps) {
  if (loading) {
    return (
      <Card>
        <div className="h-48 animate-pulse rounded bg-s2" />
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <div className="p-4">
        <CardHeader>
          <CardTitle>Import History</CardTitle>
        </CardHeader>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">File</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dim">Date</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Records</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Added</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Removed</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-dim">Changed</th>
            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-dim">Trigger</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr key={imp.id} className="border-b border-border/50 transition-colors hover:bg-s2">
              <td className="max-w-[200px] truncate px-4 py-2.5 text-sm font-medium text-text">
                {imp.filename}
              </td>
              <td className="px-4 py-2.5 text-xs text-dim2">
                {new Date(imp.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-dim">
                {imp.total_records.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-green">
                +{imp.added.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-red">
                -{imp.removed.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-orange">
                {imp.changed.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={imp.trigger === 'auto' ? 'blue' : 'purple'}>
                  {imp.trigger}
                </Badge>
              </td>
            </tr>
          ))}
          {imports.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-dim">
                No import history available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
