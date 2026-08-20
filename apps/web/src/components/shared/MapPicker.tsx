'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useClientConfig } from '@/lib/client-config';
export type ShapeType = 'hexagon' | 'circle' | 'square' | 'rectangle';

interface ExistingBranch {
  branch_id?: string;
  branch_name: string;
  branch_code?: string;
  lat?: number | null;
  lng?: number | null;
  delivery_radius_km?: number | null;
  buffer_zone?: number | null;
  hex_shape?: ShapeType;
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

interface SearchSuggestion {
  display_name: string;
  lat: number;
  lng: number;
}

const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle', Icon: CircleIcon },
  { value: 'square', label: 'Square', Icon: Square },
  { value: 'rectangle', label: 'Rectangle', Icon: RectangleHorizontal },
  { value: 'hexagon', label: 'Hexagon', Icon: Hexagon },
] as const;

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
    Math.sin(latitude) * Math.cos(angularDistance)
    + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
  );

  return {
    lat: destinationLatitude * (180 / Math.PI),
    lng: ((((destinationLongitude * (180 / Math.PI)) + 540) % 360) - 180),
  };
}

function buildShapePath(
  lat: number,
  lng: number,
  radiusKm: number,
  shape: Exclude<ShapeType, 'circle'>,
): google.maps.LatLngLiteral[] {
  const bearings = shape === 'hexagon'
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
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  shape: ShapeType;
  isBuffer?: boolean;
  isExisting?: boolean;
}) {
  const color = isBuffer ? '#a855f7' : isExisting ? '#059669' : '#16a34a';
  const strokeWeight = isBuffer || isExisting ? 1.5 : 2;
  const strokeOpacity = isBuffer ? 0.7 : isExisting ? 0.5 : 0.9;
  const fillOpacity = isBuffer ? 0.04 : isExisting ? 0.05 : 0.08;

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
function PlacesSearch({ onPlaceSelect }: { onPlaceSelect: (lat: number, lng: number, address: string) => void }) {
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
          } catch { }
        });
      }
    } catch { }

    return () => {
      if (listener && typeof google !== 'undefined' && google?.maps?.event) {
        try {
          google.maps.event.removeListener(listener);
        } catch { }
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
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[320px] sm:w-[420px]">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder="Search location, town, or address (e.g. Kuppam)..."
          className="w-full pl-10 pr-9 py-2.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 animate-spin" size={16} />
        )}
      </div>

      {/* Fallback Custom Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden text-xs divide-y divide-slate-100 max-h-56 overflow-y-auto">
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
    } catch { }
    return () => {
      if (listener && typeof google !== 'undefined' && google?.maps?.event) {
        try {
          google.maps.event.removeListener(listener);
        } catch { }
      }
    };
  }, [map, onClick]);
  return null;
}

// ── Inner map contents ──────────────────────────────────────────────────────
function MapContents({
  lat, lng, radiusKm, bufferZoneKm, existingBranches, selectedShape, onLocationChange,
}: {
  lat: number; lng: number; radiusKm: number; bufferZoneKm: number;
  existingBranches: ExistingBranch[]; selectedShape: ShapeType;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const handlePlaceSelect = useCallback((plat: number, plng: number) => {
    onLocationChange(plat, plng);
  }, [onLocationChange]);

  return (
    <>
      <PlacesSearch onPlaceSelect={handlePlaceSelect} />
      <ClickHandler onClick={onLocationChange} />

      {/* Selected location marker (Green Theme) */}
      <AdvancedMarker
        position={{ lat: Number(lat), lng: Number(lng) }}
        draggable
        onDragEnd={(e) => {
          if (e.latLng) onLocationChange(e.latLng.lat(), e.latLng.lng());
        }}
        title="Branch center — drag to reposition"
      >
        <Pin background="#16a34a" borderColor="#15803d" glyphColor="#fff" scale={1.2} />
      </AdvancedMarker>

      {Number(radiusKm) > 0 && (
        <CoverageOverlay
          lat={lat}
          lng={lng}
          radiusKm={radiusKm}
          shape={selectedShape}
        />
      )}

      {Number(radiusKm) > 0 && Number(bufferZoneKm) > 0 && (
        <CoverageOverlay
          lat={lat}
          lng={lng}
          radiusKm={Number(radiusKm) + Number(bufferZoneKm)}
          shape={selectedShape}
          isBuffer
        />
      )}

      {/* Existing branches */}
      {existingBranches.map((b) => {
        const blat = b.lat !== null && b.lat !== undefined ? Number(b.lat) : NaN;
        const blng = b.lng !== null && b.lng !== undefined ? Number(b.lng) : NaN;
        if (isNaN(blat) || isNaN(blng)) return null;

        return (
          <React.Fragment key={b.branch_id || b.branch_name}>
            <AdvancedMarker
              position={{ lat: blat, lng: blng }}
              title={b.branch_name}
            >
              <Pin background="#059669" borderColor="#047857" glyphColor="#fff" scale={0.9} />
            </AdvancedMarker>
            {b.delivery_radius_km && !isNaN(Number(b.delivery_radius_km)) && (
              <CoverageOverlay
                lat={blat}
                lng={blng}
                radiusKm={Number(b.delivery_radius_km)}
                shape={b.hex_shape ?? 'circle'}
                isExisting
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
  selectedShape = 'circle',
  onShapeChange,
}: MapPickerProps) {
  const { googleMapsApiKey } = useClientConfig();
  const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bangalore
  const center = lat && lng ? { lat, lng } : defaultCenter;

  return (
    <div className="flex flex-col gap-3 w-full h-full min-h-[360px]">
      {/* Hub Location Coordinates Bar */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 font-bold text-xs text-slate-700">
          <MapPin size={16} className="text-emerald-600 shrink-0" />
          <span>Geocoded Hub Location:</span>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md min-w-[260px]">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400">LAT</span>
            <input
              type="number"
              step="any"
              placeholder="12.762813"
              value={lat !== null && lat !== undefined ? lat : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onLocationChange(isNaN(val) ? 0 : val, lng !== null && lng !== undefined ? lng : 77.5946);
              }}
              className="w-full pl-9 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-emerald-600 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400">LNG</span>
            <input
              type="number"
              step="any"
              placeholder="78.351635"
              value={lng !== null && lng !== undefined ? lng : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onLocationChange(lat !== null && lat !== undefined ? lat : 12.9716, isNaN(val) ? 0 : val);
              }}
              className="w-full pl-9 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-emerald-600 focus:outline-none shadow-2xs"
            />
          </div>

          {(!lat || !lng) && (
            <button
              type="button"
              onClick={() => onLocationChange(12.762813, 78.351635)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              Set Location
            </button>
          )}
        </div>
      </div>

      {/* Interactive Map View */}
      <div className="relative w-full flex-1 min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
        <MapErrorBoundary fallbackMessage="Google Maps API Key Error (ApiProjectMapError). Use the Latitude/Longitude fields above to configure hub coordinates.">
          <APIProvider apiKey={googleMapsApiKey} libraries={['places']}>
            <Map
              defaultCenter={center}
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
              {lat && lng && (
                <MapContents
                  lat={lat}
                  lng={lng}
                  radiusKm={radiusKm}
                  bufferZoneKm={bufferZoneKm}
                  existingBranches={existingBranches}
                  selectedShape={selectedShape}
                  onLocationChange={onLocationChange}
                />
              )}
              {!lat && (
                <PlacesSearch
                  onPlaceSelect={(plat, plng) => onLocationChange(plat, plng)}
                />
              )}
            </Map>
          </APIProvider>
        </MapErrorBoundary>

        {onShapeChange && (
          <div className="absolute inset-x-3 top-16 z-20 flex justify-center">
            <div
              role="group"
              aria-label="Coverage shape"
              className="grid w-full max-w-md grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur"
            >
              {SHAPE_OPTIONS.map(({ value, label, Icon }) => {
                const isSelected = selectedShape === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onShapeChange(value)}
                    className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold transition-colors ${isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                    title={value === 'rectangle' ? 'Rectangle (2:1)' : label}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Coord display badge */}
        {lat !== null && lng !== null && lat !== undefined && lng !== undefined && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur text-xs text-emerald-800 font-semibold px-3 py-1.5 rounded-lg shadow border border-emerald-100 flex items-center gap-1.5 z-10">
            <MapPin size={14} className="text-emerald-600" />
            {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
          </div>
        )}
      </div>
    </div>
  );
}
