export interface NuclearWeapon {
  id: string;
  name: string;
  yield: number; // in kilotons
  country: string;
  year?: number;
  description: string;
  category: 'historical' | 'tactical' | 'strategic' | 'test';
  // Detailed blast effects data
  blastEffects: {
    fireball: number; // radius in meters
    overpressure: {
      psi20: number; // complete destruction of reinforced concrete structures
      psi5: number;  // collapse of most residential buildings, severe injuries
      psi2: number;  // moderate damage to houses, injuries from flying debris
      psi1: number;  // window breakage, light structural damage
    };
    thermal: {
      thirdDegree: number;  // full thickness skin destruction (8 cal/cm²)
      secondDegree: number; // blistering, requires medical treatment (5 cal/cm²)
      firstDegree: number;  // sunburn-like effects (3 cal/cm²)
    };
    radiation: {
      rem500: number; // LD50/60 - lethal to 50% within 60 days
      rem100: number; // radiation sickness, increased cancer risk
    };
  };
  // Optional variable yield configurations
  variableYields?: number[];
  // Delivery and burst information
  burstInfo?: {
    typical: 'airburst' | 'groundburst';
    height?: number; // typical burst height in meters
    falloutInfo?: string; // brief fallout description
  };
}

// Height of Burst types
export type HeightOfBurst = 'airburst' | 'surface';

// More accurate scaling formulas based on Glasstone & Dolan and NUKEMAP methodology
// These assume an optimized airburst unless otherwise specified
export const calculateBlastEffects = (yieldKt: number, hob: HeightOfBurst = 'airburst'): NuclearWeapon['blastEffects'] => {
  // Surface bursts reduce thermal and increase local radiation effects
  const surfaceBurstFactor = hob === 'surface' ? 0.7 : 1.0; // Thermal reduction for surface burst
  const radiationEnhancement = hob === 'surface' ? 1.5 : 1.0; // Enhanced local radiation for surface burst
  
  // Fireball radius calculation
  // For yields < 100 kT: R = 145 * Y^0.4 meters
  // For yields >= 100 kT: adjust scaling to account for atmospheric effects
  let fireballRadius: number;
  if (yieldKt < 100) {
    fireballRadius = 145 * Math.pow(yieldKt, 0.4);
  } else {
    // Slightly reduced scaling for very large yields due to atmospheric effects
    fireballRadius = 90 * Math.pow(yieldKt, 0.4);
  }
  
  // Blast overpressure radii (in km)
  // Using more accurate scaling with proper constants
  const blastScaling = Math.pow(yieldKt, 0.33);
  const overpressure = {
    psi20: 0.41 * blastScaling,  // Complete destruction of reinforced concrete
    psi5: 0.98 * blastScaling,   // Collapse of most residential buildings
    psi2: 1.91 * blastScaling,   // Moderate damage to houses
    psi1: 3.12 * blastScaling    // Light damage, window breakage
  };
  
  // Thermal radiation radii (in km)
  // Using Y^0.41 scaling as per scientific literature
  const thermalScaling = Math.pow(yieldKt, 0.41);
  const thermal = {
    thirdDegree: 0.67 * thermalScaling * surfaceBurstFactor,  // Full thickness burns
    secondDegree: 1.0 * thermalScaling * surfaceBurstFactor,  // Blistering
    firstDegree: 1.5 * thermalScaling * surfaceBurstFactor    // Sunburn-like
  };
  
  // Initial radiation radii (in km)
  // Using Y^0.19 scaling for prompt radiation
  const radiationScaling = Math.pow(yieldKt, 0.19);
  const radiation = {
    rem500: 0.63 * radiationScaling * radiationEnhancement,  // LD50/60 dose
    rem100: 0.82 * radiationScaling * radiationEnhancement   // Radiation sickness
  };
  
  return {
    fireball: fireballRadius,
    overpressure,
    thermal,
    radiation
  };
};

// Alternative calculation using the 2.5 kT reference scaling
// r_thermal = Y^0.41 * C_th, r_blast = Y^0.33 * C_bl, r_radiation = Y^0.19 * C_rad
// Where Y is in multiples of 2.5 kT and results are in km
export const calculateBlastEffectsAlternative = (yieldKt: number): NuclearWeapon['blastEffects'] => {
  const Y = yieldKt / 2.5; // Convert to multiples of 2.5 kT
  
  return {
    fireball: 145 * Math.pow(yieldKt, 0.4), // meters
    overpressure: {
      psi20: Math.pow(Y, 0.33) * 0.28,  // ~20 psi threshold
      psi5: Math.pow(Y, 0.33) * 0.7,    // ~4.6 psi reference becomes 5 psi
      psi2: Math.pow(Y, 0.33) * 1.4,    // ~2 psi threshold  
      psi1: Math.pow(Y, 0.33) * 2.3     // ~1 psi threshold
    },
    thermal: {
      thirdDegree: Math.pow(Y, 0.41) * 1.0,   // 8 cal/cm² threshold
      secondDegree: Math.pow(Y, 0.41) * 1.5,  // ~5 cal/cm²
      firstDegree: Math.pow(Y, 0.41) * 2.1    // ~3 cal/cm²
    },
    radiation: {
      rem500: Math.pow(Y, 0.19) * 1.0,  // 500 rem threshold
      rem100: Math.pow(Y, 0.19) * 1.3   // 100 rem threshold
    }
  };
};

export const nuclearWeapons: NuclearWeapon[] = [
  // Historical Weapons
  {
    id: 'little-boy',
    name: 'Little Boy',
    yield: 15,
    country: 'USA',
    year: 1945,
    description: 'First nuclear weapon used in warfare, dropped on Hiroshima - uranium gun-type design, airburst at ~600m',
    category: 'historical',
    blastEffects: {
      fireball: 150,
      overpressure: {
        psi20: 0.4,  // 0.3-0.5 km from historical data
        psi5: 1.3,   // ~1.3 km
        psi2: 2.9,   // Consistent with original
        psi1: 4.5    // 4-5 km
      },
      thermal: {
        thirdDegree: 2.5,  // 2-3 km
        secondDegree: 3.5,
        firstDegree: 4.5
      },
      radiation: {
        rem500: 1.25,  // 1-1.5 km
        rem100: 1.6
      }
    },
    burstInfo: {
      typical: 'airburst',
      height: 600,
      falloutInfo: 'Minimal local fallout due to airburst - prevented fireball ground contact'
    }
  },
  {
    id: 'fat-man',
    name: 'Fat Man',
    yield: 21,
    country: 'USA',
    year: 1945,
    description: 'Second nuclear weapon used in warfare, dropped on Nagasaki - plutonium implosion design, airburst at ~500m',
    category: 'historical',
    blastEffects: {
      fireball: 180,
      overpressure: {
        psi20: 0.6,
        psi5: 1.7,
        psi2: 3.2,
        psi1: 4.7
      },
      thermal: {
        thirdDegree: 2.5,
        secondDegree: 3.5,
        firstDegree: 4.5
      },
      radiation: {
        rem500: 1.4,
        rem100: 1.7
      }
    },
    burstInfo: {
      typical: 'airburst',
      height: 500,
      falloutInfo: 'Negligible local fallout - airburst prevented soil uptake'
    }
  },
  {
    id: 'castle-bravo',
    name: 'Castle Bravo',
    yield: 15000,
    country: 'USA',
    year: 1954,
    description: 'Largest US nuclear test at Bikini Atoll - surface burst, massive fallout over 7,000 sq miles',
    category: 'test',
    blastEffects: {
      fireball: 4500,  // 4-5 km across
      overpressure: {
        psi20: 2.7,    // 2.4-3 km
        psi5: 11.0,    // 10-12 km
        psi2: 22.0,
        psi1: 40.0     // 30-40 km
      },
      thermal: {
        thirdDegree: 45.0,  // 40-50 km
        secondDegree: 65.0,
        firstDegree: 85.0
      },
      radiation: {
        rem500: 4.0,
        rem100: 5.5
      }
    },
    burstInfo: {
      typical: 'groundburst',
      height: 0,
      falloutInfo: 'Massive fallout - contaminated 7,000 sq miles, fallout cloud 100 miles long'
    }
  },
  {
    id: 'tsar-bomba',
    name: 'Tsar Bomba',
    yield: 50000,
    country: 'USSR',
    year: 1961,
    description: 'Largest nuclear weapon ever tested, reduced from 100 Mt design',
    category: 'test',
    blastEffects: {
      fireball: 3500,
      overpressure: {
        psi20: 8.8,
        psi5: 22.8,
        psi2: 44.1,
        psi1: 62.6
      },
      thermal: {
        thirdDegree: 100.0,
        secondDegree: 150.0,
        firstDegree: 210.0
      },
      radiation: {
        rem500: 5.7,
        rem100: 7.4
      }
    },
    burstInfo: {
      typical: 'airburst',
      height: 4000,
      falloutInfo: 'Very low fallout for size - "cleanest" megaton test (97% fusion), fireball did not touch ground'
    }
  },

  // Tactical Nuclear Weapons
  {
    id: 'w54',
    name: 'W54 Davy Crockett',
    yield: 0.02,
    country: 'USA',
    year: 1961,
    description: 'Smallest US nuclear weapon, man-portable recoilless rifle - radiation kills within 160m',
    category: 'tactical',
    blastEffects: {
      fireball: 13,
      overpressure: {
        psi20: 0.075,  // 50-100m
        psi5: 0.15,    // ~150m
        psi2: 0.25,
        psi1: 0.35     // 300-400m
      },
      thermal: {
        thirdDegree: 0.15,  // 100-200m
        secondDegree: 0.25,
        firstDegree: 0.35
      },
      radiation: {
        rem500: 0.16,  // 160m lethal radius - primary kill mechanism
        rem100: 0.25
      }
    },
    variableYields: [0.01, 0.02],
    burstInfo: {
      typical: 'groundburst',
      height: 0,
      falloutInfo: 'Significant local fallout for its size - operators had to fire from >400m'
    }
  },
  {
    id: 'b61-mod12',
    name: 'B61 Mod 12',
    yield: 50,
    country: 'USA',
    year: 2022,
    description: 'Modern guided nuclear bomb with dial-a-yield (0.3-50 kt), high accuracy',
    category: 'tactical',
    blastEffects: {
      fireball: 400,
      overpressure: {
        psi20: 0.55,   // 0.5-0.6 km
        psi5: 2.3,     // ~2.3 km
        psi2: 4.5,
        psi1: 6.5      // 6-7 km
      },
      thermal: {
        thirdDegree: 3.75,  // 3.5-4 km
        secondDegree: 5.5,
        firstDegree: 7.5
      },
      radiation: {
        rem500: 1.0,
        rem100: 1.3
      }
    },
    variableYields: [0.3, 1.5, 5, 10, 50]
  },
  {
    id: 'b61-tactical',
    name: 'B61 (Tactical)',
    yield: 10,
    country: 'USA',
    description: 'Variable yield bomb, typical tactical setting',
    category: 'tactical',
    blastEffects: {
      fireball: 152,
      overpressure: {
        psi20: 0.8,
        psi5: 1.9,
        psi2: 3.2,
        psi1: 5.2
      },
      thermal: {
        thirdDegree: 2.5,
        secondDegree: 3.5,
        firstDegree: 5.0
      },
      radiation: {
        rem500: 1.2,
        rem100: 1.3
      }
    }
  },
  {
    id: 'b61-max-tactical',
    name: 'B61 (Max Tactical)',
    yield: 50,
    country: 'USA',
    description: 'Variable yield bomb, maximum tactical setting',
    category: 'tactical',
    blastEffects: {
      fireball: 250,
      overpressure: {
        psi20: 1.6,
        psi5: 3.9,
        psi2: 6.4,
        psi1: 10.4
      },
      thermal: {
        thirdDegree: 6.0,
        secondDegree: 8.0,
        firstDegree: 12.0
      },
      radiation: {
        rem500: 1.5,
        rem100: 1.7
      }
    }
  },

  // Modern Strategic Weapons
  {
    id: 'w76',
    name: 'W76',
    yield: 100,
    country: 'USA',
    description: 'Most common US warhead, Trident submarine-launched',
    category: 'strategic',
    blastEffects: calculateBlastEffects(100)
  },
  {
    id: 'w87',
    name: 'W87',
    yield: 300,
    country: 'USA',
    description: 'Minuteman III ICBM warhead',
    category: 'strategic',
    blastEffects: calculateBlastEffects(300)
  },
  {
    id: 'w88',
    name: 'W88',
    yield: 475,
    country: 'USA',
    year: 1989,
    description: 'Most powerful US warhead, Trident II SLBM MIRV - thermonuclear',
    category: 'strategic',
    blastEffects: {
      fireball: 900,  // 0.8-1 km
      overpressure: {
        psi20: 1.75,  // 1.5-2 km
        psi5: 5.3,    // ~5.3 km
        psi2: 10.5,
        psi1: 16.0    // ~16 km
      },
      thermal: {
        thirdDegree: 10.5,  // 9-12 km
        secondDegree: 15.0,
        firstDegree: 20.0
      },
      radiation: {
        rem500: 2.5,  // 2-3 km
        rem100: 3.2
      }
    }
  },
  {
    id: 'b41',
    name: 'B41 (Mk-41)',
    yield: 25000,
    country: 'USA',
    year: 1960,
    description: 'Highest yield US bomb ever deployed - three-stage thermonuclear, retired 1976',
    category: 'historical',
    blastEffects: {
      fireball: 2000,  // ~4 km diameter
      overpressure: {
        psi20: 6.5,    // 6-7 km
        psi5: 18.0,    // 17-19 km
        psi2: 35.0,
        psi1: 52.0     // 50+ km
      },
      thermal: {
        thirdDegree: 40.0,  // 40+ km
        secondDegree: 60.0,
        firstDegree: 80.0
      },
      radiation: {
        rem500: 5.0,
        rem100: 6.5
      }
    }
  },
  {
    id: 'b83',
    name: 'B83',
    yield: 1200,
    country: 'USA',
    year: 1983,
    description: 'Highest yield US weapon in active service - variable yield gravity bomb',
    category: 'strategic',
    blastEffects: {
      fireball: 1150,  // ~2.3 km diameter
      overpressure: {
        psi20: 2.25,   // 2.0-2.5 km
        psi5: 10.5,    // ~10.5 km (6.5 mi)
        psi2: 18.0,
        psi1: 20.5     // 20-21 km
      },
      thermal: {
        thirdDegree: 12.5,  // 12-13 km
        secondDegree: 17.0,
        firstDegree: 22.0
      },
      radiation: {
        rem500: 2.75,  // ~3 km
        rem100: 3.5
      }
    },
    variableYields: [5, 80, 170, 340, 1200]
  },

  // Russian/Soviet Weapons
  {
    id: 'rds-1',
    name: 'RDS-1 "Joe-1"',
    yield: 22,
    country: 'Soviet Union',
    year: 1949,
    description: 'First Soviet nuclear weapon test - plutonium implosion design',
    category: 'historical',
    blastEffects: calculateBlastEffects(22)
  },
  {
    id: 'r36-ss18-mod3',
    name: 'R-36 SS-18 Mod 3',
    yield: 20000,
    country: 'Soviet Union',
    description: 'Heavy ICBM single warhead variant "Satan" - highest yield deployed after Tsar Bomba',
    category: 'strategic',
    blastEffects: {
      fireball: 2300,  // ~4.6 km diameter
      overpressure: {
        psi20: 6.4,    // ~6.4 km
        psi5: 17.0,    // ~17 km
        psi2: 33.0,
        psi1: 47.0     // ~47 km
      },
      thermal: {
        thirdDegree: 37.5,  // 35-40 km
        secondDegree: 55.0,
        firstDegree: 75.0
      },
      radiation: {
        rem500: 4.5,  // 4-5 km
        rem100: 6.0
      }
    }
  },
  {
    id: 'rds-37',
    name: 'RDS-37',
    yield: 1600,
    country: 'Soviet Union',
    year: 1955,
    description: 'First Soviet thermonuclear weapon test (designed for 3 MT)',
    category: 'test',
    blastEffects: calculateBlastEffects(1600)
  },
  {
    id: 'ss18-satan',
    name: 'SS-18 Satan Warhead',
    yield: 750,
    country: 'Russia',
    description: 'Heavy ICBM warhead, up to 10 per missile',
    category: 'strategic',
    blastEffects: calculateBlastEffects(750)
  },
  {
    id: 'topol-m',
    name: 'Topol-M Warhead',
    yield: 800,
    country: 'Russia',
    description: 'Modern Russian ICBM warhead',
    category: 'strategic',
    blastEffects: calculateBlastEffects(800)
  },

  // Chinese Weapons
  {
    id: 'df5',
    name: 'DF-5 Warhead',
    yield: 4000,
    country: 'China',
    description: 'Chinese ICBM warhead, 4 megaton class',
    category: 'strategic',
    blastEffects: {
      fireball: 570,
      overpressure: {
        psi20: 2.0,
        psi5: 5.4,
        psi2: 8.8,
        psi1: 14.2
      },
      thermal: {
        thirdDegree: 5.4,
        secondDegree: 8.4,
        firstDegree: 11.2
      },
      radiation: {
        rem500: 2.2,
        rem100: 2.5
      }
    }
  },
  {
    id: 'df41',
    name: 'DF-41 Warhead',
    yield: 250,
    country: 'China',
    description: 'Modern Chinese MIRV warhead',
    category: 'strategic',
    blastEffects: calculateBlastEffects(250)
  },

  // United Kingdom
  {
    id: 'orange-herald',
    name: 'Orange Herald',
    yield: 720,
    country: 'United Kingdom',
    year: 1957,
    description: 'Largest UK boosted fission test',
    category: 'test',
    blastEffects: calculateBlastEffects(720)
  },
  
  // France
  {
    id: 'an-11',
    name: 'AN-11',
    yield: 60,
    country: 'France',
    description: 'Early French nuclear bomb',
    category: 'strategic',
    blastEffects: calculateBlastEffects(60)
  },
  {
    id: 'tn-75',
    name: 'TN 75',
    yield: 110,
    country: 'France',
    description: 'French thermonuclear MIRV warhead',
    category: 'strategic',
    blastEffects: calculateBlastEffects(110)
  },
  
  // China
  {
    id: 'china-test-6',
    name: 'Test No. 6',
    yield: 3300,
    country: 'China',
    year: 1967,
    description: 'First Chinese thermonuclear weapon test',
    category: 'test',
    blastEffects: calculateBlastEffects(3300)
  },
  
  // Other Nations
  {
    id: 'shakti-1',
    name: 'Pokhran-II Shakti-I',
    yield: 45,
    country: 'India',
    year: 1998,
    description: 'Indian thermonuclear test device (claimed yield disputed)',
    category: 'test',
    blastEffects: calculateBlastEffects(45)
  },
  {
    id: 'agni-v',
    name: 'Agni-V Warhead',
    yield: 150,
    country: 'India',
    description: 'Indian ICBM warhead (estimated)',
    category: 'strategic',
    blastEffects: calculateBlastEffects(150)
  },
  {
    id: 'chagai-1',
    name: 'Chagai-I Device',
    yield: 25,
    country: 'Pakistan',
    year: 1998,
    description: 'Largest Pakistani nuclear test (estimated yield varies)',
    category: 'test',
    blastEffects: calculateBlastEffects(25)
  },
  {
    id: 'shaheen-iii',
    name: 'Shaheen-III Warhead',
    yield: 40,
    country: 'Pakistan',
    description: 'Pakistani medium-range ballistic missile warhead (estimated)',
    category: 'strategic',
    blastEffects: calculateBlastEffects(40)
  },
  {
    id: 'jericho-iii',
    name: 'Jericho III Warhead',
    yield: 200,
    country: 'Israel',
    description: 'Israeli ICBM warhead (estimated)',
    category: 'strategic',
    blastEffects: calculateBlastEffects(200)
  },
  {
    id: 'nk-2017-test',
    name: '2017 Thermonuclear Test',
    yield: 160,
    country: 'North Korea',
    year: 2017,
    description: 'Largest North Korean test - claimed two-stage H-bomb design',
    category: 'test',
    blastEffects: {
      fireball: 650,  // 0.6-0.7 km
      overpressure: {
        psi20: 1.5,    // ~1.5 km
        psi5: 3.7,     // ~3.7 km
        psi2: 7.2,
        psi1: 11.0     // ~11 km
      },
      thermal: {
        thirdDegree: 6.5,   // 6-7 km
        secondDegree: 9.0,
        firstDegree: 12.0
      },
      radiation: {
        rem500: 1.75,  // 1.5-2 km
        rem100: 2.2
      }
    }
  },
  {
    id: 'hwasong-15',
    name: 'Hwasong-15 Warhead',
    yield: 250,
    country: 'North Korea',
    description: 'North Korean ICBM warhead (estimated)',
    category: 'strategic',
    blastEffects: calculateBlastEffects(250)
  },

  // Generic Examples
  {
    id: '1mt',
    name: '1 Megaton Warhead',
    yield: 1000,
    country: 'Generic',
    description: 'Standard 1 megaton strategic warhead',
    category: 'strategic',
    blastEffects: {
      fireball: 800,
      overpressure: {
        psi20: 2.4,
        psi5: 6.2,
        psi2: 12.0,
        psi1: 17.0
      },
      thermal: {
        thirdDegree: 12.0,
        secondDegree: 18.0,
        firstDegree: 27.0
      },
      radiation: {
        rem500: 2.3,
        rem100: 3.0
      }
    }
  },
  {
    id: '10mt',
    name: '10 Megaton Warhead',
    yield: 10000,
    country: 'Generic',
    description: 'Large strategic warhead',
    category: 'strategic',
    blastEffects: {
      fireball: 770,
      overpressure: {
        psi20: 2.4,
        psi5: 6.5,
        psi2: 10.6,
        psi1: 17.1
      },
      thermal: {
        thirdDegree: 5.8,
        secondDegree: 9.0,
        firstDegree: 12.0
      },
      radiation: {
        rem500: 2.4,
        rem100: 2.7
      }
    }
  },
  {
    id: '25mt',
    name: '25 Megaton Warhead',
    yield: 25000,
    country: 'Generic',
    description: 'Maximum yield example',
    category: 'strategic',
    blastEffects: {
      fireball: 1050,
      overpressure: {
        psi20: 3.1,
        psi5: 8.4,
        psi2: 13.7,
        psi1: 22.1
      },
      thermal: {
        thirdDegree: 8.4,
        secondDegree: 13.0,
        firstDegree: 17.4
      },
      radiation: {
        rem500: 2.7,
        rem100: 3.0
      }
    }
  }
];

// Helper function to get weapon by ID
export const getWeaponById = (id: string): NuclearWeapon | undefined => {
  return nuclearWeapons.find(weapon => weapon.id === id);
};

// Helper function to get weapons by category
export const getWeaponsByCategory = (category: NuclearWeapon['category']): NuclearWeapon[] => {
  return nuclearWeapons.filter(weapon => weapon.category === category);
};

// Fallout calculation for ground bursts
export interface FalloutZone {
  lethalDose: number;      // 1000+ rem/hr zone length in km
  seriousDose: number;     // 300 rem/hr zone length in km  
  moderateDose: number;    // 100 rem/hr zone length in km
  width: number;           // Approximate width at widest point in km
}

export const calculateFallout = (yieldKt: number, isGroundBurst: boolean): FalloutZone | null => {
  if (!isGroundBurst) return null; // Airbursts produce minimal local fallout
  
  // Simplified fallout model based on yield
  // Length scales roughly as Y^0.5, width as Y^0.33
  const yieldMt = yieldKt / 1000;
  
  return {
    lethalDose: 20 * Math.pow(yieldMt, 0.5),     // ~20 km for 1 Mt
    seriousDose: 50 * Math.pow(yieldMt, 0.5),    // ~50 km for 1 Mt
    moderateDose: 100 * Math.pow(yieldMt, 0.5),  // ~100 km for 1 Mt
    width: 5 * Math.pow(yieldMt, 0.33)            // ~5 km for 1 Mt
  };
};

// Effect descriptions for UI
export const effectDescriptions = {
  overpressure: {
    psi20: 'Complete destruction of reinforced concrete structures, heavy equipment destroyed',
    psi5: 'Collapse of most residential buildings, severe injuries from building collapse',
    psi2: 'Moderate damage to houses, injuries from flying glass and debris',
    psi1: 'Window breakage, light structural damage, some injuries from glass'
  },
  thermal: {
    thirdDegree: 'Full thickness skin destruction (8 cal/cm²), often fatal without immediate treatment',
    secondDegree: 'Severe blistering (5 cal/cm²), requires extensive medical treatment',
    firstDegree: 'Sunburn-like effects (3 cal/cm²), painful but typically survivable'
  },
  radiation: {
    rem500: 'LD50/60 - Lethal dose to 50% of exposed population within 60 days without treatment',
    rem100: 'Acute radiation syndrome likely, increased lifetime cancer risk'
  },
  fireball: 'Zone of complete vaporization - everything within this radius is destroyed by extreme heat',
  heightOfBurst: {
    airburst: 'Maximizes blast and thermal effects over wide area, minimal local fallout',
    surface: 'Maximizes ground shock and cratering, produces significant local fallout'
  }
};

// Model assumptions and limitations
export const modelAssumptions = {
  conditions: 'Clear atmospheric conditions, no precipitation',
  terrain: 'Flat terrain with no significant obstructions',
  heightOfBurst: 'Optimized airburst for maximum blast damage unless otherwise specified',
  population: 'Effects on structures and unprotected individuals in the open',
  limitations: [
    'Actual effects may vary significantly based on local conditions',
    'Urban environments may channel or shield blast effects',
    'Weather conditions can reduce thermal radiation effects',
    'Fallout patterns depend heavily on wind and are not modeled here'
  ],
  sources: [
    'Glasstone & Dolan, "The Effects of Nuclear Weapons" (1977)',
    'NUKEMAP by Alex Wellerstein',
    'Federation of American Scientists nuclear weapons effects data',
    'Declassified U.S. nuclear test data'
  ]
};