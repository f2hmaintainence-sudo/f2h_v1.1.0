'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  Polygon,
  Circle,
} from '@vis.gl/react-google-maps';
import MapErrorBoundary from '../shared/MapErrorBoundary';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const SECTOR_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#6366f1', '#d946ef', '#0ea5e9', '#facc15', '#e11d48',
  '#10b981', '#7c3aed', '#f43f5e', '#0891b2', '#a3e635',
];

interface SectorData {
  sector_index: number;
  delivery_partner_name?: string;
  customer_count?: number;
  delivery_partner_id?: string;
}

interface LivePartnerLocation {
  delivery_partner_id: string;
  lat: number;
  lng: number;
  full_name?: string;
  phone?: string;
  is_stale?: boolean;
}

interface SectorMapProps {
  centerLat?: number;
  centerLng?: number;
  sectorCount?: number;
  selectedSector?: number | null;
  onSectorClick?: (sectorIndex: number) => void;
  height?: string;
  radiusKm?: number;
  bufferZoneKm?: number;
  sectors?: SectorData[];
  livePartners?: LivePartnerLocation[];
  emptyMessage?: string;
}

/**
 * Compute a pie-slice polygon for a sector.
 * Returns an array of google.maps.LatLngLiteral forming the slice shape.
 */
function computeSectorPolygon(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  sectorIndex: number,
  sectorCount: number,
  steps = 24,
): google.maps.LatLngLiteral[] {
  const R = 6371; // Earth radius km
  const startAngle = (sectorIndex * 360) / sectorCount;
  const endAngle = ((sectorIndex + 1) * 360) / sectorCount;

  const toRad = (d: number) => (d * Math.PI) / 180;

  function pointAt(angleDeg: number): google.maps.LatLngLiteral {
    const bearing = toRad(angleDeg);
    const lat1 = toRad(centerLat);
    const lng1 = toRad(centerLng);
    const d = radiusKm / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );

    return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
  }

  const points: google.maps.LatLngLiteral[] = [{ lat: centerLat, lng: centerLng }];
  const stepSize = (endAngle - startAngle) / steps;
  for (let i = 0; i <= steps; i++) {
    points.push(pointAt(startAngle + i * stepSize));
  }
  points.push({ lat: centerLat, lng: centerLng });
  return points;
}

/** Label position for a sector (midpoint bearing, 60% out from center) */
function sectorLabelPosition(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  sectorIndex: number,
  sectorCount: number,
): google.maps.LatLngLiteral {
  const midAngle = ((sectorIndex + 0.5) * 360) / sectorCount;
  const bearing = (midAngle * Math.PI) / 180;
  const d = (radiusKm * 0.6) / 6371;
  const lat1 = (centerLat * Math.PI) / 180;
  const lng1 = (centerLng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

/** Hex to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function SectorMap({
  centerLat,
  centerLng,
  sectorCount = 3,
  selectedSector = null,
  onSectorClick,
  height = '400px',
  radiusKm = 5,
  bufferZoneKm = 0,
  sectors = [],
  livePartners = [],
  emptyMessage = 'No location set for this branch',
}: SectorMapProps) {
  const [infoSector, setInfoSector] = useState<number | null>(null);

  const hasCenter = typeof centerLat === 'number' && typeof centerLng === 'number';
  const defaultCenter = { lat: 12.9716, lng: 77.5946 };
  const center = hasCenter ? { lat: centerLat, lng: centerLng } : defaultCenter;

  // Build pie slices
  const slices = useMemo(() => {
    if (!hasCenter) return [];
    return Array.from({ length: sectorCount }, (_, i) => ({
      index: i,
      polygon: computeSectorPolygon(centerLat, centerLng, radiusKm, i, sectorCount),
      labelPos: sectorLabelPosition(centerLat, centerLng, radiusKm, i, sectorCount),
      color: SECTOR_COLORS[i % SECTOR_COLORS.length],
      data: sectors.find((s) => s.sector_index === i),
    }));
  }, [hasCenter, centerLat, centerLng, radiusKm, sectorCount, sectors]);

  const handleSectorClick = useCallback(
    (idx: number) => {
      setInfoSector(infoSector === idx ? null : idx);
      onSectorClick?.(idx);
    },
    [infoSector, onSectorClick],
  );

  if (!hasCenter) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-sm"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow" style={{ height }}>
      <MapErrorBoundary fallbackMessage="Google Maps API Key Error (ApiProjectMapError). Delivery sector metrics & partner allocation remain operational.">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={13}
          mapId="f2h-sector-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          zoomControl
          style={{ width: '100%', height: '100%' }}
        >
          {/* Sector pie slices */}
          {slices.map((slice) => {
            const isSelected = selectedSector === slice.index;
            const color = slice.color;
            return (
              <React.Fragment key={slice.index}>
                <Polygon
                  paths={slice.polygon}
                  strokeColor={color}
                  strokeWeight={isSelected ? 3 : 1.5}
                  strokeOpacity={0.9}
                  fillColor={color}
                  fillOpacity={isSelected ? 0.35 : 0.15}
                  onClick={() => handleSectorClick(slice.index)}
                  zIndex={isSelected ? 10 : 1}
                />

                {/* Sector label marker */}
                <AdvancedMarker
                  position={slice.labelPos}
                  onClick={() => handleSectorClick(slice.index)}
                  zIndex={20}
                >
                  <div
                    className="flex flex-col items-center justify-center rounded-full shadow-lg cursor-pointer select-none transition-transform hover:scale-110"
                    style={{
                      width: 44,
                      height: 44,
                      background: color,
                      border: isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.7)',
                      boxShadow: isSelected ? `0 0 0 3px ${color}` : undefined,
                    }}
                  >
                    <span className="text-white font-bold text-xs leading-none">S{slice.index + 1}</span>
                    {slice.data?.customer_count !== undefined && (
                      <span className="text-white text-[9px] leading-none opacity-90">
                        {slice.data.customer_count}c
                      </span>
                    )}
                  </div>
                </AdvancedMarker>

                {/* Info popup for selected sector */}
                {infoSector === slice.index && slice.data && (
                  <AdvancedMarker position={slice.labelPos} zIndex={30}>
                    <div
                      className="bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs w-44 pointer-events-none"
                      style={{ transform: 'translate(-50%, -130%)' }}
                    >
                      <div className="font-semibold text-slate-800 mb-1">Sector {slice.index + 1}</div>
                      {slice.data.delivery_partner_name ? (
                        <div className="text-slate-600">🚴 {slice.data.delivery_partner_name}</div>
                      ) : (
                        <div className="text-orange-500">⚠ Unassigned</div>
                      )}
                      {slice.data.customer_count !== undefined && (
                        <div className="text-slate-500 mt-0.5">👥 {slice.data.customer_count} customers</div>
                      )}
                    </div>
                  </AdvancedMarker>
                )}
              </React.Fragment>
            );
          })}

          {/* Delivery radius outer ring */}
          <Circle
            center={center}
            radius={radiusKm * 1000}
            strokeColor="#64748b"
            strokeWeight={1.5}
            strokeOpacity={0.4}
            fillOpacity={0}
          />

          {/* Buffer zone ring */}
          {bufferZoneKm > 0 && (
            <Circle
              center={center}
              radius={(radiusKm + bufferZoneKm) * 1000}
              strokeColor="#a855f7"
              strokeWeight={1}
              strokeOpacity={0.35}
              fillOpacity={0}
            />
          )}

          {/* Branch center pin */}
          <AdvancedMarker position={center} title="Branch center" zIndex={50}>
            <Pin background="#1e293b" borderColor="#0f172a" glyphColor="#fff" scale={1.1} />
          </AdvancedMarker>

          {/* Live delivery partner markers */}
          {livePartners.map((p) => (
            <AdvancedMarker
              key={p.delivery_partner_id}
              position={{ lat: p.lat, lng: p.lng }}
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
          ))}
        </Map>
      </APIProvider>
      </MapErrorBoundary>

      {/* Legend */}
      {slices.length > 0 && (
        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur rounded-xl shadow-lg p-2 text-xs max-h-32 overflow-y-auto">
          <div className="font-semibold text-slate-600 mb-1.5">Sectors</div>
          {slices.map((s) => (
            <div
              key={s.index}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
              onClick={() => handleSectorClick(s.index)}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-slate-700">S{s.index + 1}</span>
              {s.data?.delivery_partner_name ? (
                <span className="text-slate-500 truncate max-w-[80px]">{s.data.delivery_partner_name}</span>
              ) : (
                <span className="text-orange-400">unassigned</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
