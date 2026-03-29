'use client';

interface MapControlsProps {
  layer: string;
  onLayerChange: (layer: string) => void;
  industry: string;
  onIndustryChange: (industry: string) => void;
  rating: string;
  onRatingChange: (rating: string) => void;
  scoreMin: number;
  onScoreMinChange: (v: number) => void;
  scoreMax: number;
  onScoreMaxChange: (v: number) => void;
}

const layerOptions = [
  { value: 'density', label: 'SPONSOR DENSITY' },
  { value: 'score', label: 'SCORE HEATMAP' },
  { value: 'industry', label: 'BY INDUSTRY' },
  { value: 'new', label: 'NEW (30D)' },
  { value: 'b-rated', label: 'B-RATED' },
];

const ratingOptions = [
  { value: '', label: 'ALL RATINGS' },
  { value: 'A', label: 'A-RATED' },
  { value: 'B', label: 'B-RATED' },
];

const industryOptions = [
  { value: '', label: 'ALL INDUSTRIES' },
  { value: 'Technology', label: 'TECHNOLOGY' },
  { value: 'Healthcare', label: 'HEALTHCARE' },
  { value: 'Finance', label: 'FINANCE' },
  { value: 'Education', label: 'EDUCATION' },
  { value: 'Hospitality', label: 'HOSPITALITY' },
  { value: 'Construction', label: 'CONSTRUCTION' },
  { value: 'Retail', label: 'RETAIL' },
  { value: 'Manufacturing', label: 'MANUFACTURING' },
];

const densityLegend = [
  { label: '1-10', color: '#4a9eff' },
  { label: '11-50', color: '#f5a623' },
  { label: '51-200', color: '#a78bfa' },
  { label: '200+', color: '#ff4757' },
];

const scoreLegend = [
  { label: '0-40', color: '#ff4757' },
  { label: '40-60', color: '#f5a623' },
  { label: '60-80', color: '#00e5ff' },
  { label: '80+', color: '#00d4aa' },
];

// Top 10 cities sample data
const topCities = [
  { city: 'London', count: 12450 },
  { city: 'Manchester', count: 2180 },
  { city: 'Birmingham', count: 1950 },
  { city: 'Leeds', count: 1120 },
  { city: 'Glasgow', count: 890 },
  { city: 'Edinburgh', count: 780 },
  { city: 'Bristol', count: 720 },
  { city: 'Liverpool', count: 650 },
  { city: 'Leicester', count: 520 },
  { city: 'Sheffield', count: 480 },
];

export function MapControls({
  layer,
  onLayerChange,
  industry,
  onIndustryChange,
  rating,
  onRatingChange,
  scoreMin,
  onScoreMinChange,
  scoreMax,
  onScoreMaxChange,
}: MapControlsProps) {
  const legend = layer === 'score' ? scoreLegend : layer === 'density' ? densityLegend : [];

  return (
    <div className="space-y-3">
      {/* Layer Selector */}
      <div className="border border-s3 bg-s1 p-3">
        <p className="mb-2 font-data text-[10px] font-bold uppercase tracking-widest text-amber">MAP LAYER</p>
        <div className="space-y-1">
          {layerOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => onLayerChange(o.value)}
              className={`block w-full text-left px-2 py-1 font-data text-[11px] transition-colors ${
                layer === o.value
                  ? 'bg-amber/10 text-amber border-l-2 border-amber'
                  : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="border border-s3 bg-s1 p-3">
        <p className="mb-2 font-data text-[10px] font-bold uppercase tracking-widest text-amber">FILTERS</p>
        <div className="space-y-2">
          <div>
            <label className="font-data text-[9px] text-dim">INDUSTRY</label>
            <select
              value={industry}
              onChange={(e) => onIndustryChange(e.target.value)}
              className="mt-0.5 w-full border border-s3 bg-bg px-2 py-1 font-data text-[11px] text-text focus:border-amber focus:outline-none"
            >
              {industryOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-data text-[9px] text-dim">RATING</label>
            <select
              value={rating}
              onChange={(e) => onRatingChange(e.target.value)}
              className="mt-0.5 w-full border border-s3 bg-bg px-2 py-1 font-data text-[11px] text-text focus:border-amber focus:outline-none"
            >
              {ratingOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-data text-[9px] text-dim">SCORE: {scoreMin}-{scoreMax}</label>
            <div className="flex gap-2 mt-0.5">
              <input
                type="range"
                min={0}
                max={100}
                value={scoreMin}
                onChange={(e) => onScoreMinChange(Number(e.target.value))}
                className="w-full accent-amber"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={scoreMax}
                onChange={(e) => onScoreMaxChange(Number(e.target.value))}
                className="w-full accent-amber"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="border border-s3 bg-s1 p-3">
          <p className="mb-2 font-data text-[10px] font-bold uppercase tracking-widest text-amber">LEGEND</p>
          <div className="space-y-1">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-data text-[10px] text-dim">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cities */}
      <div className="border border-s3 bg-s1 p-3">
        <p className="mb-2 font-data text-[10px] font-bold uppercase tracking-widest text-amber">TOP CITIES</p>
        <div className="space-y-0.5">
          {topCities.map((c, idx) => (
            <div key={c.city} className="flex items-center justify-between py-0.5">
              <span className="font-data text-[10px] text-dim">
                <span className="mr-1.5 text-muted">{String(idx + 1).padStart(2, '0')}</span>
                {c.city}
              </span>
              <span className="font-data text-[10px] font-bold text-amber">{c.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
