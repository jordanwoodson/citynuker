import { Polygon, Tooltip } from 'react-leaflet';
import { FalloutZone } from '@/data/nuclearWeapons';

interface FalloutPlumeProps {
  center: [number, number];
  windDirection: number; // degrees from north
  falloutZone: FalloutZone;
  visible: boolean;
}

export function FalloutPlume({ center, windDirection, falloutZone, visible }: FalloutPlumeProps) {
  if (!visible) return null;

  // Convert wind direction to radians (wind blows TO this direction)
  const windRad = (windDirection * Math.PI) / 180;
  
  // Helper function to calculate plume point
  const calculatePlumePoint = (distance: number, angle: number, lateralOffset: number = 0): [number, number] => {
    // Convert distance from km to degrees (rough approximation)
    const kmToDeg = 1 / 111; // 1 degree ≈ 111 km
    
    // Calculate position along wind direction
    const downwindLat = distance * kmToDeg * Math.cos(windRad);
    const downwindLng = distance * kmToDeg * Math.sin(windRad) / Math.cos(center[0] * Math.PI / 180);
    
    // Calculate lateral offset perpendicular to wind
    const lateralLat = lateralOffset * kmToDeg * Math.cos(windRad + angle);
    const lateralLng = lateralOffset * kmToDeg * Math.sin(windRad + angle) / Math.cos(center[0] * Math.PI / 180);
    
    return [
      center[0] + downwindLat + lateralLat,
      center[1] + downwindLng + lateralLng
    ];
  };

  // Create elliptical fallout plumes for different dose levels
  const createPlume = (length: number, width: number, color: string, opacity: number, name: string, description: string) => {
    const points: [number, number][] = [];
    const segments = 20;
    
    // Start from ground zero
    points.push(center);
    
    // Create one side of the ellipse
    for (let i = 0; i <= segments / 2; i++) {
      const progress = i / (segments / 2);
      const distance = length * progress;
      const currentWidth = width * Math.sin(progress * Math.PI) * 0.5;
      const angle = Math.PI / 2; // Perpendicular to wind
      points.push(calculatePlumePoint(distance, angle, currentWidth));
    }
    
    // Create the other side (reverse order)
    for (let i = segments / 2; i >= 0; i--) {
      const progress = i / (segments / 2);
      const distance = length * progress;
      const currentWidth = width * Math.sin(progress * Math.PI) * 0.5;
      const angle = -Math.PI / 2; // Other side
      points.push(calculatePlumePoint(distance, angle, currentWidth));
    }
    
    return (
      <Polygon
        key={name}
        positions={points}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 2,
        }}
      >
        <Tooltip sticky>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs">{description}</div>
          <div className="text-xs">Length: ~{length.toFixed(0)} km</div>
        </Tooltip>
      </Polygon>
    );
  };

  return (
    <>
      {/* Lethal dose zone (innermost, darkest) */}
      {createPlume(
        falloutZone.lethalDose,
        falloutZone.width * 0.6,
        '#4B0082',
        0.6,
        'Lethal Fallout Zone',
        '1000+ rem/hr - Fatal within hours without shelter'
      )}
      
      {/* Serious dose zone (middle) */}
      {createPlume(
        falloutZone.seriousDose,
        falloutZone.width * 0.8,
        '#8B008B',
        0.4,
        'Serious Fallout Zone',
        '300 rem/hr - Severe radiation sickness'
      )}
      
      {/* Moderate dose zone (outermost) */}
      {createPlume(
        falloutZone.moderateDose,
        falloutZone.width,
        '#9932CC',
        0.25,
        'Moderate Fallout Zone',
        '100 rem/hr - Radiation sickness likely'
      )}
    </>
  );
}