'use client';

import { useState } from 'react';
import { Timeline } from '@/components/intel/Timeline';
import { Clock } from 'lucide-react';

const ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Family', 'Student'];

export default function TimelinePage() {
  const [selectedRoute, setSelectedRoute] = useState<string | undefined>();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Rule Change Timeline</h1>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setSelectedRoute(undefined)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            !selectedRoute ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
          }`}
        >
          All Routes
        </button>
        {ROUTES.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRoute(r)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              selectedRoute === r ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <Timeline visaRoute={selectedRoute} />
    </div>
  );
}
