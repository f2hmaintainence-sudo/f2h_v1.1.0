'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Radio, BarChart3, List, RefreshCw, Loader2,
  CheckCircle, XCircle, Clock, AlertTriangle, Building,
  User, Phone, Navigation, ChevronDown, Eye, TrendingUp,
  Filter,
} from 'lucide-react';
import { api } from '@/services/api.client';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Circle,
  Polygon,
} from '@vis.gl/react-google-maps';
import { useClientConfig } from '@/lib/client-config';

// ─── Geometry Helpers for Original Branch Shape ──────────────────────────────
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
  shape: string,
): google.maps.LatLngLiteral[] {
  const normalized = shape.toLowerCase();
  const bearings =
    normalized === 'square'
      ? [45, 135, 225, 315]
      : normalized === 'rectangle'
        ? [
            RECTANGLE_CORNER_BEARING_DEGREES,
            180 - RECTANGLE_CORNER_BEARING_DEGREES,
            180 + RECTANGLE_CORNER_BEARING_DEGREES,
            360 - RECTANGLE_CORNER_BEARING_DEGREES,
          ]
        : [0, 60, 120, 180, 240, 300]; // default hexagon

  return bearings.map((bearing) => destinationPoint(lat, lng, radiusKm, bearing));
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Branch {
  branch_id: string;
  branch_name: string;
  lat: number;
  lng: number;
  delivery_radius_km: number;
  city?: string;
  hex_shape?: 'hexagon' | 'circle' | 'square' | 'rectangle' | string;
}

interface ZoneRequest {
  request_id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  latitude: number;
  longitude: number;
  address_label: string;
  description: string;
  status: 'pending' | 'noted' | 'rejected';
  distance_km: number;
  branch_name: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
}

interface Insights {
  summary: { total: number; pending: number; noted: number; rejected: number };
  topBranches: { branch_id: string; branch_name: string; request_count: number; pending_count: number }[];
  recentTrend: { day: string; count: number }[];
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border border-amber-200/80', icon: <Clock size={11} /> },
    noted: { label: 'Noted', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80', icon: <CheckCircle size={11} /> },
    rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border border-rose-200/80', icon: <XCircle size={11} /> },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ZoneExpansionPage() {
  const { googleMapsApiKey } = useClientConfig();

  const [tab, setTab] = useState<'map' | 'list' | 'insights'>('map');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [requests, setRequests] = useState<ZoneRequest[]>([]);
  const [pins, setPins] = useState<ZoneRequest[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<ZoneRequest | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // ─── Fetch branches ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get<any>('/admin/zone/branches-list?all=true');
        if (res.data?.status) setBranches(res.data.data || []);
      } catch { }
    };
    fetchBranches();
  }, []);

  // ─── Fetch requests list ───────────────────────────────────────────────────
  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get<any>(`/admin/zone-expansion/requests?${params}`);
      if (res.data?.status) {
        setRequests(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      }
    } catch { }
    setLoading(false);
  }, [selectedBranchId, statusFilter]);

  // ─── Fetch map pins ────────────────────────────────────────────────────────
  const fetchPins = useCallback(async () => {
    try {
      const params = selectedBranchId ? `?branchId=${selectedBranchId}` : '';
      const res = await api.get<any>(`/admin/zone-expansion/pins${params}`);
      if (res.data?.status) setPins(res.data.data || []);
    } catch { }
  }, [selectedBranchId]);

  // ─── Fetch insights ────────────────────────────────────────────────────────
  const fetchInsights = useCallback(async () => {
    try {
      const res = await api.get<any>('/admin/zone-expansion/insights');
      if (res.data?.status) setInsights(res.data.data);
    } catch { }
  }, []);

  // ─── Trigger on tab / filter change ───────────────────────────────────────
  useEffect(() => {
    if (tab === 'list') fetchRequests(1);
    if (tab === 'map') fetchPins();
    if (tab === 'insights') fetchInsights();
  }, [tab, selectedBranchId, statusFilter, fetchRequests, fetchPins, fetchInsights]);

  // ─── Update status ─────────────────────────────────────────────────────────
  const updateStatus = async (requestId: string, status: 'pending' | 'noted' | 'rejected') => {
    setUpdatingId(requestId);
    try {
      await api.patch<any>(`/admin/zone-expansion/${requestId}/status`, { status });
      showToast(`Marked as ${status}`);
      fetchRequests(pagination.page);
      fetchPins();
      setSelectedPin(prev => prev?.request_id === requestId ? { ...prev, status } : prev);
    } catch {
      showToast('Failed to update status');
    }
    setUpdatingId(null);
  };

  // ─── Map center (first branch or Bangalore fallback) ──────────────────────
  const mapCenter = (() => {
    if (selectedBranchId) {
      const b = branches.find(x => x.branch_id === selectedBranchId);
      if (b?.lat) return { lat: Number(b.lat), lng: Number(b.lng) };
    }
    if (branches.length > 0 && branches[0].lat) {
      return { lat: Number(branches[0].lat), lng: Number(branches[0].lng) };
    }
    return { lat: 12.9716, lng: 77.5946 };
  })();

  const displayedBranches = selectedBranchId
    ? branches.filter(b => b.branch_id === selectedBranchId)
    : branches;

  // ─── Status color for pin ─────────────────────────────────────────────────
  const pinColor = (status: string) => {
    if (status === 'pending') return '#f59e0b';
    if (status === 'noted') return '#10b981';
    return '#ef4444';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 border border-amber-200/60 rounded-xl">
              <Radio size={22} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Zone Expansion Requests</h1>
              <p className="text-sm text-slate-500">Customers requesting delivery coverage beyond current radius</p>
            </div>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Branch filter */}
            <div className="relative">
              <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl pl-8 pr-8 py-2 appearance-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-xs transition-colors"
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {/* Status filter */}
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl pl-8 pr-8 py-2 appearance-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-xs transition-colors"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="noted">Noted</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1.5 mt-5 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200/80">
          {(['map', 'list', 'insights'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                tab === t
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-medium'
              }`}
            >
              {t === 'map' && <MapPin size={15} />}
              {t === 'list' && <List size={15} />}
              {t === 'insights' && <BarChart3 size={15} />}
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'map' ? 'View' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────── MAP TAB ─────────────────────── */}
      {tab === 'map' && (
        <div className="relative" style={{ height: 'calc(100vh - 180px)' }}>
          {googleMapsApiKey ? (
            <APIProvider apiKey={googleMapsApiKey}>
              <Map
                defaultCenter={mapCenter}
                defaultZoom={12}
                mapId="zone-expansion-map"
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: '100%', height: '100%' }}
              >
                {/* Branch delivery coverage (original shape from branches table: hexagon, circle, square, rectangle) */}
                {displayedBranches.map(branch => {
                  if (!branch.lat || !branch.lng) return null;
                  const shape = (branch.hex_shape || 'hexagon').toLowerCase();
                  const radiusKm = Number(branch.delivery_radius_km || 5);
                  const lat = Number(branch.lat);
                  const lng = Number(branch.lng);

                  return (
                    <React.Fragment key={`branch-${branch.branch_id}`}>
                      {shape === 'circle' ? (
                        <Circle
                          center={{ lat, lng }}
                          radius={radiusKm * 1000}
                          strokeColor="#16a34a"
                          strokeOpacity={0.85}
                          strokeWeight={2.5}
                          fillColor="#22c55e"
                          fillOpacity={0.12}
                        />
                      ) : (
                        <Polygon
                          paths={buildShapePath(lat, lng, radiusKm, shape)}
                          strokeColor="#16a34a"
                          strokeOpacity={0.85}
                          strokeWeight={2.5}
                          fillColor="#22c55e"
                          fillOpacity={0.12}
                        />
                      )}
                      <AdvancedMarker
                        position={{ lat, lng }}
                        title={`${branch.branch_name} (${shape})`}
                      >
                        <div className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md border border-emerald-400 whitespace-nowrap">
                          🏪 {branch.branch_name}
                        </div>
                      </AdvancedMarker>
                    </React.Fragment>
                  );
                })}

                {/* Zone expansion request pins */}
                {pins.map(pin => (
                  <AdvancedMarker
                    key={pin.request_id}
                    position={{ lat: Number(pin.latitude), lng: Number(pin.longitude) }}
                    title={pin.address_label || 'Zone Request'}
                    onClick={() => setSelectedPin(pin)}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: pinColor(pin.status) }}
                    >
                      <MapPin size={14} className="text-white" />
                    </div>
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
          ) : (
            <div className="flex items-center justify-center h-full bg-slate-100">
              <p className="text-slate-500 font-medium">Google Maps API key not configured</p>
            </div>
          )}

          {/* ── Map Legend ── */}
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5 shadow-lg text-slate-800">
            <p className="text-slate-900 font-bold text-sm mb-2">Legend</p>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-md border-2 border-emerald-600 bg-emerald-500/20" />
              <span className="text-slate-700 font-medium">Branch Delivery Zone (Original Shape)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-amber-500 shadow-xs" />
              <span className="text-slate-700 font-medium">Pending Request</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-xs" />
              <span className="text-slate-700 font-medium">Noted for Expansion</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-rose-500 shadow-xs" />
              <span className="text-slate-700 font-medium">Rejected</span>
            </div>
            <hr className="border-slate-200 mt-1" />
            <p className="text-slate-500 font-medium">{pins.length} request pins shown</p>
          </div>

          {/* ── Pin Detail Panel ── */}
          {selectedPin && (
            <div className="absolute bottom-4 left-4 w-84 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-2xl text-slate-900">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {[selectedPin.first_name, selectedPin.last_name].filter(Boolean).join(' ') || 'Unknown Customer'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    {selectedPin.branch_name} · {Number(selectedPin.distance_km).toFixed(1)} km from center
                  </p>
                </div>
                <button onClick={() => setSelectedPin(null)} className="text-slate-400 hover:text-slate-700 transition-colors p-1">✕</button>
              </div>

              <StatusBadge status={selectedPin.status} />

              {selectedPin.address_label && (
                <p className="text-xs text-slate-700 mt-3 bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 leading-relaxed font-medium">
                  <MapPin size={12} className="inline mr-1 text-amber-500" />
                  {selectedPin.address_label}
                </p>
              )}
              {selectedPin.description && (
                <p className="text-xs text-slate-500 mt-2 italic font-normal">"{selectedPin.description}"</p>
              )}
              {selectedPin.phone && (
                <p className="text-xs text-slate-600 mt-2 font-medium">
                  <Phone size={11} className="inline mr-1 text-slate-400" />{selectedPin.phone}
                </p>
              )}

              <div className="flex gap-2 mt-4">
                {selectedPin.status !== 'noted' && (
                  <button
                    onClick={() => updateStatus(selectedPin.request_id, 'noted')}
                    disabled={updatingId === selectedPin.request_id}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors shadow-xs"
                  >
                    <CheckCircle size={12} className="inline mr-1" />Mark Noted
                  </button>
                )}
                {selectedPin.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(selectedPin.request_id, 'rejected')}
                    disabled={updatingId === selectedPin.request_id}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors shadow-xs"
                  >
                    <XCircle size={12} className="inline mr-1" />Reject
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────── LIST TAB ─────────────────────── */}
      {tab === 'list' && (
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-semibold text-slate-600">{pagination.total} requests found</p>
            <button
              onClick={() => fetchRequests(pagination.page)}
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl transition-colors shadow-xs font-medium"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-amber-500' : 'text-slate-500'} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={28} className="animate-spin text-amber-500" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Radio size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="font-semibold text-slate-600">No zone expansion requests found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      {['Customer', 'Contact', 'Branch', 'Distance', 'Location', 'Description', 'Status', 'Date', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map(r => (
                      <tr key={r.request_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center">
                              <User size={14} className="text-amber-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-xs">
                                {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                              </p>
                              <p className="text-slate-400 text-xs font-mono">{r.customer_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 text-xs whitespace-nowrap font-medium">
                          {r.phone ? <span><Phone size={11} className="inline mr-1 text-slate-400" />{r.phone}</span> : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-800 text-xs whitespace-nowrap font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Building size={12} className="text-slate-400" />
                            {r.branch_name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200/70 text-xs font-bold px-2.5 py-0.5 rounded-full font-mono">
                            {r.distance_km ? `${Number(r.distance_km).toFixed(1)} km` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 text-xs max-w-[200px] truncate font-medium">
                          {r.address_label || `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[150px] truncate italic">
                          {r.description || '—'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap font-medium">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex gap-1.5">
                            {r.status !== 'noted' && (
                              <button
                                onClick={() => updateStatus(r.request_id, 'noted')}
                                disabled={updatingId === r.request_id}
                                title="Mark as Noted"
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 disabled:opacity-50 text-emerald-700 rounded-lg transition-colors"
                              >
                                <CheckCircle size={13} />
                              </button>
                            )}
                            {r.status !== 'pending' && (
                              <button
                                onClick={() => updateStatus(r.request_id, 'pending')}
                                disabled={updatingId === r.request_id}
                                title="Reset to Pending"
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 disabled:opacity-50 text-amber-700 rounded-lg transition-colors"
                              >
                                <Clock size={13} />
                              </button>
                            )}
                            {r.status !== 'rejected' && (
                              <button
                                onClick={() => updateStatus(r.request_id, 'rejected')}
                                disabled={updatingId === r.request_id}
                                title="Reject"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 disabled:opacity-50 text-rose-700 rounded-lg transition-colors"
                              >
                                <XCircle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                  <p className="text-slate-500 font-medium">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchRequests(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl transition-colors shadow-xs font-medium text-slate-700"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => fetchRequests(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl transition-colors shadow-xs font-medium text-slate-700"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────────────── INSIGHTS TAB ─────────────────────── */}
      {tab === 'insights' && (
        <div className="p-6 space-y-6">
          {!insights ? (
            <div className="flex justify-center py-20">
              <Loader2 size={28} className="animate-spin text-amber-500" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Requests', value: insights.summary.total, bg: 'from-blue-50 to-blue-100/60', border: 'border-blue-200/80', text: 'text-blue-900', labelText: 'text-blue-700', icon: Radio },
                  { label: 'Pending', value: insights.summary.pending, bg: 'from-amber-50 to-amber-100/60', border: 'border-amber-200/80', text: 'text-amber-900', labelText: 'text-amber-700', icon: Clock },
                  { label: 'Noted for Expansion', value: insights.summary.noted, bg: 'from-emerald-50 to-emerald-100/60', border: 'border-emerald-200/80', text: 'text-emerald-900', labelText: 'text-emerald-700', icon: CheckCircle },
                  { label: 'Rejected', value: insights.summary.rejected, bg: 'from-rose-50 to-rose-100/60', border: 'border-rose-200/80', text: 'text-rose-900', labelText: 'text-rose-700', icon: XCircle },
                ].map(card => (
                  <div key={card.label} className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-5 shadow-xs`}>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className={`${card.labelText} text-xs font-bold uppercase tracking-wider`}>{card.label}</p>
                      <card.icon size={18} className={card.labelText} />
                    </div>
                    <p className={`text-3xl font-extrabold ${card.text}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Top Branches Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-amber-500" />
                  <h2 className="text-slate-900 font-bold text-base">Top Branches by Request Volume</h2>
                </div>
                {insights.topBranches.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6 font-medium">No data yet</p>
                ) : (
                  <div className="space-y-4">
                    {insights.topBranches.map((b, i) => {
                      const pct = insights.topBranches[0].request_count
                        ? Math.round((b.request_count / insights.topBranches[0].request_count) * 100)
                        : 0;
                      return (
                        <div key={b.branch_id || i}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-slate-800 font-semibold">
                              {i + 1}. {b.branch_name || 'Unknown Branch'}
                            </span>
                            <div className="flex gap-3 text-xs text-slate-500 font-medium">
                              <span>{b.request_count} total</span>
                              <span className="text-amber-700 font-bold">{b.pending_count} pending</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 30-Day Trend */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={18} className="text-amber-500" />
                  <h2 className="text-slate-900 font-bold text-base">Last 30 Days — Daily Requests</h2>
                </div>
                {insights.recentTrend.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6 font-medium">No requests in the last 30 days</p>
                ) : (
                  <div className="flex items-end gap-1.5 h-32 pt-4">
                    {(() => {
                      const maxVal = Math.max(...insights.recentTrend.map(d => d.count), 1);
                      return insights.recentTrend.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                          <div
                            className="w-full bg-amber-500 rounded-t hover:bg-amber-600 transition-colors cursor-pointer"
                            style={{ height: `${Math.max(6, (d.count / maxVal) * 100)}%` }}
                            title={`${d.day}: ${d.count} requests`}
                          />
                          {/* tooltip on hover */}
                          <div className="hidden group-hover:flex absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-md z-10 font-medium">
                            {new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: {d.count}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
