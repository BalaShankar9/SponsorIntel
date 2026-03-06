'use client';

import { useState } from 'react';
import { Download, ChevronDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/auth';

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportXLSX: () => void;
}

export function ExportButton({ onExportCSV, onExportXLSX }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const { isPro } = useAuthStore();

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        <Download size={14} />
        Export
        <ChevronDown size={12} />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-s1 py-1 shadow-xl">
            <button
              onClick={() => { onExportCSV(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text hover:bg-s2"
            >
              <Download size={14} />
              Export as CSV
            </button>
            <button
              onClick={() => {
                if (isPro) { onExportXLSX(); setOpen(false); }
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text hover:bg-s2"
            >
              {isPro ? <Download size={14} /> : <Lock size={14} className="text-orange" />}
              Export as XLSX
              {!isPro && <span className="ml-auto text-[10px] text-orange">PRO</span>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
