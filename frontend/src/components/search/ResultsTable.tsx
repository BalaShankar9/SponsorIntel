'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HoverPreview } from '@/components/ui/HoverPreview';

interface SponsorRow {
  id: string;
  organisation_name: string;
  town_city: string | null;
  county: string | null;
  rating: string | null;
  sponsor_type: string | null;
  route: string[] | null;
  is_active: boolean;
  first_seen_date: string | null;
  last_seen_date: string | null;
  score: number | null;
  company_status: string | null;
  companies_house_number: string | null;
  industry_primary: string | null;
  credit_risk_score: number | null;
}

interface ResultsTableProps {
  data: SponsorRow[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (!direction) {
    return <span className="text-dim/30 ml-0.5">&#x25B4;&#x25BE;</span>;
  }
  return (
    <span className="text-amber ml-0.5">
      {direction === 'asc' ? '\u25B4' : '\u25BE'}
    </span>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-dim text-[11px]">--</span>;
  const color = score >= 70 ? 'text-green' : score >= 50 ? 'text-amber' : 'text-red';
  const bg = score >= 70 ? 'bg-green/10' : score >= 50 ? 'bg-amber/10' : 'bg-red/10';
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 font-data text-[10px] font-bold tabular-nums', color, bg)}>
      {score}
    </span>
  );
}

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <span className="text-dim text-[11px]">--</span>;
  const isActive = status.toLowerCase() === 'active';
  return (
    <span className={cn(
      'inline-block rounded px-1.5 py-0.5 font-data text-[10px]',
      isActive ? 'bg-green/10 text-green' : 'bg-dim/10 text-dim'
    )}>
      {status}
    </span>
  );
}

export function ResultsTable({ data, total, page, pages, onPageChange, loading }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const router = useRouter();

  const columns = useMemo<ColumnDef<SponsorRow>[]>(
    () => [
      {
        accessorKey: 'organisation_name',
        header: 'Name',
        cell: ({ row }) => (
          <HoverPreview sponsorId={row.original.id}>
            <Link
              href={`/company/${row.original.id}`}
              className="text-amber hover:text-text transition-colors font-medium"
            >
              {row.original.organisation_name}
            </Link>
          </HoverPreview>
        ),
        size: 260,
      },
      {
        accessorKey: 'town_city',
        header: 'City',
        cell: ({ getValue }) => (
          <span className="font-data text-[11px] text-dim">{(getValue() as string) || '--'}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'rating',
        header: 'Rating',
        cell: ({ getValue }) => {
          const rating = getValue() as string | null;
          if (!rating) return <span className="text-dim">--</span>;
          return (
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5 font-data text-[10px] font-bold',
                rating === 'A' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'
              )}
            >
              {rating}
            </span>
          );
        },
        size: 55,
      },
      {
        accessorKey: 'sponsor_type',
        header: 'Type',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <span className="inline-block rounded px-1.5 py-0.5 font-data text-[10px] bg-s2 text-text">{v}</span>
          ) : <span className="text-dim text-[11px]">--</span>;
        },
        size: 110,
      },
      {
        accessorKey: 'score',
        header: 'Score',
        cell: ({ getValue }) => <ScoreCell score={getValue() as number | null} />,
        size: 60,
      },
      {
        accessorKey: 'company_status',
        header: 'CH Status',
        cell: ({ getValue }) => <StatusCell status={getValue() as string | null} />,
        size: 80,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Keyboard navigation (j/k/enter) -- only when not in an input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRow((prev) => Math.min(prev + 1, data.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRow((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && data[selectedRow]) {
        if (!(e.target instanceof HTMLInputElement)) {
          router.push(`/company/${data[selectedRow].id}`);
        }
      }
    },
    [data, selectedRow, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset selection on data change
  useEffect(() => {
    setSelectedRow(0);
  }, [data]);

  // Pagination info
  const fromRow = (page - 1) * data.length + 1;
  const toRow = fromRow + data.length - 1;

  return (
    <div className="border border-border bg-s1">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      style={{ width: header.getSize() }}
                      className={cn(
                        'px-3 py-1.5 text-left font-data text-[10px] font-medium uppercase tracking-wider cursor-pointer select-none',
                        isSorted ? 'text-amber border-b border-amber' : 'text-dim hover:text-text'
                      )}
                    >
                      <span className="flex items-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIndicator direction={isSorted} />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="border-b border-border/20" style={{ height: '28px' }}>
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-3">
                      <div className="h-3 animate-pulse rounded bg-s2" style={{ width: `${40 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center font-data text-[12px] text-dim">
                  NO RESULTS FOUND
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border/10 transition-colors',
                    idx === selectedRow ? 'bg-amber/5 border-l-2 border-l-amber' : 'hover:bg-s2/40'
                  )}
                  style={{ height: '28px' }}
                  onClick={() => setSelectedRow(idx)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 text-[12px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: count + pagination */}
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <div className="flex items-center gap-3">
          <span className="font-data text-[12px] font-bold text-amber">
            {total.toLocaleString()} <span className="font-normal text-dim">sponsors</span>
          </span>
          {total > 0 && (
            <span className="font-data text-[10px] text-dim">
              showing {fromRow.toLocaleString()}-{toRow.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex h-6 w-6 items-center justify-center border border-border text-dim hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="font-data text-[11px] text-dim">
            {page}<span className="text-dim/50">/</span>{pages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            className="flex h-6 w-6 items-center justify-center border border-border text-dim hover:border-amber hover:text-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
