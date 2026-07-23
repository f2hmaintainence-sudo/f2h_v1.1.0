'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap, useMapEvents, Circle, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const SECTOR_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#6366f1', '#d946ef', '#0ea5e9', '#facc15', '#e11d48',
  '#10b981', '#7c3aed', '#f43f5e', '#0891b2', '#a3e635',
];

interface HexData {
  hex_id: string;
  sector_index: number;
}

type BranchDisplayShape = 'hexagon' | 'circle' | 'square';

interface HexSectorMapProps {
  hexes: HexData[];
  centerLat?: number;
  centerLng?: number;
  selectedSector?: number | null;
  onSectorClick?: (sectorIndex: number) => void;
  height?: string;
  radiusKm?: number;
  bufferZoneKm?: number;
  emptyMessage?: string;
  displayShape?: BranchDisplayShape | string | null;
}

// Auto-fit to hex bounds
function FitToHexes({ hexes }: { hexes: HexData[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hexes.length === 0 || hasFit.current) return;
    hasFit.current = true;
    
    const points: [number, number][] = [];
    // Sample every 10th hex for performance
    for (let i = 0; i < hexes.length; i += Math.max(1, Math.floor(hexes.length / 50))) {
      const [lat, lng] = cellToLatLng(hexes[i].hex_id);
      points.push([lat, lng]);
    }
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [hexes, map]);

  return null;
}

// Cache hex boundaries
const hexBoundaryCache = new Map<string, [number, number][]>();
function getHexPositions(hexId: string): [number, number][] {
  const cached = hexBoundaryCache.get(hexId);
  if (cached) return cached;
  const boundary = cellToBoundary(hexId);
  const positions = boundary.map(([lat, lng]) => [lat, lng] as [number, number]);
  hexBoundaryCache.set(hexId, positions);
  return positions;
}

// Viewport tracker for culling
function ViewportTracker({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds | null) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, []);

  return null;
}

function MapSizeFixer() {
  const map = useMap();

  useEffect(() => {
    const timers = [80, 250, 500].map(delay => window.setTimeout(() => map.invalidateSize(), delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [map]);

  return null;
}

function getSquareBounds(center: [number, number], radiusKm: number): [[number, number], [number, number]] {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / 85;
  return [
    [center[0] - latDelta, center[1] - lngDelta],
    [center[0] + latDelta, center[1] + lngDelta],
  ];
}

function ShapeFit({ center, radiusKm }: { center: [number, number]; radiusKm?: number }) {
  const map = useMap();

  useEffect(() => {
    if (!radiusKm) return;
    const bounds = getSquareBounds(center, radiusKm);
    const timer = window.setTimeout(() => map.fitBounds(bounds, { padding: [22, 22] }), 120);
    return () => window.clearTimeout(timer);
  }, [center, radiusKm, map]);

  return null;
}
function isRenderableHex(hex: HexData): boolean {
  if (!hex?.hex_id || typeof hex.hex_id !== 'string') return false;
  try {
    const [lat, lng] = cellToLatLng(hex.hex_id);
    const boundary = cellToBoundary(hex.hex_id);
    return Number.isFinite(lat) && Number.isFinite(lng) && boundary.length >= 3;
  } catch {
    return false;
  }
}
const hexCenterCache = new Map<string, [number, number]>();
function getHexCenter(hexId: string): [number, number] {
  const cached = hexCenterCache.get(hexId);
  if (cached) return cached;
  const [lat, lng] = cellToLatLng(hexId);
  const result: [number, number] = [lat, lng];
  hexCenterCache.set(hexId, result);
  return result;
}

export default function HexSectorMap({
  hexes,
  centerLat,
  centerLng,
  selectedSector,
  onSectorClick,
  height = '500px',
  radiusKm,
  bufferZoneKm,
  emptyMessage,
  displayShape = 'hexagon',
}: HexSectorMapProps) {
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(null);
  const boundsTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const validCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  const defaultCenter: [number, number] = validCenter
    ? [Number(centerLat), Number(centerLng)]
    : [12.9716, 77.5946];

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds | null) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      setViewportBounds(bounds);
    }, 150);
  }, []);

  const normalizedShape: BranchDisplayShape = displayShape === 'circle' || displayShape === 'square' ? displayShape : 'hexagon';
  const validHexes = useMemo(() => hexes.filter(isRenderableHex), [hexes]);
  const mapKey = `${defaultCenter[0]}-${defaultCenter[1]}-${normalizedShape}-${validHexes.length}-${validHexes[0]?.hex_id || 'empty'}`;

  // Viewport culling
  const visibleHexes = useMemo(() => {
    if (!viewportBounds || validHexes.length === 0) return validHexes;
    const padded = viewportBounds.pad(0.35);
    return validHexes.filter(h => {
      const [lat, lng] = getHexCenter(h.hex_id);
      return padded.contains([lat, lng]);
    });
  }, [validHexes, viewportBounds]);

  // Sector summary for legend
  const sectorSummary = useMemo(() => {
    const map = new Map<number, number>();
    validHexes.forEach(h => {
      map.set(h.sector_index, (map.get(h.sector_index) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [validHexes]);

  if (normalizedShape === 'hexagon' && validHexes.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 text-gray-400 text-sm" style={{ height }}>
        {emptyMessage || 'No hex data available. Set coordinates and save the branch first.'}
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm flex-1" style={height === '100%' ? undefined : { height }}>
        <MapContainer
          key={mapKey}
          center={defaultCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapSizeFixer />
          {normalizedShape === 'hexagon' ? <FitToHexes hexes={validHexes} /> : <ShapeFit center={defaultCenter} radiusKm={radiusKm} />}
          <ViewportTracker onBoundsChange={handleBoundsChange} />

          {/* Center marker */}
          {validCenter && (
            <Marker position={defaultCenter}>
              <Tooltip direction="top" className="font-semibold">Warehouse</Tooltip>
            </Marker>
          )}

          {/* Delivery radius and buffer zone preview */}
          {validCenter && radiusKm && normalizedShape === 'circle' && (
            <>
              <Circle
                center={defaultCenter}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.10, dashArray: '6, 4' }}
              />
              {bufferZoneKm && bufferZoneKm > 0 && (
                <Circle
                  center={defaultCenter}
                  radius={(radiusKm + bufferZoneKm) * 1000}
                  pathOptions={{ color: '#a855f7', weight: 1.5, fillColor: '#a855f7', fillOpacity: 0.05, dashArray: '4, 4' }}
                />
              )}
            </>
          )}

          {validCenter && radiusKm && normalizedShape === 'square' && (
            <>
              <Rectangle
                bounds={getSquareBounds(defaultCenter, radiusKm)}
                pathOptions={{ color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.10, dashArray: '6, 4' }}
              />
              {bufferZoneKm && bufferZoneKm > 0 && (
                <Rectangle
                  bounds={getSquareBounds(defaultCenter, radiusKm + bufferZoneKm)}
                  pathOptions={{ color: '#a855f7', weight: 1.5, fillColor: '#a855f7', fillOpacity: 0.05, dashArray: '4, 4' }}
                />
              )}
            </>
          )}

          {validCenter && radiusKm && normalizedShape === 'hexagon' && (
            <>
              <Circle
                center={defaultCenter}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.05, dashArray: '6, 4' }}
              />
              {bufferZoneKm && bufferZoneKm > 0 && (
                <Circle
                  center={defaultCenter}
                  radius={(radiusKm + bufferZoneKm) * 1000}
                  pathOptions={{ color: '#a855f7', weight: 1.5, fillColor: '#a855f7', fillOpacity: 0.03, dashArray: '4, 4' }}
                />
              )}
            </>
          )}

          {/* Hex polygons colored by sector. Only shown for hexagon-shaped branches. */}
          {normalizedShape === 'hexagon' && visibleHexes.map(hex => {
            const color = SECTOR_COLORS[hex.sector_index % SECTOR_COLORS.length];
            const isHighlighted = selectedSector === hex.sector_index;

            return (
              <Polygon
                key={hex.hex_id}
                positions={getHexPositions(hex.hex_id)}
                pathOptions={{
                  color: isHighlighted ? '#1e293b' : color,
                  weight: isHighlighted ? 2.5 : 1,
                  fillColor: color,
                  fillOpacity: isHighlighted ? 0.6 : 0.35,
                }}
                eventHandlers={{
                  click: () => onSectorClick?.(hex.sector_index),
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Sector legend */}
      {normalizedShape === 'hexagon' && (
      <div className="flex flex-wrap gap-3 mt-2.5 px-1">
        {sectorSummary.map(([sectorIdx, count]) => (
          <button
            key={sectorIdx}
            onClick={() => onSectorClick?.(sectorIdx)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedSector === sectorIdx
                ? 'bg-gray-800 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{ backgroundColor: SECTOR_COLORS[sectorIdx % SECTOR_COLORS.length] }}
            />
            Sector {sectorIdx} ({count})
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
