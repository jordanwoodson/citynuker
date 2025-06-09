'use client';

import { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

interface BlastMapProps {
  lat: number;
  lng: number;
  radius: number;
  bombName: string;
  cityName: string;
}

// Component to handle map click events
function MapClickHandler({ onPositionChange }: { onPositionChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Custom draggable marker component
function DraggableMarker({ 
  position, 
  bombName, 
  cityName,
  onPositionChange 
}: { 
  position: [number, number];
  bombName: string;
  cityName: string;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const [draggable] = useState(true);
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      drag() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          onPositionChange(newPos.lat, newPos.lng);
        }
      },
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          onPositionChange(newPos.lat, newPos.lng);
        }
      },
    }),
    [onPositionChange],
  );

  return (
    <Marker
      draggable={draggable}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    >
      <Popup>
        <div className="p-2">
          <h3 className="font-bold">{bombName}</h3>
          <p>Ground Zero: {cityName}</p>
          <p className="text-sm">Coordinates: {position[0].toFixed(4)}, {position[1].toFixed(4)}</p>
          <p className="text-xs text-gray-500 mt-2">Drag marker to move blast radius</p>
        </div>
      </Popup>
    </Marker>
  );
}

// Interactive blast zone component
function InteractiveBlastZone({ 
  zone, 
  center,
  isHighlighted,
  onHover
}: { 
  zone: {
    radius: number;
    color: string;
    fillOpacity: number;
    name: string;
    description: string;
  };
  center: [number, number];
  isHighlighted: boolean;
  onHover: (hovering: boolean) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const eventHandlers = {
    mouseover: () => {
      setShowTooltip(true);
      onHover(true);
    },
    mouseout: () => {
      setShowTooltip(false);
      onHover(false);
    },
  };

  return (
    <Circle
      center={center}
      radius={zone.radius}
      pathOptions={{
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: isHighlighted ? zone.fillOpacity * 1.5 : zone.fillOpacity,
        weight: isHighlighted ? 3 : 1,
      }}
      eventHandlers={eventHandlers}
    >
      {showTooltip && (
        <Tooltip permanent direction="top" offset={[0, -10]}>
          <div className="text-sm font-medium">{zone.name}</div>
          <div className="text-xs">{(zone.radius / 1000).toFixed(1)} km radius</div>
          <div className="text-xs text-gray-600">{zone.description}</div>
        </Tooltip>
      )}
    </Circle>
  );
}

export default function BlastMap({ lat, lng, radius, bombName, cityName }: BlastMapProps) {
  const [currentPosition, setCurrentPosition] = useState<[number, number]>([lat, lng]);
  const [hoveredZoneIndex, setHoveredZoneIndex] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const handlePositionChange = (newLat: number, newLng: number) => {
    setCurrentPosition([newLat, newLng]);
  };

  // Blast zones with different damage levels
  const blastZones = [
    {
      radius: radius,
      color: '#FF0000',
      fillOpacity: 0.4,
      name: 'Fireball',
      description: 'Complete vaporization - everything destroyed',
    },
    {
      radius: radius * 2.5,
      color: '#FF6600',
      fillOpacity: 0.3,
      name: 'Heavy blast damage',
      description: '5 psi overpressure - most buildings destroyed',
    },
    {
      radius: radius * 4,
      color: '#FFAA00',
      fillOpacity: 0.2,
      name: 'Moderate blast damage',
      description: '1 psi overpressure - residential buildings severely damaged',
    },
    {
      radius: radius * 6,
      color: '#FFFF00',
      fillOpacity: 0.15,
      name: 'Light blast damage',
      description: '0.25 psi overpressure - windows shattered',
    },
    {
      radius: radius * 5,
      color: '#FF00FF',
      fillOpacity: 0.15,
      name: 'Radiation radius (500 rem)',
      description: 'Lethal dose - 50-90% mortality without treatment',
    },
    {
      radius: radius * 8,
      color: '#9400D3',
      fillOpacity: 0.1,
      name: 'Radiation radius (100 rem)',
      description: 'Radiation sickness - increased cancer risk',
    },
    {
      radius: radius * 7,
      color: '#00FFFF',
      fillOpacity: 0.1,
      name: '3rd degree burn radius',
      description: 'Severe burns to exposed skin',
    },
    {
      radius: radius * 10,
      color: '#0080FF',
      fillOpacity: 0.08,
      name: 'Power outage radius',
      description: 'EMP effects - electronics and power grid failure',
    },
  ];

  // Sort zones by radius (largest first) so smaller zones render on top
  const sortedZones = [...blastZones].sort((a, b) => b.radius - a.radius);

  return (
    <div className="relative w-full h-screen">
      <MapContainer center={currentPosition} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapClickHandler onPositionChange={handlePositionChange} />
        
        {sortedZones.map((zone) => {
          const originalIndex = blastZones.findIndex(z => z.name === zone.name);
          return (
            <InteractiveBlastZone
              key={originalIndex}
              zone={zone}
              center={currentPosition}
              isHighlighted={hoveredZoneIndex === originalIndex}
              onHover={(hovering) => setHoveredZoneIndex(hovering ? originalIndex : null)}
            />
          );
        })}
        
        <DraggableMarker 
          position={currentPosition}
          bombName={bombName}
          cityName={cityName}
          onPositionChange={handlePositionChange}
        />
      </MapContainer>
      
      {/* Mobile info button */}
      <button
        className="sm:hidden absolute top-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-full z-[1000]"
        onClick={() => setShowInfo(!showInfo)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      
      {/* Desktop sidebar / Mobile bottom sheet */}
      <div className={`
        absolute bg-black bg-opacity-90 text-white rounded-t-2xl sm:rounded-lg z-[1000]
        sm:top-4 sm:left-4 sm:max-w-sm sm:max-h-[90vh] sm:p-4
        ${showInfo ? 'bottom-0' : '-bottom-full'} 
        sm:bottom-auto left-0 right-0 sm:left-4 sm:right-auto
        transition-all duration-300 ease-in-out
        p-4 max-h-[70vh] overflow-y-auto
        sm:translate-y-0 sm:block
      `}>
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
        
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg sm:text-xl font-bold">Nuclear Blast Simulation</h2>
          <button
            className="sm:hidden text-gray-400"
            onClick={() => setShowInfo(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="text-sm mb-1">Bomb: {bombName}</p>
        <p className="text-sm mb-1">Target: {cityName}</p>
        <p className="text-xs text-gray-400 mb-3">
          Click map or drag marker to move blast center
        </p>
        
        <div className="space-y-1.5 text-xs">
          <h3 className="font-semibold text-sm mt-2 mb-1">Blast Effects:</h3>
          {blastZones.slice(0, 4).map((zone, index) => (
            <div 
              key={index} 
              className={`flex items-start p-1 rounded transition-colors ${
                hoveredZoneIndex === index ? 'bg-gray-800' : ''
              }`}
              onMouseEnter={() => setHoveredZoneIndex(index)}
              onMouseLeave={() => setHoveredZoneIndex(null)}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
              <div>
                <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                <p className="text-gray-300 text-xs">{zone.description}</p>
              </div>
            </div>
          ))}
          
          <h3 className="font-semibold text-sm mt-3 mb-1">Thermal Effects:</h3>
          {blastZones.slice(6, 7).map((zone, index) => (
            <div 
              key={index} 
              className={`flex items-start p-1 rounded transition-colors ${
                hoveredZoneIndex === index + 6 ? 'bg-gray-800' : ''
              }`}
              onMouseEnter={() => setHoveredZoneIndex(index + 6)}
              onMouseLeave={() => setHoveredZoneIndex(null)}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
              <div>
                <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                <p className="text-gray-300 text-xs">{zone.description}</p>
              </div>
            </div>
          ))}
          
          <h3 className="font-semibold text-sm mt-3 mb-1">Radiation Effects:</h3>
          {blastZones.slice(4, 6).map((zone, index) => (
            <div 
              key={index} 
              className={`flex items-start p-1 rounded transition-colors ${
                hoveredZoneIndex === index + 4 ? 'bg-gray-800' : ''
              }`}
              onMouseEnter={() => setHoveredZoneIndex(index + 4)}
              onMouseLeave={() => setHoveredZoneIndex(null)}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
              <div>
                <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                <p className="text-gray-300 text-xs">{zone.description}</p>
              </div>
            </div>
          ))}
          
          <h3 className="font-semibold text-sm mt-3 mb-1">Infrastructure:</h3>
          {blastZones.slice(7, 8).map((zone, index) => (
            <div 
              key={index} 
              className={`flex items-start p-1 rounded transition-colors ${
                hoveredZoneIndex === index + 7 ? 'bg-gray-800' : ''
              }`}
              onMouseEnter={() => setHoveredZoneIndex(index + 7)}
              onMouseLeave={() => setHoveredZoneIndex(null)}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
              <div>
                <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                <p className="text-gray-300 text-xs">{zone.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <p className="text-xs text-gray-400 mt-4">
          Educational simulation only. Actual effects vary by terrain, weather, and blast altitude.
        </p>
        
        <button
          onClick={() => window.location.href = '/'}
          className="mt-4 w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium transition-colors"
        >
          Calculate Another Blast
        </button>
      </div>
    </div>
  );
}