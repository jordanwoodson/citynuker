'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '1000');
    const bombName = searchParams.get('bomb') || 'Unknown';
    const cityName = searchParams.get('city') || 'Unknown';
    
    if (mapRef.current && window.google) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 11,
        mapTypeId: 'roadmap',
      });
      
      // Add blast radius circles
      const circles = [
        {
          radius: radius,
          color: '#FF0000',
          opacity: 0.35,
          label: 'Fireball radius',
        },
        {
          radius: radius * 2.5,
          color: '#FF6600',
          opacity: 0.25,
          label: 'Heavy blast damage radius (5 psi)',
        },
        {
          radius: radius * 4,
          color: '#FFAA00',
          opacity: 0.15,
          label: 'Moderate blast damage radius (1 psi)',
        },
        {
          radius: radius * 6,
          color: '#FFFF00',
          opacity: 0.1,
          label: 'Light blast damage radius (0.25 psi)',
        },
      ];
      
      circles.forEach((circleData) => {
        new window.google.maps.Circle({
          map: map,
          center: { lat, lng },
          radius: circleData.radius,
          fillColor: circleData.color,
          fillOpacity: circleData.opacity,
          strokeColor: circleData.color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });
      });
      
      // Add marker at ground zero
      new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: `Ground Zero - ${bombName}`,
      });
      
      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 10px 0;">${bombName}</h3>
            <p style="margin: 5px 0;">Target: ${cityName}</p>
            <p style="margin: 5px 0;">Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
            <div style="margin-top: 10px;">
              <p style="margin: 5px 0; color: #FF0000;">● Fireball: ${(radius/1000).toFixed(1)} km</p>
              <p style="margin: 5px 0; color: #FF6600;">● Heavy damage: ${(radius*2.5/1000).toFixed(1)} km</p>
              <p style="margin: 5px 0; color: #FFAA00;">● Moderate damage: ${(radius*4/1000).toFixed(1)} km</p>
              <p style="margin: 5px 0; color: #FFFF00;">● Light damage: ${(radius*6/1000).toFixed(1)} km</p>
            </div>
          </div>
        `,
      });
      
      infoWindow.open(map, new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
      }));
    }
  }, [searchParams]);
  
  return (
    <div className="relative w-full h-screen">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-4 rounded-lg max-w-sm">
        <h2 className="text-xl font-bold mb-2">Nuclear Blast Simulation</h2>
        <p className="text-sm mb-2">Bomb: {searchParams.get('bomb')}</p>
        <p className="text-sm mb-2">Target: {searchParams.get('city')}</p>
        <p className="text-xs text-gray-300 mt-4">
          This is an educational simulation. Actual effects would vary based on terrain, weather, and other factors.
        </p>
      </div>
    </div>
  );
}