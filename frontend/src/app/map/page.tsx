'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapControls } from '@/components/map/MapControls';

const UKMap = dynamic(() => import('@/components/map/UKMap').then((m) => m.UKMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="font-data text-sm text-amber animate-pulse">LOADING MAP DATA...</div>
    </div>
  ),
});

export default function MapPage() {
  const [layer, setLayer] = useState('density');
  const [industry, setIndustry] = useState('');
  const [rating, setRating] = useState('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);

  return (
    <div className="space-y-3">
      {/* Terminal Header */}
      <div className="border-b border-amber/30 pb-2">
        <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
          SPONSOR MAP
        </h1>
        <p className="font-data text-xs text-dim">
          GEOGRAPHIC DISTRIBUTION // UK VISA SPONSORS // HEATMAP VIEW
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Map - Full Width */}
        <div className="lg:col-span-4">
          <div className="h-[calc(100vh-200px)] border border-s3 bg-bg overflow-hidden">
            <UKMap layer={layer} industry={industry} rating={rating} />
          </div>
        </div>

        {/* Controls + Stats Panel */}
        <div className="space-y-3">
          <MapControls
            layer={layer}
            onLayerChange={setLayer}
            industry={industry}
            onIndustryChange={setIndustry}
            rating={rating}
            onRatingChange={setRating}
            scoreMin={scoreMin}
            onScoreMinChange={setScoreMin}
            scoreMax={scoreMax}
            onScoreMaxChange={setScoreMax}
          />
        </div>
      </div>
    </div>
  );
}
