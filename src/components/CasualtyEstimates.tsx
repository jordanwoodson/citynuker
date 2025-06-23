'use client';

import React from 'react';
import { CasualtyData, formatCasualties } from '@/data/populationCalculations';
import { AlertTriangle, Users, Activity, Building2 } from 'lucide-react';

interface CasualtyEstimatesProps {
  casualtyData: CasualtyData | null;
  isLoading?: boolean;
  usingRealData?: boolean;
}

export default function CasualtyEstimates({ casualtyData, isLoading, usingRealData }: CasualtyEstimatesProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-xl border border-gray-800">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <div>
            <div className="text-sm font-medium text-white">Calculating casualties...</div>
            <div className="text-xs text-gray-400">Analyzing population density</div>
          </div>
        </div>
      </div>
    );
  }

  if (!casualtyData) return null;

  const { totals, medicalBurden } = casualtyData;

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Casualty Estimates
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Based on {usingRealData ? 'real-time population data' : 'population density estimates'} and blast effects
        </p>
        {usingRealData && (
          <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Using OpenStreetMap building data
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-950/50 rounded-lg p-3 border border-red-900/50">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">Fatalities</span>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {formatCasualties(totals.fatalities)}
            </div>
          </div>

          <div className="bg-orange-950/50 rounded-lg p-3 border border-orange-900/50">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-orange-400">Injuries</span>
            </div>
            <div className="text-2xl font-bold text-orange-500">
              {formatCasualties(totals.injuries)}
            </div>
          </div>
        </div>

        {/* Medical Burden */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Medical Requirements</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Severe trauma cases:</span>
              <span className="text-gray-300 font-medium">
                {formatCasualties(medicalBurden.severeTrauma)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Burn victims:</span>
              <span className="text-gray-300 font-medium">
                {formatCasualties(medicalBurden.burns)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Radiation sickness:</span>
              <span className="text-gray-300 font-medium">
                {formatCasualties(medicalBurden.radiationSickness)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400 pt-1 border-t border-gray-700">
              <span>Combined injuries:</span>
              <span className="text-gray-300 font-medium">
                {formatCasualties(medicalBurden.combinedInjuries)}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown by Zone */}
        <details className="bg-gray-800/50 rounded-lg border border-gray-700">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/70 transition-colors">
            <span className="text-sm font-medium text-gray-300">Detailed Breakdown</span>
          </summary>
          <div className="p-3 pt-0 space-y-2 max-h-64 overflow-y-auto">
            {casualtyData.estimates
              .filter(est => est.fatalities > 0 || est.injuries.severe > 0)
              .map((estimate, index) => (
                <div key={index} className="text-xs border-b border-gray-700 pb-2 last:border-0">
                  <div className="font-medium text-gray-300 mb-1">{estimate.zone}</div>
                  <div className="grid grid-cols-2 gap-2 text-gray-400">
                    <div>
                      <span className="text-red-400">Deaths:</span>{' '}
                      {formatCasualties(estimate.fatalities)}
                    </div>
                    <div>
                      <span className="text-orange-400">Injuries:</span>{' '}
                      {formatCasualties(
                        estimate.injuries.severe + estimate.injuries.moderate + estimate.injuries.light
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </details>

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 italic">
          * Estimates based on location-aware population density models and historical data. Actual casualties 
          would vary based on time of day, building construction, warning time, and shelter availability.
        </div>
      </div>
    </div>
  );
}