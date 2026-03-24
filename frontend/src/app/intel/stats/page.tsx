'use client';

import { useState } from 'react';
import { StatsPanel } from '@/components/intel/StatsPanel';
import { BarChart3 } from 'lucide-react';

const ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Family', 'Student'];

export default function StatsPage() {
  const [route, setRoute] = useState<string | undefined>();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Immigration Statistics</h1>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setRoute(undefined)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            !route ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
          }`}
        >
          All Routes
        </button>
        {ROUTES.map((r) => (
          <button key={r} onClick={() => setRoute(r)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              route === r ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <StatsPanel visaRoute={route} />
    </div>
  );
}
