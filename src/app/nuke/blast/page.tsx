'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const MapComponent = dynamic(() => import('@/components/BlastMap'), {
  ssr: false,
  loading: () => <div className="w-full h-screen bg-gray-900 flex items-center justify-center text-white">Loading map...</div>
});

function BlastPageContent() {
  const searchParams = useSearchParams();
  const [mapData, setMapData] = useState<{
    lat: number;
    lng: number;
    radius: number;
    bombName: string;
    cityName: string;
  } | null>(null);

  useEffect(() => {
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '1000');
    const bombName = searchParams.get('bomb') || 'Unknown';
    const cityName = searchParams.get('city') || 'Unknown';

    setMapData({ lat, lng, radius, bombName, cityName });
  }, [searchParams]);

  if (!mapData) {
    return <div className="w-full h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return <MapComponent {...mapData} />;
}

export default function BlastPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>}>
      <BlastPageContent />
    </Suspense>
  );
}