'use client';

import React from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  Circle,
} from '@vis.gl/react-google-maps';
import MapErrorBoundary from '../shared/MapErrorBoundary';
import { useClientConfig } from '@/lib/client-config';

interface LivePartnerLocation {
  delivery_partner_id: string;
  lat: number;
  lng: number;
  full_name?: string;
  phone?: string;
  is_stale?: boolean;
}

interface BranchMapProps {
  centerLat?: number;
  centerLng?: number;
  height?: string;
  radiusKm?: number;
  bufferZoneKm?: number;
  livePartners?: LivePartnerLocation[];
  emptyMessage?: string;
}

export default function SectorMap({
  centerLat,
  centerLng,
  height = '400px',
  radiusKm = 5,
  bufferZoneKm = 0,
  livePartners = [],
  emptyMessage = 'No location set for this branch hub',
}: BranchMapProps) {
  // Called before the early return below — hooks may not sit behind a branch.
  const { googleMapsApiKey } = useClientConfig();
  const hasCenter = typeof centerLat === 'number' && typeof centerLng === 'number';
  const defaultCenter = { lat: 12.9716, lng: 77.5946 };
  const center = hasCenter ? { lat: centerLat, lng: centerLng } : defaultCenter;

  if (!hasCenter) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-sm font-semibold"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
      <MapErrorBoundary fallbackMessage="Google Maps API key error. Branch coverage metrics remain operational.">
        <APIProvider apiKey={googleMapsApiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={13}
            mapId="f2h-branch-coverage-map"
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            zoomControl
            style={{ width: '100%', height: '100%' }}
          >
            {/* Main Delivery Radius Circle */}
            <Circle
              center={center}
              radius={radiusKm * 1000}
              strokeColor="#059669"
              strokeWeight={2}
              strokeOpacity={0.8}
              fillColor="#10b981"
              fillOpacity={0.15}
            />

            {/* Buffer Zone Circle */}
            {bufferZoneKm > 0 && (
              <Circle
                center={center}
                radius={(radiusKm + bufferZoneKm) * 1000}
                strokeColor="#9333ea"
                strokeWeight={1.5}
                strokeOpacity={0.7}
                fillColor="#c084fc"
                fillOpacity={0.08}
              />
            )}

            {/* Branch Hub Center Marker */}
            <AdvancedMarker position={center} title="Branch Hub Center" zIndex={50}>
              <Pin background="#059669" borderColor="#047857" glyphColor="#ffffff" scale={1.2} />
            </AdvancedMarker>

            {/* Live delivery partner markers */}
            {livePartners.map((p) => {
              const plat = p.lat !== null && p.lat !== undefined ? Number(p.lat) : NaN;
              const plng = p.lng !== null && p.lng !== undefined ? Number(p.lng) : NaN;
              if (isNaN(plat) || isNaN(plng)) return null;

              return (
                <AdvancedMarker
                  key={p.delivery_partner_id}
                  position={{ lat: plat, lng: plng }}
                  title={`${p.full_name || 'Delivery Partner'}${p.is_stale ? ' (stale)' : ' (live)'}`}
                  zIndex={40}
                >
                  <div
                    className="flex items-center justify-center rounded-full text-white font-bold text-[10px] shadow-lg"
                    style={{
                      width: 32,
                      height: 32,
                      background: p.is_stale ? '#94a3b8' : '#f97316',
                      border: '2px solid white',
                    }}
                  >
                    🏍
                  </div>
                </AdvancedMarker>
              );
            })}
          </Map>
        </APIProvider>
      </MapErrorBoundary>

      {/* Clean Coverage Map Legend */}
      <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs rounded-xl shadow-md border border-slate-200 p-2.5 text-xs space-y-1.5 z-10">
        <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Hub Service Zone</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0" />
          <span className="text-slate-700 font-semibold">{radiusKm} KM Core Radius</span>
        </div>
        {bufferZoneKm > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block shrink-0" />
            <span className="text-slate-700 font-semibold">+{bufferZoneKm} KM Buffer Zone</span>
          </div>
        )}
      </div>
    </div>
  );
}
