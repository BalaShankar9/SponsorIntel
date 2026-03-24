'use client';

import { Button } from '@/components/ui/Button';
import type { IntelFeedFilters, IntelTopic, IntelImpactLevel } from '@/types/intel';

const TOPICS: { value: IntelTopic; label: string }[] = [
  { value: 'rule_change', label: 'Rule Changes' },
  { value: 'policy_update', label: 'Policy Updates' },
  { value: 'court_decision', label: 'Court Decisions' },
  { value: 'statistics', label: 'Statistics' },
  { value: 'opinion', label: 'Expert Opinion' },
  { value: 'news', label: 'News' },
  { value: 'community', label: 'Community' },
];

const IMPACTS: { value: IntelImpactLevel; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'text-red' },
  { value: 'high', label: 'High', color: 'text-amber' },
  { value: 'medium', label: 'Medium', color: 'text-blue' },
  { value: 'low', label: 'Low', color: 'text-dim' },
];

const VISA_ROUTES = [
  'Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder',
  'Family', 'Student', 'High Potential Individual', 'Scale-up', 'General',
];

interface IntelFiltersProps {
  filters: IntelFeedFilters;
  onChange: (filters: IntelFeedFilters) => void;
}

export function IntelFilters({ filters, onChange }: IntelFiltersProps) {
  const setFilter = (key: keyof IntelFeedFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value, page: 1 });
  };

  return (
    <div className="space-y-4">
      {/* Topic */}
      <div>
        <p className="text-[9px] font-data font-semibold uppercase tracking-[0.15em] text-dim mb-1.5">Topic</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('topic', undefined)}
            className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
              !filters.topic ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
            }`}
          >
            All Topics
          </button>
          {TOPICS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter('topic', t.value)}
              className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                filters.topic === t.value ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Impact Level */}
      <div>
        <p className="text-[9px] font-data font-semibold uppercase tracking-[0.15em] text-dim mb-1.5">Impact</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('impact', undefined)}
            className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
              !filters.impact ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
            }`}
          >
            All Levels
          </button>
          {IMPACTS.map((i) => (
            <button
              key={i.value}
              onClick={() => setFilter('impact', i.value)}
              className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                filters.impact === i.value ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              <span className={i.color}>{i.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Visa Route */}
      <div>
        <p className="text-[9px] font-data font-semibold uppercase tracking-[0.15em] text-dim mb-1.5">Visa Route</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('visa_route', undefined)}
            className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
              !filters.visa_route ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
            }`}
          >
            All Routes
          </button>
          {VISA_ROUTES.map((route) => (
            <button
              key={route}
              onClick={() => setFilter('visa_route', route)}
              className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                filters.visa_route === route ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              {route}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ page: 1, per_page: 20 })}
        className="w-full"
      >
        Reset Filters
      </Button>
    </div>
  );
}
