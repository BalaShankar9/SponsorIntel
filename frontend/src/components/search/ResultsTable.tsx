'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScoreBadge, RatingBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Sponsor } from '@/types';

interface ResultsTableProps {
  data: Sponsor[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}

export function ResultsTable({ data, total, page, pages, onPageChange, loading }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});

  const columns = useMemo<ColumnDef<Sponsor>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="rounded border-border bg-s2"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-border bg-s2"
          />
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: 'overall_score',
        header: 'Score',
        cell: ({ getValue }) => <ScoreBadge score={getValue() as number | null} />,
        size: 70,
      },
      {
        accessorKey: 'organisation_name',
        header: 'Company Name',
        cell: ({ row }) => (
          <Link
            href={`/company/${row.original.id}`}
            className="font-medium text-accent hover:underline"
          >
            {row.original.organisation_name}
          </Link>
        ),
        size: 300,
      },
      {
        accessorKey: 'town_city',
        header: 'City',
        cell: ({ getValue }) => <span className="text-dim">{(getValue() as string) || '--'}</span>,
      },
      {
        accessorKey: 'rating',
        header: 'Rating',
        cell: ({ getValue }) => <RatingBadge rating={getValue() as string | null} />,
        size: 90,
      },
      {
        accessorKey: 'active_job_count',
        header: 'Active Jobs',
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return <span className={v && v > 0 ? 'font-medium text-green' : 'text-dim'}>{v ?? '--'}</span>;
        },
        size: 100,
      },
      {
        accessorKey: 'route',
        header: 'Route',
        cell: ({ getValue }) => {
          const routes = getValue() as string[] | null;
          return <span className="text-xs text-dim">{routes?.join(', ') || '--'}</span>;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  return (
    <div className="rounded-lg border border-border bg-s1">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-dim2">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp size={12} />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, ci) => (
                    <td key={ci}>
                      <div className="h-4 animate-pulse rounded bg-s2" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-dim">
                  No sponsors found matching your criteria
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-sm text-dim">
          Showing {data.length} of {total.toLocaleString()} results
          {Object.keys(rowSelection).length > 0 && (
            <span className="ml-2 text-accent">
              ({Object.keys(rowSelection).length} selected)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft size={14} />
            Prev
          </Button>
          <span className="text-sm text-dim">
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
