'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polygon, Tooltip, FeatureGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2 } from 'lucide-react';

// Fix default Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface ExistingBranch {
  branch_id?: string;
  branch_name: string;
  branch_code?: string;
  lat?: number | null;
  lng?: number | null;
  delivery_radius_km?: number | null;
  buffer_zone?: number | null;
}

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  radiusKm?: number;
  bufferZoneKm?: number;
  existingBranches?: ExistingBranch[];
  selectedShape?: ShapeType;
  onShapeChange?: (shape: ShapeType) => void;
}

function getHexPoints(lat: number, lng: number, radiusKm: number): [number, number][] {
  const r = radiusKm / 111; // degrees per km approximation
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (angleDeg * Math.PI) / 180;
    points.push([
      lat + r * Math.cos(angleRad),
      lng + r * Math.sin(angleRad),
    ]);
  }
  return points;
}

export type ShapeType = 'hexagon' | 'circle' | 'square';

// ─── Circle Overlay ───────────────────────────────────────────────
function CircleOverlay({ lat, lng, radiusKm, bufferZoneKm }: { lat: number; lng: number; radiusKm: number; bufferZoneKm?: number }) {
  const map = useMap();
  useEffect(() => {
    const circle = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      dashArray: '6, 4',
    }).addTo(map);

    let bufferCircle: L.Circle | null = null;
    if (bufferZoneKm && bufferZoneKm > 0) {
      bufferCircle = L.circle([lat, lng], {
        radius: (radiusKm + bufferZoneKm) * 1000,
        color: '#a855f7',
        weight: 1.5,
        fillColor: '#a855f7',
        fillOpacity: 0.04,
        dashArray: '4, 4',
      }).addTo(map);
    }

    return () => {
      map.removeLayer(circle);
      if (bufferCircle) map.removeLayer(bufferCircle);
    };
  }, [lat, lng, radiusKm, bufferZoneKm, map]);
  return null;
}

// ─── Hexagon Overlay ──────────────────────────────────────────────
// Approximates the H3 hex disk shape as a regular hexagon for preview.
function HexagonOverlay({ lat, lng, radiusKm, bufferZoneKm }: { lat: number; lng: number; radiusKm: number; bufferZoneKm?: number }) {
  const map = useMap();
  useEffect(() => {
    // Compute 6 corner points; flat-top hexagon (30° offset)
    const r = radiusKm / 111; // degrees per km approximation
    const points: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i - 30;
      const angleRad = (angleDeg * Math.PI) / 180;
      points.push([
        lat + r * Math.cos(angleRad),
        lng + r * Math.sin(angleRad),
      ]);
    }
    const polygon = L.polygon(points, {
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.10,
      dashArray: '6, 4',
    }).addTo(map);

    let bufferPolygon: L.Polygon | null = null;
    if (bufferZoneKm && bufferZoneKm > 0) {
      const rBuf = (radiusKm + bufferZoneKm) / 111;
      const bufPoints: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i - 30;
        const angleRad = (angleDeg * Math.PI) / 180;
        bufPoints.push([
          lat + rBuf * Math.cos(angleRad),
          lng + rBuf * Math.sin(angleRad),
        ]);
      }
      bufferPolygon = L.polygon(bufPoints, {
        color: '#a855f7',
        weight: 1.5,
        fillColor: '#a855f7',
        fillOpacity: 0.05,
        dashArray: '4, 4',
      }).addTo(map);
    }

    return () => {
      map.removeLayer(polygon);
      if (bufferPolygon) map.removeLayer(bufferPolygon);
    };
  }, [lat, lng, radiusKm, bufferZoneKm, map]);
  return null;
}

// ─── Rectangle Overlay ───────────────────────────────────────────
function RectangleOverlay({ lat, lng, radiusKm, bufferZoneKm }: { lat: number; lng: number; radiusKm: number; bufferZoneKm?: number }) {
  const map = useMap();
  useEffect(() => {
    // 85 degrees per km approximation at India latitudes for longitude
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / 85;
    const bounds: [[number, number], [number, number]] = [
      [lat - latDelta, lng - lngDelta],
      [lat + latDelta, lng + lngDelta],
    ];
    const rect = L.rectangle(bounds, {
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      dashArray: '6, 4',
    }).addTo(map);

    let bufferRect: L.Rectangle | null = null;
    if (bufferZoneKm && bufferZoneKm > 0) {
      const latDeltaBuf = (radiusKm + bufferZoneKm) / 111;
      const lngDeltaBuf = (radiusKm + bufferZoneKm) / 85;
      const boundsBuf: [[number, number], [number, number]] = [
        [lat - latDeltaBuf, lng - lngDeltaBuf],
        [lat + latDeltaBuf, lng + lngDeltaBuf],
      ];
      bufferRect = L.rectangle(boundsBuf, {
        color: '#a855f7',
        weight: 1.5,
        fillColor: '#a855f7',
        fillOpacity: 0.04,
        dashArray: '4, 4',
      }).addTo(map);
    }

    return () => {
      map.removeLayer(rect);
      if (bufferRect) map.removeLayer(bufferRect);
    };
  }, [lat, lng, radiusKm, bufferZoneKm, map]);
  return null;
}

// ─── Shape Overlay Switcher ───────────────────────────────────────
function ShapeOverlay({ lat, lng, radiusKm, bufferZoneKm, shape }: { lat: number; lng: number; radiusKm: number; bufferZoneKm?: number; shape: ShapeType }) {
  if (shape === 'circle') return <CircleOverlay lat={lat} lng={lng} radiusKm={radiusKm} bufferZoneKm={bufferZoneKm} />;
  if (shape === 'square') return <RectangleOverlay lat={lat} lng={lng} radiusKm={radiusKm} bufferZoneKm={bufferZoneKm} />;
  return <HexagonOverlay lat={lat} lng={lng} radiusKm={radiusKm} bufferZoneKm={bufferZoneKm} />;
}

// ─── Click Handler ────────────────────────────────────────────────
function ClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => { onLocationChange(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ─── Auto Center (flies when flyTrigger increments, not on every render) ──
function AutoCenter({ lat, lng, flyTrigger }: { lat: number; lng: number; flyTrigger: number }) {
  const map = useMap();
  const lastTrigger = useRef(-1);
  useEffect(() => {
    if (flyTrigger > lastTrigger.current && lat && lng) {
      map.flyTo([lat, lng], 14, { duration: 0.9 });
      lastTrigger.current = flyTrigger;
    }
  }, [flyTrigger, lat, lng, map]);
  return null;
}

// Custom red dot icon for existing branches
const existingBranchIcon = typeof window !== 'undefined' ? L.divIcon({
  html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
}) : null;

// ─── Main MapPicker ───────────────────────────────────────────────
export default function MapPicker({ lat, lng, onLocationChange, radiusKm = 5, bufferZoneKm = 0, existingBranches = [], selectedShape = 'hexagon', onShapeChange }: MapPickerProps) {
  const defaultCenter: [number, number] = [12.9716, 77.5946]; // Bengaluru
  const center: [number, number] = lat && lng ? [lat, lng] : defaultCenter;

  // Search and Toolbar state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Shape selector state
  const [shape, setShape] = useState<ShapeType>(selectedShape);

  useEffect(() => {
    setShape(selectedShape);
  }, [selectedShape]);

  const handleShapeChange = (nextShape: ShapeType) => {
    setShape(nextShape);
    onShapeChange?.(nextShape);
  };

  // Fly trigger — increments each time a search result is selected
  const [flyTrigger, setFlyTrigger] = useState(0);

  // Nominatim geocoding
  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 3) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'F2H-Admin/1.0' } }
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocation(val), 400);
  };

  const handleResultClick = (result: any) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    onLocationChange(newLat, newLng);
    setFlyTrigger(t => t + 1);
    setSearchQuery(result.display_name.substring(0, 40));
    setShowDropdown(false);
    setIsSearchExpanded(false); // Collapse after selection
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        if (searchQuery === '') setIsSearchExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchQuery]);

  return (
    <div className="relative h-full flex flex-col group">
      {/* ─── Map Container with Overlays ─── */}
      <div className="relative flex-1 rounded-3xl overflow-hidden border-4 border-gray-50 shadow-inner min-h-[300px] bg-gray-100">

        {/* 1. TOP-LEFT: Vertical Toolbar (Draw Controls) */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1 bg-white p-1 rounded-xl shadow-2xl border border-gray-100 animate-in slide-in-from-left-4 duration-500">
          <div className="flex flex-col border-b border-gray-100 pb-1 mb-1">
            <button
              onClick={() => handleShapeChange('hexagon')}
              className={`p-2.5 rounded-lg transition-all ${shape === 'hexagon' ? 'bg-fresh-green text-white shadow-lg shadow-fresh-green/20' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
              title="Hexagon Boundary"
            >
              <div className="w-5 h-5 flex items-center justify-center font-bold">⬡</div>
            </button>
            <button
              onClick={() => handleShapeChange('circle')}
              className={`p-2.5 rounded-lg transition-all ${shape === 'circle' ? 'bg-fresh-green text-white shadow-lg shadow-fresh-green/20' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
              title="Circle Boundary"
            >
              <div className="w-5 h-5 flex items-center justify-center font-bold">○</div>
            </button>
            <button
              onClick={() => handleShapeChange('square')}
              className={`p-2.5 rounded-lg transition-all ${shape === 'square' ? 'bg-fresh-green text-white shadow-lg shadow-fresh-green/20' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
              title="Square Boundary"
            >
              <div className="w-5 h-5 flex items-center justify-center font-bold">□</div>
            </button>
          </div>

          <div className="flex flex-col pt-0.5">
            <button className="p-2.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-fresh-green transition-all" title="Edit Boundary">
              <div className="w-5 h-5 flex items-center justify-center text-[10px] font-bold">✎</div>
            </button>
            <button
              onClick={() => { onLocationChange(0, 0); }} // Placeholder for "clear/delete"
              className="p-2.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
              title="Delete Selection"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[10px] font-bold">✕</div>
            </button>
          </div>
        </div>

        {/* 2. TOP-RIGHT: Expandable Search */}
        <div ref={searchRef} className="absolute top-4 right-4 z-[1000] flex items-center justify-end">
          <div className={`flex items-center bg-white shadow-2xl border border-gray-100 rounded-xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSearchExpanded ? 'w-80' : 'w-12'}`}>
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className={`p-3.5 shrink-0 transition-colors ${isSearchExpanded ? 'text-fresh-green' : 'text-gray-400 hover:text-fresh-green'}`}
            >
              <Search size={18} />
            </button>

            <input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search location..."
              className={`w-full py-3.5 text-sm font-bold text-gray-800 outline-none pr-4 transition-opacity duration-300 ${isSearchExpanded ? 'opacity-100' : 'opacity-0'}`}
            />

            {searching && isSearchExpanded && (
              <div className="pr-4 shrink-0">
                <Loader2 size={16} className="animate-spin text-fresh-green" />
              </div>
            )}
          </div>

          {/* Search Dropdown */}
          {showDropdown && isSearchExpanded && (
            <div className="absolute top-full right-0 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl mt-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {searchResults.length === 0 ? (
                <p className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">No results found</p>
              ) : (
                searchResults.map((result, i) => (
                  <button
                    key={i}
                    onMouseDown={() => handleResultClick(result)}
                    className="w-full text-left px-6 py-4 text-xs font-bold text-gray-500 hover:bg-fresh-green hover:text-white border-b border-gray-50 last:border-0 transition-all"
                  >
                    {result.display_name.length > 55
                      ? result.display_name.substring(0, 55) + '…'
                      : result.display_name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 3. Main Map Container */}
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onLocationChange={onLocationChange} />

          {/* Render existing branch zones and marker pins */}
          {existingBranches?.map((branch) => {
            if (!branch.lat || !branch.lng) return null;
            const radius = Number(branch.delivery_radius_km) || 5;
            const buffer = Number(branch.buffer_zone) || 0;
            const points = getHexPoints(Number(branch.lat), Number(branch.lng), radius);
            let bufferPoints: [number, number][] = [];
            if (buffer > 0) {
              bufferPoints = getHexPoints(Number(branch.lat), Number(branch.lng), radius + buffer);
            }
            return (
              <FeatureGroup key={branch.branch_id || branch.branch_code || `${branch.lat}-${branch.lng}`}>
                {existingBranchIcon && (
                  <Marker
                    position={[Number(branch.lat), Number(branch.lng)]}
                    icon={existingBranchIcon}
                  >
                    <Tooltip sticky>
                      <div className="font-sans p-1">
                        <p className="font-bold text-slate-800 text-xs">{branch.branch_name}</p>
                        {branch.branch_code && <p className="text-[10px] text-slate-500 mt-0.5">Code: {branch.branch_code}</p>}
                        <p className="text-[10px] text-slate-500">Radius: {radius} km {buffer > 0 ? `(+ ${buffer} km buffer)` : ''}</p>
                      </div>
                    </Tooltip>
                  </Marker>
                )}
                <Polygon
                  positions={points}
                  pathOptions={{
                    color: '#f43f5e', // rose-500 for existing branch bounds
                    weight: 1.5,
                    fillColor: '#f43f5e',
                    fillOpacity: 0.04,
                    dashArray: '5, 5'
                  }}
                >
                  <Tooltip sticky>
                    <div className="font-sans p-1">
                      <p className="font-bold text-slate-800 text-xs">{branch.branch_name}</p>
                      {branch.branch_code && <p className="text-[10px] text-slate-500 mt-0.5">Code: {branch.branch_code}</p>}
                      <p className="text-[10px] text-slate-500">Radius: {radius} km {buffer > 0 ? `(+ ${buffer} km buffer)` : ''}</p>
                    </div>
                  </Tooltip>
                </Polygon>
                {buffer > 0 && (
                  <Polygon
                    positions={bufferPoints}
                    pathOptions={{
                      color: '#fda4af', // rose-300
                      weight: 1,
                      fillColor: '#fda4af',
                      fillOpacity: 0.02,
                      dashArray: '3, 5'
                    }}
                  />
                )}
              </FeatureGroup>
            );
          })}

          {lat && lng && (
            <>
              <Marker position={[lat, lng]} />
              <ShapeOverlay lat={lat} lng={lng} radiusKm={radiusKm} bufferZoneKm={bufferZoneKm} shape={shape} />
              <AutoCenter lat={lat} lng={lng} flyTrigger={flyTrigger} />
            </>
          )}
        </MapContainer>
      </div>

      {/* ─── Bottom Status (Optional Info) ─── */}
      <div className="mt-4 flex items-center justify-between px-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
          Click map or search to set hub location
        </p>
        {lat && lng && (
          <div className="flex items-center gap-2 bg-fresh-green/10 px-3 py-1 rounded-full border border-fresh-green/20">
            <span className="w-1.5 h-1.5 bg-fresh-green rounded-full animate-pulse" />
            <p className="text-[10px] font-bold text-fresh-green uppercase">
              {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
