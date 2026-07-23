'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { locationTrackingService, DeliveryPartnerLocation } from '@/services/locationTrackingService';

// Fix for default marker icons in react-leaflet
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function TrackingPage() {
  const [locations, setLocations] = useState<DeliveryPartnerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchLocations = async () => {
    try {
      const data = await locationTrackingService.getAllDeliveryPartnerLocations();
      setLocations(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();

    // Poll every 7 seconds for real-time updates
    const interval = setInterval(fetchLocations, 7000);

    return () => clearInterval(interval);
  }, []);

  // Calculate center point for map
  const getMapCenter = () => {
    if (locations.length === 0) return [12.9716, 77.5946]; // Default to Bangalore
    const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
    return [avgLat, avgLng];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Live GPS Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time map tracking of active delivery boys</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{locations.length}</span> active delivery partners
          </div>
          {lastUpdate && (
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          Loading delivery partner locations...
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          No active delivery partners currently tracking
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-[600px] w-full">
            <MapContainer
              center={getMapCenter() as [number, number]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {locations.map((location) => (
                <Marker
                  key={location.user_id}
                  position={[location.latitude, location.longitude]}
                  icon={markerIcon}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-semibold text-sm">Delivery Partner</p>
                      <p className="text-xs text-gray-600">ID: {location.user_id}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Lat: {location.latitude.toFixed(6)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Lng: {location.longitude.toFixed(6)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Updated: {new Date(location.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
