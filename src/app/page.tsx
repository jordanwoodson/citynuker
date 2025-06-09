'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';

interface Bomb {
  name: string;
  yield: number; // in kilotons
}

interface CitySuggestion {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

const bombs: Bomb[] = [
  { name: 'Little Boy (Hiroshima)', yield: 15 },
  { name: 'Fat Man (Nagasaki)', yield: 21 },
  { name: 'Castle Bravo', yield: 15000 },
  { name: 'Tsar Bomba', yield: 50000 },
  { name: 'W87 (Modern US)', yield: 300 },
  { name: 'B61 (Tactical)', yield: 50 },
];

export default function Home() {
  const [cityName, setCityName] = useState('');
  const [selectedBomb, setSelectedBomb] = useState<string>(bombs[0].name);
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
        .filter((item: any) => 
          ['city', 'town', 'village', 'municipality', 'administrative'].some(type => 
            item.type?.includes(type) || item.class === 'place'
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
        const bomb = bombs.find(b => b.name === selectedBomb);
        
        if (bomb) {
          // Calculate blast radius (rough approximation)
          // Fireball radius calculation
          const fireballRadius = Math.pow(bomb.yield, 0.4) * 145; // in meters
          
          // Redirect to our blast visualization page
          const params = new URLSearchParams({
            lat: location.lat,
            lng: location.lon,
            radius: fireballRadius.toString(),
            bomb: selectedBomb,
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
            <label htmlFor="bomb" className="block text-sm font-medium mb-2">
              Nuclear Bomb Type
            </label>
            <select
              id="bomb"
              value={selectedBomb}
              onChange={(e) => setSelectedBomb(e.target.value)}
              className="w-full px-3 py-2 sm:px-4 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
            >
              {bombs.map((bomb) => (
                <option key={bomb.name} value={bomb.name}>
                  {bomb.name} ({bomb.yield.toLocaleString()} kt)
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-md font-bold text-lg transition-colors duration-200"
          >
            {loading ? 'Loading...' : 'NUKE'}
          </button>
        </form>
        
        <div className="mt-8 p-4 bg-gray-800 rounded-md">
          <p className="text-sm text-gray-400">
            Note: This tool is for educational purposes only. Blast radius calculations are rough approximations.
          </p>
        </div>
      </div>
    </div>
  );
}