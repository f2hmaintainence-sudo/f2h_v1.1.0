'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  Circle,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Search, Loader2, MapPin } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export type ShapeType = 'hexagon' | 'circle' | 'square';

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

interface SearchSuggestion {
  display_name: string;
  lat: number;
  lng: number;
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
    try {
      autocompleteRef.current = new placesLib.Autocomplete(inputRef.current, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'in' },
        fields: ['geometry', 'formatted_address'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          onPlaceSelect(lat, lng, place.formatted_address || '');
          map?.panTo({ lat, lng });
          map?.setZoom(14);
          setShowDropdown(false);
        }
      });
    } catch { }

    return () => {
      if (autocompleteRef.current) {
        try {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
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
    map?.panTo({ lat: s.lat, lng: s.lng });
    map?.setZoom(14);
    setInputValue(s.display_name);
    setShowDropdown(false);
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[320px] sm:w-[420px]">
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
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onClick]);
  return null;
}

// ── Inner map contents ──────────────────────────────────────────────────────
function MapContents({
  lat, lng, radiusKm, bufferZoneKm, existingBranches, onLocationChange,
}: {
  lat: number; lng: number; radiusKm: number; bufferZoneKm: number;
  existingBranches: ExistingBranch[]; onLocationChange: (lat: number, lng: number) => void;
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
        position={{ lat, lng }}
        draggable
        onDragEnd={(e) => {
          if (e.latLng) onLocationChange(e.latLng.lat(), e.latLng.lng());
        }}
        title="Branch center — drag to reposition"
      >
        <Pin background="#16a34a" borderColor="#15803d" glyphColor="#fff" scale={1.2} />
      </AdvancedMarker>

      {/* Delivery radius circle (Green Theme) */}
      <Circle
        center={{ lat, lng }}
        radius={radiusKm * 1000}
        strokeColor="#16a34a"
        strokeWeight={2}
        strokeOpacity={0.9}
        fillColor="#16a34a"
        fillOpacity={0.08}
      />

      {/* Buffer zone ring */}
      {bufferZoneKm > 0 && (
        <Circle
          center={{ lat, lng }}
          radius={(radiusKm + bufferZoneKm) * 1000}
          strokeColor="#a855f7"
          strokeWeight={1.5}
          strokeOpacity={0.7}
          fillColor="#a855f7"
          fillOpacity={0.04}
        />
      )}

      {/* Existing branches */}
      {existingBranches.map((b) =>
        b.lat && b.lng ? (
          <React.Fragment key={b.branch_id || b.branch_name}>
            <AdvancedMarker
              position={{ lat: b.lat, lng: b.lng }}
              title={b.branch_name}
            >
              <Pin background="#059669" borderColor="#047857" glyphColor="#fff" scale={0.9} />
            </AdvancedMarker>
            {b.delivery_radius_km && (
              <Circle
                center={{ lat: b.lat, lng: b.lng }}
                radius={b.delivery_radius_km * 1000}
                strokeColor="#059669"
                strokeWeight={1.5}
                strokeOpacity={0.5}
                fillColor="#059669"
                fillOpacity={0.05}
              />
            )}
          </React.Fragment>
        ) : null
      )}
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
  selectedShape,
  onShapeChange,
}: MapPickerProps) {
  const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bangalore
  const center = lat && lng ? { lat, lng } : defaultCenter;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-200 shadow">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
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

      {/* Overlay hint */}
      {!lat && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-white/90 backdrop-blur px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-sm text-slate-600 font-medium">
            <MapPin size={16} className="text-emerald-600" />
            Search an address or click the map to set branch location
          </div>
        </div>
      )}

      {/* Coord display */}
      {lat && lng && (
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur text-xs text-emerald-800 font-semibold px-3 py-1.5 rounded-lg shadow border border-emerald-100 flex items-center gap-1.5 z-10">
          <MapPin size={14} className="text-emerald-600" />
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
