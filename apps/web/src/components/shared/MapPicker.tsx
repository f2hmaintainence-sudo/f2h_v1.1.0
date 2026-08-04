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

// ── Places search bar ───────────────────────────────────────────────────────
function PlacesSearch({ onPlaceSelect }: { onPlaceSelect: (lat: number, lng: number, address: string) => void }) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    autocompleteRef.current = new placesLib.Autocomplete(inputRef.current, {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'formatted_address'],
    });
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      onPlaceSelect(lat, lng, place.formatted_address || '');
      map?.panTo({ lat, lng });
      map?.setZoom(14);
    });
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [placesLib, map, onPlaceSelect]);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[320px] sm:w-[400px]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search location or address..."
          className="w-full pl-9 pr-4 py-2.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
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
  const [searchAddress, setSearchAddress] = useState('');

  const handlePlaceSelect = useCallback((plat: number, plng: number) => {
    onLocationChange(plat, plng);
  }, [onLocationChange]);

  return (
    <>
      <PlacesSearch onPlaceSelect={handlePlaceSelect} />
      <ClickHandler onClick={onLocationChange} />

      {/* Selected location marker (draggable) */}
      <AdvancedMarker
        position={{ lat, lng }}
        draggable
        onDragEnd={(e) => {
          if (e.latLng) onLocationChange(e.latLng.lat(), e.latLng.lng());
        }}
        title="Branch center — drag to reposition"
      >
        <Pin background="#3b82f6" borderColor="#1d4ed8" glyphColor="#fff" scale={1.2} />
      </AdvancedMarker>

      {/* Delivery radius circle */}
      <Circle
        center={{ lat, lng }}
        radius={radiusKm * 1000}
        strokeColor="#3b82f6"
        strokeWeight={2}
        strokeOpacity={0.9}
        fillColor="#3b82f6"
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
              <Pin background="#10b981" borderColor="#059669" glyphColor="#fff" scale={0.9} />
            </AdvancedMarker>
            {b.delivery_radius_km && (
              <Circle
                center={{ lat: b.lat, lng: b.lng }}
                radius={b.delivery_radius_km * 1000}
                strokeColor="#10b981"
                strokeWeight={1.5}
                strokeOpacity={0.5}
                fillColor="#10b981"
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-sm text-slate-600 font-medium">
            <MapPin size={16} className="text-blue-500" />
            Search an address or click the map to set branch location
          </div>
        </div>
      )}

      {/* Coord display */}
      {lat && lng && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur text-xs text-slate-500 px-3 py-1.5 rounded-lg shadow">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
