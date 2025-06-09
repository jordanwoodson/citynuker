'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { nuclearWeapons, NuclearWeapon, modelAssumptions } from '@/data/nuclearWeapons';

interface CitySuggestion {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export default function Home() {
  // Add JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'City Nuker - Nuclear Blast Simulator',
    description: 'Simulate nuclear blast effects on any city. Visualize blast radius, thermal radiation, and fallout patterns with our interactive nuclear weapon effects calculator.',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Nukr',
    },
  };

  useEffect(() => {
    // Add structured data to head
    const scriptTag = document.createElement('script');
    scriptTag.type = 'application/ld+json';
    scriptTag.innerHTML = JSON.stringify(jsonLd);
    document.head.appendChild(scriptTag);
    
    return () => {
      document.head.removeChild(scriptTag);
    };
  }, []);
  const [cityName, setCityName] = useState('');
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(nuclearWeapons[0].id);
  const [selectedCategory, setSelectedCategory] = useState<'all' | NuclearWeapon['category']>('all');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch city suggestions
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      
      // Filter and sort by importance
      const citySuggestions = data
        .filter((item: CitySuggestion) => 
          ['city', 'town', 'village', 'municipality', 'administrative'].some(type => 
            item.type?.includes(type) || (item as unknown as Record<string, string>).class === 'place'
          )
        )
        .sort((a: CitySuggestion, b: CitySuggestion) => b.importance - a.importance)
        .slice(0, 5);
      
      setSuggestions(citySuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Handle input change with debouncing
  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCityName(value);
    setSelectedSuggestionIndex(-1);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: CitySuggestion) => {
    // Extract city name from display_name
    const cityParts = suggestion.display_name.split(',');
    const city = cityParts[0].trim();
    setCityName(city);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNuke = async (e: FormEvent) => {
    e.preventDefault();
    if (!cityName) return;

    setLoading(true);
    
    try {
      // Geocode the city name using Nominatim (free alternative to Google)
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`
      );
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData && geocodeData.length > 0) {
        const location = geocodeData[0];
        const weapon = nuclearWeapons.find(w => w.id === selectedWeaponId);
        
        if (weapon) {
          // Use accurate fireball radius from weapon data
          const fireballRadius = weapon.blastEffects.fireball; // in meters
          
          // Redirect to our blast visualization page
          const params = new URLSearchParams({
            lat: location.lat,
            lng: location.lon,
            radius: fireballRadius.toString(),
            weaponId: weapon.id,
            bomb: weapon.name,
            city: cityName,
          });
          
          // Navigate to the blast visualization page
          window.location.href = `/nuke/blast?${params.toString()}`;
        }
      } else {
        alert('City not found. Please try another city name.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8 text-center">City Nuker</h1>
        
        <form onSubmit={handleNuke} className="space-y-6">
          <div className="relative">
            <label htmlFor="city" className="block text-sm font-medium mb-2">
              City Name
            </label>
            <input
              ref={inputRef}
              type="text"
              id="city"
              value={cityName}
              onChange={handleCityChange}
              onKeyDown={handleKeyDown}
              onFocus={() => cityName.length >= 2 && setShowSuggestions(true)}
              className="w-full px-3 py-2 sm:px-4 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
              placeholder="Enter city name"
              required
              autoComplete="off"
            />
            
            {/* Suggestions dropdown */}
            {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
              <div 
                ref={suggestionRef}
                className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
              >
                {loadingSuggestions ? (
                  <div className="px-4 py-2 text-sm text-gray-400">Loading suggestions...</div>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        index === selectedSuggestionIndex ? 'bg-gray-700' : ''
                      }`}
                      onClick={() => selectSuggestion(suggestion)}
                    >
                      <div className="font-medium">{suggestion.display_name.split(',')[0]}</div>
                      <div className="text-xs text-gray-400">
                        {suggestion.display_name.split(',').slice(1, 3).join(',')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2">
              Weapon Category
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => {
                const category = e.target.value as typeof selectedCategory;
                setSelectedCategory(category);
                // Reset to first weapon in category when category changes
                const weaponsInCategory = category === 'all' 
                  ? nuclearWeapons 
                  : nuclearWeapons.filter(w => w.category === category);
                if (weaponsInCategory.length > 0) {
                  setSelectedWeaponId(weaponsInCategory[0].id);
                }
              }}
              className="w-full px-3 py-2 sm:px-4 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-base mb-4"
            >
              <option value="all">All Weapons</option>
              <option value="historical">Historical</option>
              <option value="tactical">Tactical</option>
              <option value="strategic">Strategic</option>
              <option value="test">Test Weapons</option>
            </select>

            <label htmlFor="weapon" className="block text-sm font-medium mb-2">
              Nuclear Weapon
            </label>
            <select
              id="weapon"
              value={selectedWeaponId}
              onChange={(e) => setSelectedWeaponId(e.target.value)}
              className="w-full px-3 py-2 sm:px-4 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
            >
              {(selectedCategory === 'all' ? nuclearWeapons : nuclearWeapons.filter(w => w.category === selectedCategory)).map((weapon) => (
                <option key={weapon.id} value={weapon.id}>
                  {weapon.name} ({weapon.country}) - {weapon.yield >= 1000 
                    ? `${(weapon.yield / 1000).toFixed(1)} Mt` 
                    : `${weapon.yield} kt`}
                </option>
              ))}
            </select>
            
            {/* Display weapon info */}
            {selectedWeaponId && (() => {
              const weapon = nuclearWeapons.find(w => w.id === selectedWeaponId);
              return weapon ? (
                <div className="mt-2 p-3 bg-gray-900 rounded text-sm">
                  <p className="text-gray-300">{weapon.description}</p>
                  {weapon.year && (
                    <p className="text-gray-400 text-xs mt-1">Deployed: {weapon.year}</p>
                  )}
                </div>
              ) : null;
            })()}
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-md font-bold text-lg transition-colors duration-200"
          >
            {loading ? 'Loading...' : 'NUKE'}
          </button>
        </form>
        
        <div className="mt-8 p-4 bg-gray-800 rounded-md space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Model Assumptions & Limitations</h3>
          <p className="text-xs text-gray-400">
            This educational tool visualizes nuclear weapon effects based on unclassified scientific models.
          </p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Assumes {modelAssumptions.heightOfBurst}</li>
            <li>Based on {modelAssumptions.conditions}</li>
            <li>Assumes {modelAssumptions.terrain}</li>
            <li>Effects shown for {modelAssumptions.population}</li>
          </ul>
          <p className="text-xs text-gray-500 italic">
            {modelAssumptions.limitations[0]}
          </p>
          <div className="text-xs text-gray-600 pt-2 border-t border-gray-700">
            <p className="font-medium mb-1">Data Sources:</p>
            <ul className="space-y-0.5">
              {modelAssumptions.sources.slice(0, 2).map((source, i) => (
                <li key={i}>• {source}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}