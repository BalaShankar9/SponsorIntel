'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface CityData {
  city: string;
  count: number;
  lat: number;
  lng: number;
  avgScore?: number;
}

interface UKMapProps {
  layer: string;
  industry: string;
  rating: string;
}

// Pre-computed UK city coordinates
const cityCoords: Record<string, { lat: number; lng: number }> = {
  London: { lat: 51.5074, lng: -0.1278 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Leeds: { lat: 53.8008, lng: -1.5491 },
  Glasgow: { lat: 55.8642, lng: -4.2518 },
  Edinburgh: { lat: 55.9533, lng: -3.1883 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  Bristol: { lat: 51.4545, lng: -2.5879 },
  Sheffield: { lat: 53.3811, lng: -1.4701 },
  Newcastle: { lat: 54.9783, lng: -1.6178 },
  Nottingham: { lat: 52.9548, lng: -1.1581 },
  Leicester: { lat: 52.6369, lng: -1.1398 },
  Coventry: { lat: 52.4068, lng: -1.5197 },
  Cardiff: { lat: 51.4816, lng: -3.1791 },
  Belfast: { lat: 54.5973, lng: -5.9301 },
  Reading: { lat: 51.4543, lng: -0.9781 },
  Cambridge: { lat: 52.2053, lng: 0.1218 },
  Oxford: { lat: 51.752, lng: -1.2577 },
  Southampton: { lat: 50.9097, lng: -1.4044 },
  Brighton: { lat: 50.8225, lng: -0.1372 },
  Aberdeen: { lat: 57.1497, lng: -2.0943 },
  Dundee: { lat: 56.462, lng: -2.9707 },
  Swansea: { lat: 51.6214, lng: -3.9436 },
  Plymouth: { lat: 50.3755, lng: -4.1427 },
  York: { lat: 53.9591, lng: -1.0815 },
};

function getCircleColor(layer: string, count: number, avgScore?: number): string {
  if (layer === 'score' && avgScore !== undefined) {
    if (avgScore >= 80) return '#3fb950';
    if (avgScore >= 60) return '#39d2c0';
    if (avgScore >= 40) return '#d29922';
    return '#f85149';
  }
  if (layer === 'b-rated') return '#f85149';
  if (layer === 'new') return '#3fb950';
  // density
  if (count > 200) return '#f778ba';
  if (count > 50) return '#bc8cff';
  if (count > 10) return '#1f6feb';
  return '#58a6ff';
}

function getRadius(count: number): number {
  if (count > 500) return 30;
  if (count > 200) return 24;
  if (count > 50) return 18;
  if (count > 10) return 12;
  return 8;
}

// Sample data for visualization
const sampleCityData: CityData[] = [
  { city: 'London', count: 12450, lat: 51.5074, lng: -0.1278, avgScore: 72 },
  { city: 'Manchester', count: 2180, lat: 53.4808, lng: -2.2426, avgScore: 68 },
  { city: 'Birmingham', count: 1950, lat: 52.4862, lng: -1.8904, avgScore: 65 },
  { city: 'Leeds', count: 1120, lat: 53.8008, lng: -1.5491, avgScore: 70 },
  { city: 'Glasgow', count: 890, lat: 55.8642, lng: -4.2518, avgScore: 63 },
  { city: 'Edinburgh', count: 780, lat: 55.9533, lng: -3.1883, avgScore: 74 },
  { city: 'Liverpool', count: 650, lat: 53.4084, lng: -2.9916, avgScore: 60 },
  { city: 'Bristol', count: 720, lat: 51.4545, lng: -2.5879, avgScore: 71 },
  { city: 'Sheffield', count: 480, lat: 53.3811, lng: -1.4701, avgScore: 58 },
  { city: 'Newcastle', count: 410, lat: 54.9783, lng: -1.6178, avgScore: 62 },
  { city: 'Nottingham', count: 390, lat: 52.9548, lng: -1.1581, avgScore: 64 },
  { city: 'Leicester', count: 520, lat: 52.6369, lng: -1.1398, avgScore: 55 },
  { city: 'Coventry', count: 340, lat: 52.4068, lng: -1.5197, avgScore: 59 },
  { city: 'Cardiff', count: 310, lat: 51.4816, lng: -3.1791, avgScore: 66 },
  { city: 'Belfast', count: 280, lat: 54.5973, lng: -5.9301, avgScore: 61 },
  { city: 'Reading', count: 450, lat: 51.4543, lng: -0.9781, avgScore: 73 },
  { city: 'Cambridge', count: 380, lat: 52.2053, lng: 0.1218, avgScore: 78 },
  { city: 'Oxford', count: 350, lat: 51.752, lng: -1.2577, avgScore: 76 },
  { city: 'Southampton', count: 290, lat: 50.9097, lng: -1.4044, avgScore: 60 },
  { city: 'Brighton', count: 260, lat: 50.8225, lng: -0.1372, avgScore: 67 },
  { city: 'Aberdeen', count: 220, lat: 57.1497, lng: -2.0943, avgScore: 64 },
  { city: 'York', count: 180, lat: 53.9591, lng: -1.0815, avgScore: 69 },
  { city: 'Plymouth', count: 120, lat: 50.3755, lng: -4.1427, avgScore: 54 },
  { city: 'Swansea', count: 140, lat: 51.6214, lng: -3.9436, avgScore: 57 },
];

export function UKMap({ layer, industry, rating }: UKMapProps) {
  const [cities, setCities] = useState<CityData[]>(sampleCityData);

  useEffect(() => {
    // In production, fetch from API with filters
    // api.get(`/api/v1/analytics/geographic?layer=${layer}&industry=${industry}&rating=${rating}`)
    setCities(sampleCityData);
  }, [layer, industry, rating]);

  return (
    <MapContainer
      center={[54.5, -3.5]}
      zoom={6}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {cities.map((city) => (
        <CircleMarker
          key={city.city}
          center={[city.lat, city.lng]}
          radius={getRadius(city.count)}
          fillColor={getCircleColor(layer, city.count, city.avgScore)}
          fillOpacity={0.6}
          color={getCircleColor(layer, city.count, city.avgScore)}
          weight={1}
          opacity={0.8}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-gray-900">{city.city}</p>
              <p className="text-gray-700">Sponsors: {city.count.toLocaleString()}</p>
              {city.avgScore && (
                <p className="text-gray-700">Avg Score: {city.avgScore}</p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
