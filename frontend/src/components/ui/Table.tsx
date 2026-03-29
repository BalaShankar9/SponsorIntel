'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
  enableKeyboardNav?: boolean;
  onRowSelect?: (index: number) => void;
  rowCount?: number;
}

export function Table({ children, className, enableKeyboardNav = false, onRowSelect, rowCount = 0 }: TableProps) {
  const [selectedRow, setSelectedRow] = useState(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enableKeyboardNav) return;

      // Don't intercept when typing in inputs
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if ((el as HTMLElement).isContentEditable) return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRow((prev) => {
          const next = Math.min(prev + 1, rowCount - 1);
          onRowSelect?.(next);
          return next;
        });
      }

      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRow((prev) => {
          const next = Math.max(prev - 1, 0);
          onRowSelect?.(next);
          return next;
        });
      }

      if (e.key === 'Enter' && selectedRow >= 0) {
        onRowSelect?.(selectedRow);
      }
    },
    [enableKeyboardNav, rowCount, selectedRow, onRowSelect]
  );

  useEffect(() => {
    if (!enableKeyboardNav) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardNav, handleKeyDown]);

  return (
    <div ref={tableRef} className={cn('overflow-x-auto', className)}>
      <table className="data-table w-full">
        {children}
      </table>
    </div>
  );
}

// TableRow with hover and keyboard selection support
interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  isSelected?: boolean;
  className?: string;
}

export function TableRow({ children, isSelected, className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'h-7 cursor-pointer transition-colors hover:bg-s2',
        isSelected && 'bg-s2',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

// TableCell with monospace support for numbers
interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  numeric?: boolean;
  className?: string;
}

export function TableCell({ children, numeric, className, ...props }: TableCellProps) {
  return (
    <td className={cn(numeric && 'font-data', className)} {...props}>
      {children}
    </td>
  );
}
