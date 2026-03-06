'use client';

import { Select } from '@/components/ui/Select';

interface MapControlsProps {
  layer: string;
  onLayerChange: (layer: string) => void;
  industry: string;
  onIndustryChange: (industry: string) => void;
  rating: string;
  onRatingChange: (rating: string) => void;
}

const layerOptions = [
  { value: 'density', label: 'Sponsor Density' },
  { value: 'score', label: 'Score Heatmap' },
  { value: 'industry', label: 'By Industry' },
  { value: 'new', label: 'New Additions (30d)' },
  { value: 'b-rated', label: 'B-Rated Sponsors' },
];

const ratingOptions = [
  { value: '', label: 'All Ratings' },
  { value: 'A', label: 'A-Rated' },
  { value: 'B', label: 'B-Rated' },
];

const industryOptions = [
  { value: '', label: 'All Industries' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Education', label: 'Education' },
  { value: 'Hospitality', label: 'Hospitality' },
  { value: 'Construction', label: 'Construction' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Manufacturing', label: 'Manufacturing' },
];

const layerColors: Record<string, { label: string; color: string }[]> = {
  density: [
    { label: '1-10', color: '#58a6ff' },
    { label: '11-50', color: '#1f6feb' },
    { label: '51-200', color: '#bc8cff' },
    { label: '200+', color: '#f778ba' },
  ],
  score: [
    { label: '0-40', color: '#f85149' },
    { label: '40-60', color: '#d29922' },
    { label: '60-80', color: '#39d2c0' },
    { label: '80+', color: '#3fb950' },
  ],
  industry: [],
  new: [{ label: 'New (30d)', color: '#3fb950' }],
  'b-rated': [{ label: 'B-Rated', color: '#f85149' }],
};

export function MapControls({
  layer,
  onLayerChange,
  industry,
  onIndustryChange,
  rating,
  onRatingChange,
}: MapControlsProps) {
  const legend = layerColors[layer] || [];

  return (
    <div className="space-y-3">
      <Select
        label="Map Layer"
        options={layerOptions}
        value={layer}
        onChange={(e) => onLayerChange(e.target.value)}
      />
      <Select
        label="Industry"
        options={industryOptions}
        value={industry}
        onChange={(e) => onIndustryChange(e.target.value)}
      />
      <Select
        label="Rating"
        options={ratingOptions}
        value={rating}
        onChange={(e) => onRatingChange(e.target.value)}
      />

      {legend.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-dim">Legend</p>
          <div className="space-y-1">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-dim">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
