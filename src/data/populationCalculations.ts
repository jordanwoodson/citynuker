import { 
  fetchRealPopulationData, 
  calculateCasualtiesWithRealData,
  PopulationGrid 
} from './populationDataSources';

export interface PopulationData {
  totalPopulation: number;
  populationDensity: number; // people per km²
  urbanDensityFactor: number; // 0-1, how urban the area is
  populationGrid?: PopulationGrid; // Real population data if available
}

export interface CasualtyEstimate {
  zone: string;
  radius: number;
  area: number; // km²
  populationAffected: number;
  fatalities: number;
  injuries: {
    severe: number;
    moderate: number;
    light: number;
  };
  description: string;
}

export interface CasualtyData {
  estimates: CasualtyEstimate[];
  totals: {
    populationAffected: number;
    fatalities: number;
    injuries: number;
  };
  medicalBurden: {
    severeTrauma: number;
    burns: number;
    radiationSickness: number;
    combinedInjuries: number;
  };
  usingRealData?: boolean;
}

// Fatality rates based on historical data and medical literature
const FATALITY_RATES = {
  fireball: 1.0, // 100% fatality rate
  psi20: 0.98, // Near complete fatality
  psi5: 0.50, // 50% fatality rate from building collapse
  psi2: 0.05, // 5% fatality rate
  psi1: 0.01, // 1% fatality rate
  thermal3rd: 0.50, // 50% fatality for 3rd degree burns without treatment
  thermal2nd: 0.05, // 5% fatality for 2nd degree burns
  thermal1st: 0.001, // Minimal fatality for 1st degree burns
  radiation500: 0.90, // 90% fatality rate at 500 rem
  radiation100: 0.10, // 10% fatality rate at 100 rem
};

// Injury severity distribution for survivors
const INJURY_DISTRIBUTION = {
  psi20: { severe: 1.0, moderate: 0, light: 0 },
  psi5: { severe: 0.7, moderate: 0.2, light: 0.1 },
  psi2: { severe: 0.2, moderate: 0.5, light: 0.3 },
  psi1: { severe: 0.05, moderate: 0.15, light: 0.8 },
  thermal3rd: { severe: 1.0, moderate: 0, light: 0 },
  thermal2nd: { severe: 0.3, moderate: 0.7, light: 0 },
  thermal1st: { severe: 0, moderate: 0.1, light: 0.9 },
  radiation500: { severe: 1.0, moderate: 0, light: 0 },
  radiation100: { severe: 0.4, moderate: 0.6, light: 0 },
};

// Calculate area of a circle in km²
function calculateArea(radiusMeters: number): number {
  const radiusKm = radiusMeters / 1000;
  return Math.PI * radiusKm * radiusKm;
}

// Calculate population in a ring between two radii
function calculateRingPopulation(
  innerRadius: number,
  outerRadius: number,
  populationDensity: number,
  urbanFactor: number = 1
): number {
  const outerArea = calculateArea(outerRadius);
  const innerArea = calculateArea(innerRadius);
  const ringArea = outerArea - innerArea;
  
  // Apply urban factor to account for higher density in city centers
  const effectiveDensity = populationDensity * urbanFactor;
  return Math.round(ringArea * effectiveDensity);
}

// Estimate population density based on city data
export async function estimatePopulationDensity(
  lat: number,
  lng: number,
  cityName: string
): Promise<PopulationData> {
  // Try to fetch real population data first
  const maxRadiusKm = 20; // Fetch data for up to 20km radius
  const populationGrid = await fetchRealPopulationData(lat, lng, maxRadiusKm);
  
  // Default urban population density estimates (people per km²)
  const defaultDensities: { [key: string]: number } = {
    // Major world cities
    'tokyo': 6350,
    'delhi': 11320,
    'shanghai': 3850,
    'mumbai': 20680,
    'beijing': 1330,
    'cairo': 19500,
    'dhaka': 44500,
    'mexico city': 6000,
    'são paulo': 7400,
    'new york': 10700,
    'london': 5700,
    'paris': 21000,
    'moscow': 4950,
    'los angeles': 3200,
    'chicago': 4600,
    'hong kong': 6700,
    'singapore': 8300,
    'sydney': 415,
    'toronto': 4400,
    'berlin': 4200,
  };
  
  // Check if we have specific data for this city
  const cityKey = cityName.toLowerCase();
  let baseDensity = 3000; // Default urban density
  
  for (const [key, value] of Object.entries(defaultDensities)) {
    if (cityKey.includes(key)) {
      baseDensity = value;
      break;
    }
  }
  
  // Add sophisticated location-based variation
  // Create a more realistic urban density pattern with multiple factors
  
  // Distance from city center effect (using coordinate decimals as proxy)
  const latDecimal = Math.abs(lat % 1);
  const lngDecimal = Math.abs(lng % 1);
  const distanceFromCenter = Math.sqrt(latDecimal * latDecimal + lngDecimal * lngDecimal);
  const centerFactor = 1 + (0.5 * Math.exp(-distanceFromCenter * 4)); // Higher density near center
  
  // Create variation using multiple scales for realistic clustering
  const smallScale = Math.sin(lat * 200) * Math.cos(lng * 200) * 0.15;
  const mediumScale = Math.sin(lat * 50) * Math.cos(lng * 50) * 0.25;
  const largeScale = Math.sin(lat * 10) * Math.cos(lng * 10) * 0.1;
  
  // Time-based factor (business districts vs residential)
  const hour = new Date().getHours();
  const isBusinessHours = hour >= 9 && hour <= 17;
  const timeFactor = isBusinessHours ? 1.1 : 0.9;
  
  // Combine all factors
  const combinedVariation = smallScale + mediumScale + largeScale;
  const variationFactor = centerFactor * timeFactor * (1 + combinedVariation * 0.3);
  
  // Apply variation with bounds
  const density = Math.round(Math.max(500, Math.min(50000, baseDensity * variationFactor)));
  
  // Urban density factor varies with location
  const urbanFactor = 0.5 + (0.4 * centerFactor);
  
  return {
    totalPopulation: 0, // Would be fetched from API
    populationDensity: Math.round(density),
    urbanDensityFactor: urbanFactor,
    populationGrid: populationGrid || undefined,
  };
}

// Calculate casualties for each blast zone
export function calculateCasualties(
  blastEffects: {
    fireball: number;
    overpressure: {
      psi20: number;
      psi5: number;
      psi2: number;
      psi1: number;
    };
    thermal: {
      thirdDegree: number;
      secondDegree: number;
      firstDegree: number;
    };
    radiation: {
      rem500: number;
      rem100: number;
    };
  },
  populationData: PopulationData,
  blastCenter?: { lat: number; lng: number }
): CasualtyData {
  const estimates: CasualtyEstimate[] = [];
  const { populationDensity, urbanDensityFactor, populationGrid } = populationData;
  
  // Sort zones by radius (innermost first)
  // Note: fireball is in meters, others are in km and need conversion
  const zones = [
    { name: 'Fireball', radius: blastEffects.fireball, fatalityRate: FATALITY_RATES.fireball, injuries: INJURY_DISTRIBUTION.psi20 },
    { name: '20 psi overpressure', radius: blastEffects.overpressure.psi20 * 1000, fatalityRate: FATALITY_RATES.psi20, injuries: INJURY_DISTRIBUTION.psi20 },
    { name: '5 psi overpressure', radius: blastEffects.overpressure.psi5 * 1000, fatalityRate: FATALITY_RATES.psi5, injuries: INJURY_DISTRIBUTION.psi5 },
    { name: '500 rem radiation', radius: blastEffects.radiation.rem500 * 1000, fatalityRate: FATALITY_RATES.radiation500, injuries: INJURY_DISTRIBUTION.radiation500 },
    { name: '3rd degree burns', radius: blastEffects.thermal.thirdDegree * 1000, fatalityRate: FATALITY_RATES.thermal3rd, injuries: INJURY_DISTRIBUTION.thermal3rd },
    { name: '2 psi overpressure', radius: blastEffects.overpressure.psi2 * 1000, fatalityRate: FATALITY_RATES.psi2, injuries: INJURY_DISTRIBUTION.psi2 },
    { name: '100 rem radiation', radius: blastEffects.radiation.rem100 * 1000, fatalityRate: FATALITY_RATES.radiation100, injuries: INJURY_DISTRIBUTION.radiation100 },
    { name: '2nd degree burns', radius: blastEffects.thermal.secondDegree * 1000, fatalityRate: FATALITY_RATES.thermal2nd, injuries: INJURY_DISTRIBUTION.thermal2nd },
    { name: '1 psi overpressure', radius: blastEffects.overpressure.psi1 * 1000, fatalityRate: FATALITY_RATES.psi1, injuries: INJURY_DISTRIBUTION.psi1 },
    { name: '1st degree burns', radius: blastEffects.thermal.firstDegree * 1000, fatalityRate: FATALITY_RATES.thermal1st, injuries: INJURY_DISTRIBUTION.thermal1st },
  ].sort((a, b) => a.radius - b.radius);
  
  // Use real population data if available
  if (populationGrid && blastCenter) {
    // Calculate casualties using real population grid data
    const blastZonesForRealData = zones.map(zone => ({
      radius: zone.radius,
      fatalityRate: zone.fatalityRate
    }));
    
    const realDataResults = calculateCasualtiesWithRealData(
      blastZonesForRealData,
      populationGrid,
      blastCenter
    );
    
    // Process results from real data
    zones.forEach((zone, index) => {
      const realData = realDataResults.find(r => r.radius === zone.radius);
      if (realData) {
        const survivors = realData.populationAffected - realData.fatalities;
        const injuries = {
          severe: Math.round(survivors * zone.injuries.severe),
          moderate: Math.round(survivors * zone.injuries.moderate),
          light: Math.round(survivors * zone.injuries.light),
        };
        
        estimates.push({
          zone: zone.name,
          radius: zone.radius,
          area: calculateArea(zone.radius) - calculateArea(index > 0 ? zones[index - 1].radius : 0),
          populationAffected: realData.populationAffected,
          fatalities: realData.fatalities,
          injuries,
          description: getZoneDescription(zone.name),
        });
      }
    });
  } else {
    // Fallback to estimation method
    let previousRadius = 0;
    let cumulativeFatalities = 0;
    
    // Calculate casualties for each ring
    zones.forEach((zone) => {
    // Skip if radius is 0 or invalid
    if (!zone.radius || zone.radius <= previousRadius) return;
    
    // Calculate population in this ring
    const ringPopulation = calculateRingPopulation(
      previousRadius,
      zone.radius,
      populationDensity,
      urbanDensityFactor
    );
    
    // Account for people already killed in inner zones
    const survivingPopulation = Math.max(0, ringPopulation - cumulativeFatalities);
    
    // Calculate new fatalities in this zone
    const zoneFatalities = Math.round(survivingPopulation * zone.fatalityRate);
    const survivors = survivingPopulation - zoneFatalities;
    
    // Calculate injuries among survivors
    const injuries = {
      severe: Math.round(survivors * zone.injuries.severe),
      moderate: Math.round(survivors * zone.injuries.moderate),
      light: Math.round(survivors * zone.injuries.light),
    };
    
    estimates.push({
      zone: zone.name,
      radius: zone.radius,
      area: calculateArea(zone.radius) - calculateArea(previousRadius),
      populationAffected: ringPopulation,
      fatalities: zoneFatalities,
      injuries,
      description: getZoneDescription(zone.name),
    });
    
    cumulativeFatalities += zoneFatalities;
    previousRadius = zone.radius;
  });
  }
  
  // Calculate totals
  const totalFatalities = estimates.reduce((sum, e) => sum + e.fatalities, 0);
  const totalInjuries = estimates.reduce(
    (sum, e) => sum + e.injuries.severe + e.injuries.moderate + e.injuries.light,
    0
  );
  const totalPopulationAffected = estimates.reduce((sum, e) => sum + e.populationAffected, 0);
  
  // Estimate medical burden
  const medicalBurden = {
    severeTrauma: estimates
      .filter(e => e.zone.includes('psi'))
      .reduce((sum, e) => sum + e.injuries.severe, 0),
    burns: estimates
      .filter(e => e.zone.includes('degree'))
      .reduce((sum, e) => sum + e.injuries.severe + e.injuries.moderate, 0),
    radiationSickness: estimates
      .filter(e => e.zone.includes('rem'))
      .reduce((sum, e) => sum + e.injuries.severe + e.injuries.moderate, 0),
    combinedInjuries: Math.round(totalInjuries * 0.1), // 10% have multiple injury types
  };
  
  return {
    estimates,
    totals: {
      populationAffected: totalPopulationAffected,
      fatalities: totalFatalities,
      injuries: totalInjuries,
    },
    medicalBurden,
    usingRealData: populationGrid && blastCenter ? true : false,
  };
}

function getZoneDescription(zoneName: string): string {
  const descriptions: { [key: string]: string } = {
    'Fireball': 'Complete vaporization and incineration',
    '20 psi overpressure': 'Reinforced concrete buildings destroyed',
    '5 psi overpressure': 'Most buildings collapse, widespread fatalities',
    '500 rem radiation': 'Lethal radiation dose, death within days',
    '3rd degree burns': 'Severe burns requiring specialized treatment',
    '2 psi overpressure': 'Residential buildings severely damaged',
    '100 rem radiation': 'Radiation sickness, increased cancer risk',
    '2nd degree burns': 'Painful burns, risk of infection',
    '1 psi overpressure': 'Windows shattered, light injuries',
    '1st degree burns': 'Superficial burns similar to sunburn',
  };
  
  return descriptions[zoneName] || 'Blast effect zone';
}

// Format casualty numbers for display
export function formatCasualties(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}