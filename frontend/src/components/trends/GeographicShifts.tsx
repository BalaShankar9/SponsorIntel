'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface GeographicShiftsProps {
  loading: boolean;
}

interface CityData {
  city: string;
  count: number;
  aRated: number;
  pct: number;
}

export function GeographicShifts({ loading: parentLoading }: GeographicShiftsProps) {
  const [data, setData] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: rows } = await supabase
        .from('sponsors')
        .select('town_city, rating')
        .not('town_city', 'is', null)
        .limit(10000);

      if (rows) {
        const cityStats: Record<string, { total: number; aRated: number }> = {};
        rows.forEach((r) => {
          const city = r.town_city as string;
          if (!city) return;
          if (!cityStats[city]) cityStats[city] = { total: 0, aRated: 0 };
          cityStats[city].total++;
          if (r.rating === 'A') cityStats[city].aRated++;
        });

        const totalSponsors = rows.length;
        const sorted = Object.entries(cityStats)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 15)
          .map(([city, stats]) => ({
            city,
            count: stats.total,
            aRated: stats.aRated,
            pct: Math.round((stats.total / totalSponsors) * 1000) / 10,
          }));
        setData(sorted);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading || parentLoading) {
    return (
      <div className="border border-border bg-s1 p-4">
        <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-amber">TOP CITIES</h3>
        <div className="h-64 animate-pulse bg-s2/30 rounded mt-3" />
      </div>
    );
  }

  const maxCount = data[0]?.count || 1;

  return (
    <div className="border border-border bg-s1">
      <div className="p-4 pb-2">
        <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-amber">
          TOP CITIES BY SPONSOR COUNT <span className="text-dim font-normal">{'// GEOGRAPHIC DISTRIBUTION'}</span>
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-amber/20">
            <th className="px-4 py-1.5 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim">#</th>
            <th className="px-4 py-1.5 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim">CITY</th>
            <th className="px-4 py-1.5 text-right font-data text-[9px] font-bold uppercase tracking-widest text-dim">SPONSORS</th>
            <th className="px-4 py-1.5 text-right font-data text-[9px] font-bold uppercase tracking-widest text-dim">A-RATED</th>
            <th className="px-4 py-1.5 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim pl-6">SHARE</th>
          </tr>
        </thead>
        <tbody>
          {data.map((city, idx) => (
            <tr key={city.city} className="border-b border-border/30 transition-colors hover:bg-amber/5 stagger-item">
              <td className="px-4 py-1.5 font-data text-[10px] text-muted">{String(idx + 1).padStart(2, '0')}</td>
              <td className="px-4 py-1.5 font-data text-xs text-text font-medium">{city.city}</td>
              <td className="px-4 py-1.5 text-right font-data text-xs text-amber font-bold">{city.count.toLocaleString()}</td>
              <td className="px-4 py-1.5 text-right font-data text-xs text-green">{city.aRated.toLocaleString()}</td>
              <td className="px-4 py-1.5 pl-6 w-40">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-s3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber/60"
                      style={{ width: `${(city.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-data text-[10px] text-dim w-10 text-right">{city.pct}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
