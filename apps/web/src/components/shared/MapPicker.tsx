'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  Circle,
  Polygon,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import MapErrorBoundary from './MapErrorBoundary';
import {
  Search,
  Loader2,
  MapPin,
  Circle as CircleIcon,
  Square,
  RectangleHorizontal,
  Hexagon,
  AlertTriangle,
} from 'lucide-react';
import { useClientConfig } from '@/lib/client-config';
import { findOverlappingBranch, ShapeType, BranchArea } from '@/lib/branch-overlap';

export type { ShapeType, BranchArea };
export type ExistingBranch = BranchArea;

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  radiusKm?: number;
  bufferZoneKm?: number;
  existingBranches?: ExistingBranch[];
  selectedShape?: ShapeType;
  onShapeChange?: (shape: ShapeType) => void;
  allowBufferOrder?: boolean;
  onOverlapConflictChange?: (conflict: ExistingBranch | null) => void;
}

interface SearchSuggestion {
  display_name: string;
  lat: number;
  lng: number;
}

const SHAPE_OPTIONS: { value: ShapeType; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'hexagon', label: 'Hexagon', Icon: Hexagon },
  { value: 'circle', label: 'Circle', Icon: CircleIcon },
  { value: 'square', label: 'Square', Icon: Square },
  { value: 'rectangle', label: 'Rectangle', Icon: RectangleHorizontal },
];

const EARTH_RADIUS_KM = 6371;
const RECTANGLE_CORNER_BEARING_DEGREES = Math.atan2(2, 1) * (180 / Math.PI);

function destinationPoint(
  lat: number,
  lng: number,
  distanceKm: number,
  bearingDegrees: number,
): google.maps.LatLngLiteral {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = bearingDegrees * (Math.PI / 180);
  const latitude = lat * (Math.PI / 180);
  const longitude = lng * (Math.PI / 180);

  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(destinationLatitude),
    );

  return {
    lat: destinationLatitude * (180 / Math.PI),
    lng: (((destinationLongitude * (180 / Math.PI) + 540) % 360) - 180),
  };
}

function buildShapePath(
  lat: number,
  lng: number,
  radiusKm: number,
  shape: Exclude<ShapeType, 'circle'>,
): google.maps.LatLngLiteral[] {
  const bearings =
    shape === 'hexagon'
      ? [0, 60, 120, 180, 240, 300]
      : shape === 'square'
        ? [45, 135, 225, 315]
        : [
            RECTANGLE_CORNER_BEARING_DEGREES,
            180 - RECTANGLE_CORNER_BEARING_DEGREES,
            180 + RECTANGLE_CORNER_BEARING_DEGREES,
            360 - RECTANGLE_CORNER_BEARING_DEGREES,
          ];

  return bearings.map((bearing) => destinationPoint(lat, lng, radiusKm, bearing));
}

function CoverageOverlay({
  lat,
  lng,
  radiusKm,
  shape,
  isBuffer = false,
  isExisting = false,
  isConflicting = false,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  shape: ShapeType;
  isBuffer?: boolean;
  isExisting?: boolean;
  isConflicting?: boolean;
}) {
  const color = isConflicting
    ? '#ef4444'
    : isBuffer
      ? '#a855f7'
      : isExisting
        ? '#059669'
        : '#16a34a';

  const strokeWeight = isConflicting ? 2.5 : isBuffer || isExisting ? 1.5 : 2;
  const strokeOpacity = isConflicting ? 0.95 : isBuffer ? 0.7 : isExisting ? 0.6 : 0.9;
  const fillOpacity = isConflicting ? 0.18 : isBuffer ? 0.04 : isExisting ? 0.06 : 0.1;

  if (shape === 'circle') {
    return (
      <Circle
        center={{ lat: Number(lat), lng: Number(lng) }}
        radius={Number(radiusKm) * 1000}
        strokeColor={color}
        strokeWeight={strokeWeight}
        strokeOpacity={strokeOpacity}
        fillColor={color}
        fillOpacity={fillOpacity}
      />
    );
  }

  return (
    <Polygon
      paths={buildShapePath(lat, lng, radiusKm, shape)}
      strokeColor={color}
      strokeWeight={strokeWeight}
      strokeOpacity={strokeOpacity}
      fillColor={color}
      fillOpacity={fillOpacity}
      geodesic
    />
  );
}

// ── Smart Places search bar with theme styling and fallback ──────────────────
function PlacesSearch({
  onPlaceSelect,
}: {
  onPlaceSelect: (lat: number, lng: number, address: string) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Initialize Google Autocomplete if places library loaded
  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    let listener: any = null;
    try {
      if (typeof placesLib.Autocomplete === 'function') {
        autocompleteRef.current = new placesLib.Autocomplete(inputRef.current, {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'in' },
          fields: ['geometry', 'formatted_address'],
        });
        listener = autocompleteRef.current.addListener('place_changed', () => {
          try {
            const place = autocompleteRef.current?.getPlace();
            if (place?.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              onPlaceSelect(lat, lng, place.formatted_address || '');
              if (map) {
                map.panTo({ lat, lng });
                map.setZoom(14);
              }
              setShowDropdown(false);
            }
          } catch {}
        });
      }
    } catch {}

    return () => {
      if (listener && typeof google !== 'undefined' && google?.maps?.event) {
        try {
          google.maps.event.removeListener(listener);
        } catch {}
      }
    };
  }, [placesLib, map, onPlaceSelect]);

  // Fallback search fetcher (Nominatim / Geocoding API)
  const fetchFallbackSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`,
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(
          data.map((item: any) => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          })),
        );
        setShowDropdown(true);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim().length >= 2) {
        fetchFallbackSuggestions(inputValue);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, fetchFallbackSuggestions]);

  const selectSuggestion = (s: SearchSuggestion) => {
    onPlaceSelect(s.lat, s.lng, s.display_name);
    if (map) {
      map.panTo({ lat: s.lat, lng: s.lng });
      map.setZoom(14);
    }
    setInputValue(s.display_name);
    setShowDropdown(false);
  };

  return (
    <div className="absolute top-4 left-4 z-20 w-[280px] sm:w-[380px]">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder="Search location (e.g. Kuppam)..."
          className="w-full pl-10 pr-9 py-2.5 bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl shadow-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 animate-spin" size={16} />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-xs divide-y divide-slate-100 max-h-56 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              onClick={() => selectSuggestion(s)}
              className="px-3.5 py-2.5 hover:bg-emerald-50 cursor-pointer flex items-start gap-2 transition-colors text-slate-700 hover:text-emerald-900 font-medium"
            >
              <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-snug">{s.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Map click handler ───────────────────────────────────────────────────────
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    let listener: any = null;
    try {
      if (typeof google !== 'undefined' && google?.maps?.event) {
        listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e?.latLng) onClick(e.latLng.lat(), e.latLng.lng());
        });
      }
    } catch {}
    return () => {
      if (listener && typeof google !== 'undefined' && google?.maps?.event) {
        try {
          google.maps.event.removeListener(listener);
        } catch {}
      }
    };
  }, [map, onClick]);
  return null;
}

// ── Inner map contents ──────────────────────────────────────────────────────
function MapContents({
  lat,
  lng,
  radiusKm,
  bufferZoneKm,
  existingBranches,
  selectedShape,
  onLocationChange,
  conflictBranchId,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  bufferZoneKm: number;
  existingBranches: ExistingBranch[];
  selectedShape: ShapeType;
  onLocationChange: (lat: number, lng: number) => void;
  conflictBranchId?: string | null;
}) {
  const handlePlaceSelect = useCallback(
    (plat: number, plng: number) => {
      onLocationChange(plat, plng);
    },
    [onLocationChange],
  );

  const hasConflict = Boolean(conflictBranchId);

  return (
    <>
      <PlacesSearch onPlaceSelect={handlePlaceSelect} />
      <ClickHandler onClick={onLocationChange} />

      {/* Selected location marker */}
      <AdvancedMarker
        position={{ lat: Number(lat), lng: Number(lng) }}
        draggable
        onDragEnd={(e) => {
          if (e.latLng) onLocationChange(e.latLng.lat(), e.latLng.lng());
        }}
        title="Branch center — drag to reposition"
      >
        <Pin
          background={hasConflict ? '#ef4444' : '#16a34a'}
          borderColor={hasConflict ? '#b91c1c' : '#15803d'}
          glyphColor="#fff"
          scale={1.2}
        />
      </AdvancedMarker>

      {Number(radiusKm) > 0 && (
        <CoverageOverlay
          lat={lat}
          lng={lng}
          radiusKm={radiusKm}
          shape={selectedShape}
          isConflicting={hasConflict}
        />
      )}

      {Number(radiusKm) > 0 && Number(bufferZoneKm) > 0 && (
        <CoverageOverlay
          lat={lat}
          lng={lng}
          radiusKm={Number(radiusKm) + Number(bufferZoneKm)}
          shape={selectedShape}
          isBuffer
          isConflicting={hasConflict}
        />
      )}

      {/* Existing branches */}
      {existingBranches.map((b) => {
        const blat = b.lat !== null && b.lat !== undefined ? Number(b.lat) : NaN;
        const blng = b.lng !== null && b.lng !== undefined ? Number(b.lng) : NaN;
        if (isNaN(blat) || isNaN(blng)) return null;

        const isConflictingWithThis = conflictBranchId && b.branch_id === conflictBranchId;

        return (
          <React.Fragment key={b.branch_id || b.branch_name}>
            <AdvancedMarker position={{ lat: blat, lng: blng }} title={b.branch_name}>
              <Pin
                background={isConflictingWithThis ? '#ef4444' : '#059669'}
                borderColor={isConflictingWithThis ? '#b91c1c' : '#047857'}
                glyphColor="#fff"
                scale={0.95}
              />
            </AdvancedMarker>
            {b.delivery_radius_km && !isNaN(Number(b.delivery_radius_km)) && (
              <CoverageOverlay
                lat={blat}
                lng={blng}
                radiusKm={Number(b.delivery_radius_km)}
                shape={b.hex_shape ?? 'hexagon'}
                isExisting
                isConflicting={Boolean(isConflictingWithThis)}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Main MapPicker ──────────────────────────────────────────────────────────
export default function MapPicker({
  lat,
  lng,
  onLocationChange,
  radiusKm = 5,
  bufferZoneKm = 0,
  existingBranches = [],
  selectedShape = 'hexagon',
  onShapeChange,
  allowBufferOrder = false,
  onOverlapConflictChange,
}: MapPickerProps) {
  const { googleMapsApiKey } = useClientConfig();
  const defaultCenter = useMemo(() => {
    if (lat && lng) return { lat, lng };
    return { lat: 12.9716, lng: 77.5946 }; // Default: Bangalore
  }, []);

  // Compute branch overlap in real-time
  const conflictBranch = useMemo(() => {
    if (!lat || !lng || !existingBranches.length) return null;
    return findOverlappingBranch(
      {
        lat,
        lng,
        delivery_radius_km: radiusKm,
        buffer_zone: bufferZoneKm,
        allow_buffer_order: allowBufferOrder,
        hex_shape: selectedShape,
        branch_name: 'Current Branch',
      },
      existingBranches,
    );
  }, [lat, lng, radiusKm, bufferZoneKm, allowBufferOrder, selectedShape, existingBranches]);

  useEffect(() => {
    onOverlapConflictChange?.(conflictBranch as ExistingBranch | null);
  }, [conflictBranch, onOverlapConflictChange]);

  return (
    <div className="relative w-full h-full min-h-[480px] rounded-2xl overflow-hidden border border-slate-200/80 shadow-md">
      <MapErrorBoundary fallbackMessage="Google Maps API Key Error. Click anywhere on the map area or use address search.">
        <APIProvider apiKey={googleMapsApiKey} libraries={['places']}>
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={lat && lng ? 13 : 11}
            mapId="f2h-branch-map"
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            zoomControl
            style={{ width: '100%', height: '100%' }}
            onClick={(e) => {
              if (e.detail?.latLng) {
                onLocationChange(e.detail.latLng.lat, e.detail.latLng.lng);
              }
            }}
          >
            {lat && lng ? (
              <MapContents
                lat={lat}
                lng={lng}
                radiusKm={radiusKm}
                bufferZoneKm={bufferZoneKm}
                existingBranches={existingBranches}
                selectedShape={selectedShape}
                onLocationChange={onLocationChange}
                conflictBranchId={conflictBranch?.branch_id}
              />
            ) : (
              <PlacesSearch onPlaceSelect={(plat, plng) => onLocationChange(plat, plng)} />
            )}
          </Map>
        </APIProvider>
      </MapErrorBoundary>

      {/* Floating Side Shape Selector (Only shows shape icons without text, non-intrusive) */}
      {onShapeChange && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur p-1.5 rounded-2xl shadow-xl border border-slate-200/80">
          {SHAPE_OPTIONS.map(({ value, label, Icon }) => {
            const isSelected = selectedShape === value;
            return (
              <button
                key={value}
                type="button"
                aria-label={label}
                title={label}
                onClick={(e) => {
                  e.stopPropagation();
                  onShapeChange(value);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                    : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:scale-105'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {/* Overlap Collision Alert Banner */}
      {conflictBranch && (
        <div className="absolute bottom-4 inset-x-4 z-20 flex justify-center pointer-events-none">
          <div className="bg-rose-600/95 text-white backdrop-blur px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-rose-400 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-lg pointer-events-auto">
            <AlertTriangle size={16} className="shrink-0 text-amber-300" />
            <span>
              Overlap detected with <span className="underline font-extrabold">{conflictBranch.branch_name}</span>. Branches cannot overlap! Please adjust pin position or radius.
            </span>
          </div>
        </div>
      )}

      {/* Subtle Coordinate Badge in Bottom-Left */}
      {lat !== null && lng !== null && lat !== undefined && lng !== undefined && (
        <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur text-[11px] font-mono font-bold text-slate-700 px-3 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1.5 select-all">
          <MapPin size={13} className={conflictBranch ? 'text-rose-600' : 'text-emerald-600'} />
          <span>
            {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
}
