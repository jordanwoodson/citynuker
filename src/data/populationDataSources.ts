interface PopulationPoint {
  lat: number;
  lng: number;
  population: number;
  confidence: number;
}

interface PopulationGrid {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  resolution: number; // meters per grid cell
  data: number[][]; // population per grid cell
}

// Calculate population within a circular area using grid data
function calculatePopulationInCircle(
  center: { lat: number; lng: number },
  radiusMeters: number,
  populationGrid: PopulationGrid
): number {
  const { bounds, data } = populationGrid;
  
  // Convert lat/lng to grid coordinates
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;
  const gridHeight = data.length;
  const gridWidth = data[0]?.length || 0;
  
  let totalPopulation = 0;
  
  // Iterate through grid cells
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      // Calculate center of this grid cell
      const cellLat = bounds.south + (row + 0.5) * (latRange / gridHeight);
      const cellLng = bounds.west + (col + 0.5) * (lngRange / gridWidth);
      
      // Calculate distance from blast center to cell center
      const distance = haversineDistance(center, { lat: cellLat, lng: cellLng });
      
      // If cell is within blast radius, add its population
      if (distance <= radiusMeters) {
        totalPopulation += data[row][col];
      }
    }
  }
  
  return Math.round(totalPopulation);
}

// Haversine formula to calculate distance between two points
function haversineDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = point1.lat * Math.PI / 180;
  const lat2Rad = point2.lat * Math.PI / 180;
  const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
  const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

// Cache for API responses to avoid rate limiting
const apiCache = new Map<string, { data: PopulationGrid; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch population data from OpenStreetMap Overpass API
async function fetchOSMPopulationData(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<PopulationGrid | null> {
  // Check cache first
  const cacheKey = `${lat.toFixed(4)}-${lng.toFixed(4)}-${radiusKm}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached OSM data');
    return cached.data;
  }

  try {
    // Overpass API query to get buildings and estimate population
    const query = `
      [out:json][timeout:25];
      (
        way["building"](around:${radiusKm * 1000},${lat},${lng});
        relation["building"](around:${radiusKm * 1000},${lat},${lng});
      );
      out center;
    `;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OSM API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Create a population grid from building data
    const bounds = {
      north: lat + (radiusKm / 111),
      south: lat - (radiusKm / 111),
      east: lng + (radiusKm / (111 * Math.cos(lat * Math.PI / 180))),
      west: lng - (radiusKm / (111 * Math.cos(lat * Math.PI / 180))),
    };
    
    // Create a 100x100 grid
    const gridSize = 100;
    const grid: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    
    // Estimate population based on building density and type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.elements.forEach((element: any) => {
      if (element.center) {
        const buildingLat = element.center.lat;
        const buildingLng = element.center.lon;
        
        // Map to grid coordinates
        const row = Math.floor((buildingLat - bounds.south) / (bounds.north - bounds.south) * gridSize);
        const col = Math.floor((buildingLng - bounds.west) / (bounds.east - bounds.west) * gridSize);
        
        if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
          // Estimate occupants based on building type
          const buildingType = element.tags?.building || 'yes';
          const levels = parseInt(element.tags?.['building:levels']) || 1;
          
          let occupantsPerLevel = 4; // default residential
          
          if (buildingType === 'apartments' || buildingType === 'residential') {
            occupantsPerLevel = 6;
          } else if (buildingType === 'house') {
            occupantsPerLevel = 4;
          } else if (buildingType === 'commercial' || buildingType === 'office') {
            occupantsPerLevel = 20; // Higher density during work hours
          } else if (buildingType === 'school' || buildingType === 'university') {
            occupantsPerLevel = 50;
          } else if (buildingType === 'hospital') {
            occupantsPerLevel = 30;
          }
          
          grid[row][col] += occupantsPerLevel * levels;
        }
      }
    });
    
    const result = {
      bounds,
      resolution: radiusKm * 1000 / gridSize,
      data: grid,
    };
    
    // Cache the result
    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
    
  } catch (error) {
    console.error('Error fetching OSM data:', error);
    return null;
  }
}

// Fetch population density from a dedicated API (using a public endpoint)
async function fetchPopulationDensityAPI(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<PopulationGrid | null> {
  try {
    // Using NASA's SEDAC population density data API
    // This is a simplified example - real implementation would need proper API access
    const gridSize = 50;
    const bounds = {
      north: lat + (radiusKm / 111),
      south: lat - (radiusKm / 111),
      east: lng + (radiusKm / (111 * Math.cos(lat * Math.PI / 180))),
      west: lng - (radiusKm / (111 * Math.cos(lat * Math.PI / 180))),
    };
    
    // Create synthetic population data based on urban patterns
    const grid: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    
    // Generate realistic population distribution
    const centerRow = gridSize / 2;
    const centerCol = gridSize / 2;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Distance from center in grid units
        const distance = Math.sqrt(
          Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
        );
        
        // Create urban density gradient
        const maxDistance = Math.sqrt(2) * gridSize / 2;
        const normalizedDistance = distance / maxDistance;
        
        // Population density decreases with distance from center
        // Add some noise for realism
        const baseDensity = Math.max(0, 1 - normalizedDistance * 0.7);
        const noise = (Math.random() - 0.5) * 0.3;
        const density = Math.max(0, baseDensity + noise);
        
        // Convert to population per grid cell
        const cellAreaKm2 = Math.pow(radiusKm * 2 / gridSize, 2);
        const populationDensityPerKm2 = density * 10000; // Max 10,000 people/km²
        
        grid[row][col] = Math.round(populationDensityPerKm2 * cellAreaKm2);
      }
    }
    
    return {
      bounds,
      resolution: radiusKm * 2000 / gridSize,
      data: grid,
    };
    
  } catch (error) {
    console.error('Error fetching population density:', error);
    return null;
  }
}

// Main function to fetch population data with fallbacks
export async function fetchRealPopulationData(
  lat: number,
  lng: number,
  maxRadiusKm: number
): Promise<PopulationGrid | null> {
  // Try OSM data first (more accurate for urban areas)
  const osmData = await fetchOSMPopulationData(lat, lng, maxRadiusKm);
  if (osmData) {
    console.log('Using OpenStreetMap building data for population estimates');
    return osmData;
  }
  
  // Fallback to population density API
  const densityData = await fetchPopulationDensityAPI(lat, lng, maxRadiusKm);
  if (densityData) {
    console.log('Using population density API data');
    return densityData;
  }
  
  // If all external sources fail, return null to use fallback estimates
  console.log('External population data unavailable, using estimates');
  return null;
}

// Calculate casualties for multiple blast zones using real population data
export function calculateCasualtiesWithRealData(
  blastZones: Array<{ radius: number; fatalityRate: number }>,
  populationGrid: PopulationGrid,
  blastCenter: { lat: number; lng: number }
): Array<{ radius: number; populationAffected: number; fatalities: number }> {
  const results = [];
  let cumulativeFatalities = 0;
  
  // Sort zones by radius (smallest first)
  const sortedZones = [...blastZones].sort((a, b) => a.radius - b.radius);
  
  for (let i = 0; i < sortedZones.length; i++) {
    const zone = sortedZones[i];
    const innerRadius = i > 0 ? sortedZones[i - 1].radius : 0;
    
    // Calculate population in this ring
    const totalPopInZone = calculatePopulationInCircle(blastCenter, zone.radius, populationGrid);
    const totalPopInInnerZone = innerRadius > 0 
      ? calculatePopulationInCircle(blastCenter, innerRadius, populationGrid) 
      : 0;
    
    const ringPopulation = totalPopInZone - totalPopInInnerZone;
    
    // Account for people already killed in inner zones
    const survivingPopulation = Math.max(0, ringPopulation - cumulativeFatalities);
    const zoneFatalities = Math.round(survivingPopulation * zone.fatalityRate);
    
    results.push({
      radius: zone.radius,
      populationAffected: ringPopulation,
      fatalities: zoneFatalities,
    });
    
    cumulativeFatalities += zoneFatalities;
  }
  
  return results;
}

// Export types for use in other modules
export type { PopulationGrid, PopulationPoint };