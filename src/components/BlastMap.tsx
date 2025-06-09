'use client';

import { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { NuclearWeapon, calculateFallout } from '@/data/nuclearWeapons';
import { FalloutPlume } from '@/components/FalloutPlume';
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
  weaponId?: string;
  weaponData?: NuclearWeapon;
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

// Custom zoom controls component
function ZoomControls() {
  const map = useMap();
  
  return (
    <div className="absolute bottom-32 sm:bottom-4 right-4 z-[999] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="bg-white hover:bg-gray-100 text-black p-2 rounded shadow-lg transition-colors"
        aria-label="Zoom in"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="bg-white hover:bg-gray-100 text-black p-2 rounded shadow-lg transition-colors"
        aria-label="Zoom out"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
    </div>
  );
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
    category: string;
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

export default function BlastMap({ lat, lng, radius, bombName, cityName, weaponData }: BlastMapProps) {
  const [currentPosition, setCurrentPosition] = useState<[number, number]>([lat, lng]);
  const [hoveredZoneIndex, setHoveredZoneIndex] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'blast' | 'thermal' | 'radiation' | 'infrastructure' | 'fallout'>('blast');
  const [mapStyle, setMapStyle] = useState<'voyager' | 'satellite' | 'dark'>('voyager');
  const [showFallout, setShowFallout] = useState(false);
  const [windDirection, setWindDirection] = useState(0); // degrees from north
  const [isGroundBurst, setIsGroundBurst] = useState(false);

  const handlePositionChange = (newLat: number, newLng: number) => {
    setCurrentPosition([newLat, newLng]);
  };

  // Use accurate blast zones from weapon data if available
  const blastZones = weaponData ? [
    {
      radius: weaponData.blastEffects.fireball,
      color: '#FF0000',
      fillOpacity: 0.4,
      name: 'Fireball',
      description: 'Complete vaporization - everything destroyed',
      category: 'blast',
    },
    {
      radius: weaponData.blastEffects.overpressure.psi20 * 1000, // Convert km to meters
      color: '#8B0000',
      fillOpacity: 0.35,
      name: '20 psi overpressure',
      description: 'Complete destruction of reinforced concrete structures',
      category: 'blast',
    },
    {
      radius: weaponData.blastEffects.overpressure.psi5 * 1000,
      color: '#FF6600',
      fillOpacity: 0.3,
      name: '5 psi overpressure',
      description: 'Collapse of most residential buildings, severe injuries',
      category: 'blast',
    },
    {
      radius: weaponData.blastEffects.overpressure.psi2 * 1000,
      color: '#FFAA00',
      fillOpacity: 0.2,
      name: '2 psi overpressure',
      description: 'Moderate damage to houses, injuries from flying debris',
      category: 'blast',
    },
    {
      radius: weaponData.blastEffects.overpressure.psi1 * 1000,
      color: '#FFFF00',
      fillOpacity: 0.15,
      name: '1 psi overpressure',
      description: 'Window breakage, light structural damage',
      category: 'blast',
    },
    {
      radius: weaponData.blastEffects.radiation.rem500 * 1000,
      color: '#FF00FF',
      fillOpacity: 0.15,
      name: 'Radiation (500 rem)',
      description: 'Lethal dose - 50-90% mortality without treatment',
      category: 'radiation',
    },
    {
      radius: weaponData.blastEffects.radiation.rem100 * 1000,
      color: '#9400D3',
      fillOpacity: 0.1,
      name: 'Radiation (100 rem)',
      description: 'Radiation sickness - increased cancer risk',
      category: 'radiation',
    },
    {
      radius: weaponData.blastEffects.thermal.thirdDegree * 1000,
      color: '#00FFFF',
      fillOpacity: 0.1,
      name: '3rd degree burns',
      description: 'Full thickness skin destruction, often fatal',
      category: 'thermal',
    },
    {
      radius: weaponData.blastEffects.thermal.secondDegree * 1000,
      color: '#00CCFF',
      fillOpacity: 0.08,
      name: '2nd degree burns',
      description: 'Blistering, requires medical treatment',
      category: 'thermal',
    },
    {
      radius: weaponData.blastEffects.thermal.firstDegree * 1000,
      color: '#0099FF',
      fillOpacity: 0.06,
      name: '1st degree burns',
      description: 'Sunburn-like effects',
      category: 'thermal',
    },
    {
      // EMP radius approximation: roughly 2x the 1 psi blast radius for airburst
      radius: weaponData.blastEffects.overpressure.psi1 * 2000,
      color: '#8A2BE2',
      fillOpacity: 0.05,
      name: 'EMP effects',
      description: 'Electromagnetic pulse - electronics disruption',
      category: 'infrastructure',
    },
  ] : [
    // Fallback to original approximations if no weapon data
    {
      radius: radius,
      color: '#FF0000',
      fillOpacity: 0.4,
      name: 'Fireball',
      description: 'Complete vaporization - everything destroyed',
      category: 'blast',
    },
    {
      radius: radius * 2.5,
      color: '#FF6600',
      fillOpacity: 0.3,
      name: 'Heavy blast damage',
      description: '5 psi overpressure - most buildings destroyed',
      category: 'blast',
    },
    {
      radius: radius * 4,
      color: '#FFAA00',
      fillOpacity: 0.2,
      name: 'Moderate blast damage',
      description: '1 psi overpressure - residential buildings severely damaged',
      category: 'blast',
    },
    {
      radius: radius * 6,
      color: '#FFFF00',
      fillOpacity: 0.15,
      name: 'Light blast damage',
      description: '0.25 psi overpressure - windows shattered',
      category: 'blast',
    },
    {
      radius: radius * 5,
      color: '#FF00FF',
      fillOpacity: 0.15,
      name: 'Radiation radius (500 rem)',
      description: 'Lethal dose - 50-90% mortality without treatment',
      category: 'radiation',
    },
    {
      radius: radius * 8,
      color: '#9400D3',
      fillOpacity: 0.1,
      name: 'Radiation radius (100 rem)',
      description: 'Radiation sickness - increased cancer risk',
      category: 'radiation',
    },
    {
      radius: radius * 7,
      color: '#00FFFF',
      fillOpacity: 0.1,
      name: '3rd degree burn radius',
      description: 'Severe burns to exposed skin',
      category: 'thermal',
    },
    {
      radius: radius * 10,
      color: '#0080FF',
      fillOpacity: 0.08,
      name: 'Power outage radius',
      description: 'EMP effects - electronics and power grid failure',
      category: 'infrastructure',
    },
  ];

  // Initialize activeZones state based on the number of zones
  const [activeZones, setActiveZones] = useState<Set<number>>(new Set(blastZones.map((_, i) => i)));

  // Calculate fallout zone if applicable
  const falloutZone = useMemo(() => {
    if (!weaponData || !isGroundBurst) return null;
    return calculateFallout(weaponData.yield, true);
  }, [weaponData, isGroundBurst]);

  // Filter zones based on selected category and active zones
  const getVisibleZones = () => {
    if (selectedCategory === 'fallout') return []; // Fallout is handled separately
    return blastZones.filter((zone, index) => {
      if (!activeZones.has(index)) return false;
      if (selectedCategory === 'all') return true;
      return zone.category === selectedCategory;
    });
  };

  // Sort zones by radius (largest first) so smaller zones render on top
  const sortedZones = [...getVisibleZones()].sort((a, b) => b.radius - a.radius);

  // Toggle individual zone visibility
  const toggleZone = (index: number) => {
    const newActiveZones = new Set(activeZones);
    if (newActiveZones.has(index)) {
      newActiveZones.delete(index);
    } else {
      newActiveZones.add(index);
    }
    setActiveZones(newActiveZones);
  };

  // Handle category selection
  const handleCategoryChange = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    // Reset all zones to active when changing category
    setActiveZones(new Set(blastZones.map((_, i) => i)));
  };

  // Get map tile URL based on selected style
  const getMapTileUrl = () => {
    switch (mapStyle) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      default:
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png';
    }
  };

  // Get attribution based on map style
  const getAttribution = () => {
    switch (mapStyle) {
      case 'satellite':
        return 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      case 'dark':
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    }
  };

  return (
    <div className="relative w-full h-screen">
      <MapContainer 
        center={currentPosition} 
        zoom={11} 
        style={{ height: '100%', width: '100%' }}
        preferCanvas={true}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
      >
        <TileLayer
          key={mapStyle}
          attribution={getAttribution()}
          url={getMapTileUrl()}
          subdomains={mapStyle === 'satellite' ? [] : 'abcd'}
          maxZoom={19}
          tileSize={256}
          detectRetina={true}
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
        
        {/* Fallout plume visualization */}
        {falloutZone && (
          <FalloutPlume
            center={currentPosition}
            windDirection={windDirection}
            falloutZone={falloutZone}
            visible={showFallout && (selectedCategory === 'fallout' || selectedCategory === 'all')}
          />
        )}
        
        <DraggableMarker 
          position={currentPosition}
          bombName={bombName}
          cityName={cityName}
          onPositionChange={handlePositionChange}
        />
        
        <ZoomControls />
      </MapContainer>
      
      {/* Map Style Selector - Desktop */}
      <div className="hidden sm:flex absolute top-4 right-4 bg-black bg-opacity-80 text-white rounded-lg z-[999] p-1">
        <button
          onClick={() => setMapStyle('voyager')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            mapStyle === 'voyager' ? 'bg-white text-black' : 'hover:bg-gray-700'
          }`}
        >
          Standard
        </button>
        <button
          onClick={() => setMapStyle('satellite')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            mapStyle === 'satellite' ? 'bg-white text-black' : 'hover:bg-gray-700'
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapStyle('dark')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            mapStyle === 'dark' ? 'bg-white text-black' : 'hover:bg-gray-700'
          }`}
        >
          Dark
        </button>
      </div>
      
      {/* Map Legend - Desktop Only */}
      <div className="hidden sm:block absolute bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg z-[999] max-w-xs max-h-[400px] overflow-y-auto">
        <h4 className="text-xs font-bold mb-2">Quick Reference</h4>
        <div className="space-y-1">
          {sortedZones.map((zone) => {
            const index = blastZones.findIndex(z => z === zone);
            return (
              <div key={index} className="flex items-center text-xs">
                <span 
                  className="inline-block w-3 h-3 rounded-full mr-2 flex-shrink-0" 
                  style={{ backgroundColor: zone.color }}
                />
                <span className="truncate">{zone.name} ({(zone.radius / 1000).toFixed(1)}km)</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Mobile Quick Reference - Positioned to avoid zoom controls */}
      <div className="sm:hidden absolute top-20 left-4 bg-black bg-opacity-80 text-white p-2 rounded-lg z-[999] max-w-[200px] max-h-[250px] overflow-y-auto">
        <h4 className="text-xs font-bold mb-1">Active Zones</h4>
        <div className="space-y-0.5">
          {sortedZones.map((zone) => {
            const index = blastZones.findIndex(z => z === zone);
            return (
              <div key={index} className="flex items-center text-xs">
                <span 
                  className="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0" 
                  style={{ backgroundColor: zone.color }}
                />
                <span className="truncate text-xs">{zone.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Mobile info tab trigger - Bottom of screen */}
      <button
        className={`sm:hidden fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 text-white p-2 z-[1000] 
          flex items-center justify-center transition-all duration-300
          ${showInfo ? 'translate-y-full' : 'translate-y-0'}
        `}
        onClick={() => setShowInfo(true)}
      >
        <div className="flex flex-col items-center">
          <svg className="w-4 h-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-medium">Blast Information</span>
        </div>
      </button>
      
      {/* Desktop sidebar / Mobile bottom sheet */}
      <div className={`
        fixed sm:absolute bg-black bg-opacity-90 text-white rounded-t-2xl sm:rounded-lg z-[1001]
        sm:top-4 sm:left-4 sm:max-w-sm sm:max-h-[90vh] sm:p-4
        ${showInfo ? 'bottom-0' : '-bottom-full'} 
        sm:bottom-auto left-0 right-0 sm:left-4 sm:right-auto
        transition-all duration-300 ease-in-out
        p-4 max-h-[70vh] overflow-y-auto
        ${showInfo ? '' : 'sm:translate-y-0'} sm:block
        shadow-2xl
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
        
        <p className="text-sm mb-1">Weapon: {bombName}</p>
        <p className="text-sm mb-1">Target: {cityName}</p>
        {weaponData && (
          <>
            <p className="text-xs text-gray-400 mb-1">Yield: {weaponData.yield >= 1000 ? `${(weaponData.yield / 1000).toFixed(1)} Mt` : `${weaponData.yield} kt`}</p>
            {weaponData.country && <p className="text-xs text-gray-400 mb-1">Country: {weaponData.country}</p>}
            {weaponData.year && <p className="text-xs text-gray-400 mb-1">Year: {weaponData.year}</p>}
            {weaponData.burstInfo && (
              <>
                <p className="text-xs text-gray-400 mb-1">
                  Typical burst: {weaponData.burstInfo.typical === 'airburst' ? 'Airburst' : 'Ground burst'}
                  {weaponData.burstInfo.height ? ` at ${weaponData.burstInfo.height}m` : ''}
                </p>
                {weaponData.burstInfo.falloutInfo && (
                  <p className="text-xs text-gray-500 italic mb-1">{weaponData.burstInfo.falloutInfo}</p>
                )}
              </>
            )}
          </>
        )}
        <p className="text-xs text-gray-400 mb-3">
          Click map or drag marker to move blast center
        </p>
        
        {/* Map Style Selector - Mobile */}
        <div className="mb-3">
          <p className="text-xs font-semibold mb-2">Map Style:</p>
          <div className="flex gap-1">
            <button
              onClick={() => setMapStyle('voyager')}
              className={`px-2 py-1 text-xs rounded flex-1 transition-colors ${
                mapStyle === 'voyager' ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setMapStyle('satellite')}
              className={`px-2 py-1 text-xs rounded flex-1 transition-colors ${
                mapStyle === 'satellite' ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapStyle('dark')}
              className={`px-2 py-1 text-xs rounded flex-1 transition-colors ${
                mapStyle === 'dark' ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Dark
            </button>
          </div>
        </div>
        
        {/* Category Filter Buttons */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2">Filter by effect type:</p>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => handleCategoryChange('all')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-white text-black' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              All Effects
            </button>
            <button
              onClick={() => handleCategoryChange('blast')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === 'blast' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              Blast
            </button>
            <button
              onClick={() => handleCategoryChange('thermal')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === 'thermal' 
                  ? 'bg-cyan-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              Thermal
            </button>
            <button
              onClick={() => handleCategoryChange('radiation')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === 'radiation' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              Radiation
            </button>
            <button
              onClick={() => handleCategoryChange('infrastructure')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === 'infrastructure' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              Infrastructure
            </button>
            <button
              onClick={() => handleCategoryChange('fallout')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === 'fallout' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              Fallout
            </button>
          </div>
        </div>
        
        {/* Fallout Controls */}
        {weaponData && (
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-xs font-semibold mb-2">Fallout Settings:</p>
            
            {/* Ground Burst Toggle */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs">Burst Type:</span>
              <button
                onClick={() => setIsGroundBurst(!isGroundBurst)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isGroundBurst 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-700 text-white'
                }`}
              >
                {isGroundBurst ? 'Ground Burst' : 'Air Burst'}
              </button>
            </div>
            
            {/* Wind Direction Control */}
            {isGroundBurst && (
              <>
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">Wind Direction:</span>
                    <span className="text-xs text-gray-400">{windDirection}°</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={windDirection}
                      onChange={(e) => setWindDirection(Number(e.target.value))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    {/* Compass indicator */}
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>N</span>
                      <span>E</span>
                      <span>S</span>
                      <span>W</span>
                    </div>
                  </div>
                </div>
                
                {/* Show Fallout Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs">Show Fallout:</span>
                  <button
                    onClick={() => setShowFallout(!showFallout)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      showFallout 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-700 text-white'
                    }`}
                  >
                    {showFallout ? 'Visible' : 'Hidden'}
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-2 italic">
                  Ground bursts create significant radioactive fallout that spreads downwind
                </p>
              </>
            )}
            
            {!isGroundBurst && (
              <p className="text-xs text-gray-500 italic">
                Air bursts minimize fallout by preventing fireball ground contact
              </p>
            )}
          </div>
        )}
        
        <div className="space-y-1.5 text-xs">
          <h3 className="font-semibold text-sm mt-2 mb-1">Active Zones:</h3>
          <p className="text-xs text-gray-400 mb-2">Click to toggle visibility</p>
          
          {/* Group zones by category for display */}
          {selectedCategory === 'all' ? (
            <>
              {/* Blast Effects */}
              <h4 className="font-medium text-xs mt-2 mb-1 text-orange-400">Blast Effects</h4>
              {blastZones.filter(z => z.category === 'blast').map((zone) => {
                const index = blastZones.findIndex(z => z === zone);
                return (
                  <div 
                    key={index} 
                    className={`flex items-start p-1 rounded transition-colors cursor-pointer ${
                      hoveredZoneIndex === index ? 'bg-gray-800' : ''
                    } ${!activeZones.has(index) ? 'opacity-50' : ''}`}
                    onMouseEnter={() => setHoveredZoneIndex(index)}
                    onMouseLeave={() => setHoveredZoneIndex(null)}
                    onClick={() => toggleZone(index)}
                  >
                    <input
                      type="checkbox"
                      checked={activeZones.has(index)}
                      onChange={() => toggleZone(index)}
                      className="mr-2 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <div className="flex-1">
                      <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                      <p className="text-gray-300 text-xs">{zone.description}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* Thermal Effects */}
              <h4 className="font-medium text-xs mt-3 mb-1 text-cyan-400">Thermal Effects</h4>
              {blastZones.filter(z => z.category === 'thermal').map((zone) => {
                const index = blastZones.findIndex(z => z === zone);
                return (
                  <div 
                    key={index} 
                    className={`flex items-start p-1 rounded transition-colors cursor-pointer ${
                      hoveredZoneIndex === index ? 'bg-gray-800' : ''
                    } ${!activeZones.has(index) ? 'opacity-50' : ''}`}
                    onMouseEnter={() => setHoveredZoneIndex(index)}
                    onMouseLeave={() => setHoveredZoneIndex(null)}
                    onClick={() => toggleZone(index)}
                  >
                    <input
                      type="checkbox"
                      checked={activeZones.has(index)}
                      onChange={() => toggleZone(index)}
                      className="mr-2 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <div className="flex-1">
                      <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                      <p className="text-gray-300 text-xs">{zone.description}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* Radiation Effects */}
              <h4 className="font-medium text-xs mt-3 mb-1 text-purple-400">Radiation Effects</h4>
              {blastZones.filter(z => z.category === 'radiation').map((zone) => {
                const index = blastZones.findIndex(z => z === zone);
                return (
                  <div 
                    key={index} 
                    className={`flex items-start p-1 rounded transition-colors cursor-pointer ${
                      hoveredZoneIndex === index ? 'bg-gray-800' : ''
                    } ${!activeZones.has(index) ? 'opacity-50' : ''}`}
                    onMouseEnter={() => setHoveredZoneIndex(index)}
                    onMouseLeave={() => setHoveredZoneIndex(null)}
                    onClick={() => toggleZone(index)}
                  >
                    <input
                      type="checkbox"
                      checked={activeZones.has(index)}
                      onChange={() => toggleZone(index)}
                      className="mr-2 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <div className="flex-1">
                      <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                      <p className="text-gray-300 text-xs">{zone.description}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* Infrastructure Effects */}
              <h4 className="font-medium text-xs mt-3 mb-1 text-blue-400">Infrastructure</h4>
              {blastZones.filter(z => z.category === 'infrastructure').map((zone) => {
                const index = blastZones.findIndex(z => z === zone);
                return (
                  <div 
                    key={index} 
                    className={`flex items-start p-1 rounded transition-colors cursor-pointer ${
                      hoveredZoneIndex === index ? 'bg-gray-800' : ''
                    } ${!activeZones.has(index) ? 'opacity-50' : ''}`}
                    onMouseEnter={() => setHoveredZoneIndex(index)}
                    onMouseLeave={() => setHoveredZoneIndex(null)}
                    onClick={() => toggleZone(index)}
                  >
                    <input
                      type="checkbox"
                      checked={activeZones.has(index)}
                      onChange={() => toggleZone(index)}
                      className="mr-2 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                    <div className="flex-1">
                      <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                      <p className="text-gray-300 text-xs">{zone.description}</p>
                    </div>
                  </div>
                );
              })}
            </>
          ) : selectedCategory === 'fallout' ? (
            /* Show fallout information */
            <div className="space-y-2">
              {isGroundBurst && falloutZone ? (
                <>
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 bg-indigo-800" />
                      <p className="font-medium text-xs">Lethal Fallout Zone</p>
                    </div>
                    <p className="text-gray-300 text-xs ml-4">1000+ rem/hr - Length: ~{falloutZone.lethalDose.toFixed(0)} km</p>
                    <p className="text-gray-400 text-xs ml-4">Fatal within hours without shelter</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 bg-purple-700" />
                      <p className="font-medium text-xs">Serious Fallout Zone</p>
                    </div>
                    <p className="text-gray-300 text-xs ml-4">300 rem/hr - Length: ~{falloutZone.seriousDose.toFixed(0)} km</p>
                    <p className="text-gray-400 text-xs ml-4">Severe radiation sickness</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 bg-purple-500" />
                      <p className="font-medium text-xs">Moderate Fallout Zone</p>
                    </div>
                    <p className="text-gray-300 text-xs ml-4">100 rem/hr - Length: ~{falloutZone.moderateDose.toFixed(0)} km</p>
                    <p className="text-gray-400 text-xs ml-4">Radiation sickness likely</p>
                  </div>
                  <div className="p-2 bg-yellow-900 bg-opacity-30 rounded mt-2">
                    <p className="text-xs text-yellow-300 font-medium">⚠️ Fallout Warning</p>
                    <p className="text-xs text-yellow-200 mt-1">
                      Radioactive particles will fall from the sky for hours after detonation. 
                      Seek shelter immediately and remain indoors for at least 48 hours.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-2 bg-gray-800 rounded">
                  <p className="text-xs text-gray-400">
                    {weaponData ? 
                      'Switch to ground burst to see fallout effects' : 
                      'No weapon selected'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Show only filtered category */
            blastZones.filter(z => z.category === selectedCategory).map((zone) => {
              const index = blastZones.findIndex(z => z === zone);
              return (
                <div 
                  key={index} 
                  className={`flex items-start p-1 rounded transition-colors cursor-pointer ${
                    hoveredZoneIndex === index ? 'bg-gray-800' : ''
                  } ${!activeZones.has(index) ? 'opacity-50' : ''}`}
                  onMouseEnter={() => setHoveredZoneIndex(index)}
                  onMouseLeave={() => setHoveredZoneIndex(null)}
                  onClick={() => toggleZone(index)}
                >
                  <input
                    type="checkbox"
                    checked={activeZones.has(index)}
                    onChange={() => toggleZone(index)}
                    className="mr-2 mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 mt-0.5 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                  <div className="flex-1">
                    <p className="font-medium">{zone.name}: {(zone.radius / 1000).toFixed(1)} km</p>
                    <p className="text-gray-300 text-xs">{zone.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <p className="text-xs text-gray-400 mt-4">
          Educational simulation only. Actual effects vary by terrain, weather, and blast altitude.
        </p>
        
        {/* Desktop version of the button inside the panel */}
        <button
          onClick={() => window.location.href = '/'}
          className="hidden sm:block mt-4 w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium transition-colors"
        >
          Calculate Another Blast
        </button>
      </div>
      
      {/* Calculate Another Blast Button - Fixed position on mobile */}
      <button
        onClick={() => window.location.href = '/'}
        className="sm:hidden fixed bottom-14 left-4 right-4 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-md text-sm font-bold transition-colors z-[1000] shadow-lg"
      >
        Calculate Another Blast
      </button>
    </div>
  );
}