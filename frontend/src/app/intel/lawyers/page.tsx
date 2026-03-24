'use client';

import { LawyerFinder } from '@/components/intel/LawyerFinder';
import { Scale } from 'lucide-react';

export default function LawyersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Scale size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Immigration Lawyer Finder</h1>
        <span className="text-[9px] font-data text-dim ml-2">AI-Powered Matching</span>
      </div>

      <LawyerFinder />
    </div>
  );
}
