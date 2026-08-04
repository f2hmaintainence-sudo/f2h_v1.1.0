'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { locationTrackingService, DeliveryPartnerLocation } from '@/services/locationTrackingService';
import { Activity, RefreshCw, MapPin } from 'lucide-react';

import MapErrorBoundary from '@/components/shared/MapErrorBoundary';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bangalore

export default function TrackingPage() {
  const [locations, setLocations] = useState<DeliveryPartnerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<DeliveryPartnerLocation | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await locationTrackingService.getAllDeliveryPartnerLocations();
      setLocations(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 7000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const center =
    locations.length > 0
      ? {
          lat: locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
          lng: locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
        }
      : DEFAULT_CENTER;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Live GPS Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time map tracking of active delivery partners</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity size={14} className="text-emerald-500" />
            <span className="font-semibold text-gray-900">{locations.length}</span> active partners
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <RefreshCw size={12} />
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          Loading delivery partner locations...
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: '600px' }}>
          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <MapPin size={40} className="text-gray-300" />
              <p className="font-semibold text-sm">No active delivery partners currently tracking</p>
              <p className="text-xs">Partners show up here when they ping their GPS location</p>
            </div>
          ) : (
            <MapErrorBoundary fallbackMessage="Google Maps API key error. Live partner list is active below.">
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={center}
                  defaultZoom={12}
                  mapId="f2h-tracking-map"
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  mapTypeControl={false}
                  streetViewControl={false}
                  fullscreenControl={false}
                  style={{ width: '100%', height: '100%' }}
                >
                  {locations.map((loc) => (
                    <AdvancedMarker
                      key={loc.user_id}
                      position={{ lat: loc.latitude, lng: loc.longitude }}
                      onClick={() => setSelectedPartner(selectedPartner?.user_id === loc.user_id ? null : loc)}
                      title={loc.user_id}
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-white font-bold text-xs shadow-lg cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          width: 36,
                          height: 36,
                          background: '#f97316',
                          border: '3px solid white',
                          boxShadow: '0 4px 12px rgba(249,115,22,0.4)',
                        }}
                      >
                        🏍
                      </div>
                    </AdvancedMarker>
                  ))}

                  {selectedPartner && (
                    <InfoWindow
                      position={{ lat: selectedPartner.latitude, lng: selectedPartner.longitude }}
                      onCloseClick={() => setSelectedPartner(null)}
                    >
                        {selectedPartner.timestamp && (
                          <p className="text-slate-400 text-[10px] mt-0.5">
                            Updated: {new Date(selectedPartner.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </Map>
              </APIProvider>
            </MapErrorBoundary>
          )}
        </div>
      )}

      {/* Partner list */}
      {!loading && locations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map((loc) => (
            <div
              key={loc.user_id}
              onClick={() => setSelectedPartner(loc)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:border-orange-200 hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold shrink-0">
                🏍
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{loc.user_id}</p>
                <p className="text-[10px] text-slate-300 font-mono">
                  {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
