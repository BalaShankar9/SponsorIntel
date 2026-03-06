'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/Card';
import { MapControls } from '@/components/map/MapControls';
import { Spinner } from '@/components/ui/Spinner';

const UKMap = dynamic(() => import('@/components/map/UKMap').then((m) => m.UKMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  ),
});

export default function MapPage() {
  const [layer, setLayer] = useState('density');
  const [industry, setIndustry] = useState('');
  const [rating, setRating] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Sponsor Map</h1>
        <p className="text-sm text-dim">Geographic distribution of UK visa sponsors</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Controls Panel */}
        <Card>
          <MapControls
            layer={layer}
            onLayerChange={setLayer}
            industry={industry}
            onIndustryChange={setIndustry}
            rating={rating}
            onRatingChange={setRating}
          />
        </Card>

        {/* Map */}
        <div className="lg:col-span-3">
          <Card padding={false} className="h-[calc(100vh-180px)] overflow-hidden">
            <UKMap layer={layer} industry={industry} rating={rating} />
          </Card>
        </div>
      </div>
    </div>
  );
}
