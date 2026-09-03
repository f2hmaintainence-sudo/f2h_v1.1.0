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
} from '@vis.gl/react-google-maps';
import { useClientConfig } from '@/lib/client-config';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Branch {
  branch_id: string;
  branch_name: string;
  lat: number;
  lng: number;
  delivery_radius_km: number;
  city?: string;
}

interface ZoneRequest {
  request_id: string;
  customer_id: string;
  customer_name: string;
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
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 border border-amber-200', icon: <Clock size={11} /> },
    noted: { label: 'Noted', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: <CheckCircle size={11} /> },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-800 border border-red-200', icon: <XCircle size={11} /> },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}>
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <Radio size={22} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Zone Expansion Requests</h1>
              <p className="text-sm text-gray-400">Customers requesting delivery coverage beyond current radius</p>
            </div>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Branch filter */}
            <div className="relative">
              <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-8 py-2 appearance-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {/* Status filter */}
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-8 py-2 appearance-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="noted">Noted</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mt-5">
          {(['map', 'list', 'insights'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-amber-500 text-gray-900'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {t === 'map' && <MapPin size={15} />}
              {t === 'list' && <List size={15} />}
              {t === 'insights' && <BarChart3 size={15} />}
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'map' ? 'View' : t === 'list' ? '' : ''}
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
                {/* Branch delivery radius circles */}
                {displayedBranches.map(branch => (
                  branch.lat && branch.lng ? (
                    <React.Fragment key={`branch-${branch.branch_id}`}>
                      <Circle
                        center={{ lat: Number(branch.lat), lng: Number(branch.lng) }}
                        radius={Number(branch.delivery_radius_km) * 1000}
                        strokeColor="#22c55e"
                        strokeOpacity={0.8}
                        strokeWeight={2}
                        fillColor="#22c55e"
                        fillOpacity={0.08}
                      />
                      <AdvancedMarker
                        position={{ lat: Number(branch.lat), lng: Number(branch.lng) }}
                        title={branch.branch_name}
                      >
                        <div className="bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg border border-emerald-400 whitespace-nowrap">
                          🏪 {branch.branch_name}
                        </div>
                      </AdvancedMarker>
                    </React.Fragment>
                  ) : null
                ))}

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
            <div className="flex items-center justify-center h-full bg-gray-900">
              <p className="text-gray-400">Google Maps API key not configured</p>
            </div>
          )}

          {/* ── Map Legend ── */}
          <div className="absolute top-4 right-4 bg-gray-900/95 border border-gray-700 rounded-xl p-4 text-xs space-y-2 shadow-xl">
            <p className="text-gray-300 font-semibold text-sm mb-3">Legend</p>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-emerald-400 bg-emerald-600/20" />
              <span className="text-gray-300">Branch Delivery Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500" />
              <span className="text-gray-300">Pending Request</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500" />
              <span className="text-gray-300">Noted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-gray-300">Rejected</span>
            </div>
            <hr className="border-gray-700 mt-1" />
            <p className="text-gray-400">{pins.length} request pins shown</p>
          </div>

          {/* ── Pin Detail Panel ── */}
          {selectedPin && (
            <div className="absolute bottom-4 left-4 w-80 bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">
                    {selectedPin.customer_name || [selectedPin.first_name, selectedPin.last_name].filter(Boolean).join(' ') || 'Unknown'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedPin.branch_name} · {Number(selectedPin.distance_km).toFixed(1)} km from center
                  </p>
                </div>
                <button onClick={() => setSelectedPin(null)} className="text-gray-500 hover:text-white transition-colors">✕</button>
              </div>

              <StatusBadge status={selectedPin.status} />

              {selectedPin.address_label && (
                <p className="text-sm text-gray-300 mt-3 bg-gray-800 rounded-lg p-2">
                  <MapPin size={12} className="inline mr-1 text-amber-400" />
                  {selectedPin.address_label}
                </p>
              )}
              {selectedPin.description && (
                <p className="text-xs text-gray-400 mt-2 italic">"{selectedPin.description}"</p>
              )}
              {selectedPin.phone && (
                <p className="text-xs text-gray-400 mt-2">
                  <Phone size={11} className="inline mr-1" />{selectedPin.phone}
                </p>
              )}

              <div className="flex gap-2 mt-4">
                {selectedPin.status !== 'noted' && (
                  <button
                    onClick={() => updateStatus(selectedPin.request_id, 'noted')}
                    disabled={updatingId === selectedPin.request_id}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle size={12} className="inline mr-1" />Mark Noted
                  </button>
                )}
                {selectedPin.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(selectedPin.request_id, 'rejected')}
                    disabled={updatingId === selectedPin.request_id}
                    className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
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
            <p className="text-sm text-gray-400">{pagination.total} requests found</p>
            <button
              onClick={() => fetchRequests(pagination.page)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={28} className="animate-spin text-amber-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Radio size={40} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium">No zone expansion requests found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-800">
                      {['Customer', 'Contact', 'Branch', 'Distance', 'Location', 'Description', 'Status', 'Date', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {requests.map(r => (
                      <tr key={r.request_id} className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <User size={13} className="text-amber-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white text-xs">
                                {r.customer_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                              </p>
                              <p className="text-gray-500 text-xs">{r.customer_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                          {r.phone ? <span><Phone size={10} className="inline mr-1 text-gray-500" />{r.phone}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Building size={11} className="text-gray-500" />
                            {r.branch_name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="bg-blue-900/40 text-blue-300 text-xs px-2 py-0.5 rounded-full font-mono">
                            {r.distance_km ? `${Number(r.distance_km).toFixed(1)} km` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs max-w-[180px] truncate">
                          {r.address_label || `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-[150px] truncate italic">
                          {r.description || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1.5">
                            {r.status !== 'noted' && (
                              <button
                                onClick={() => updateStatus(r.request_id, 'noted')}
                                disabled={updatingId === r.request_id}
                                title="Mark as Noted"
                                className="p-1.5 bg-emerald-900/50 hover:bg-emerald-700 disabled:opacity-50 text-emerald-400 rounded-lg transition-colors"
                              >
                                <CheckCircle size={13} />
                              </button>
                            )}
                            {r.status !== 'pending' && (
                              <button
                                onClick={() => updateStatus(r.request_id, 'pending')}
                                disabled={updatingId === r.request_id}
                                title="Reset to Pending"
                                className="p-1.5 bg-amber-900/50 hover:bg-amber-700 disabled:opacity-50 text-amber-400 rounded-lg transition-colors"
                              >
                                <Clock size={13} />
                              </button>
                            )}
                            {r.status !== 'rejected' && (
                              <button
                                onClick={() => updateStatus(r.request_id, 'rejected')}
                                disabled={updatingId === r.request_id}
                                title="Reject"
                                className="p-1.5 bg-red-900/50 hover:bg-red-700 disabled:opacity-50 text-red-400 rounded-lg transition-colors"
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
                  <p className="text-gray-400">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchRequests(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => fetchRequests(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg transition-colors"
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
              <Loader2 size={28} className="animate-spin text-amber-400" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Requests', value: insights.summary.total, color: 'from-blue-600 to-blue-700', icon: Radio },
                  { label: 'Pending', value: insights.summary.pending, color: 'from-amber-600 to-amber-700', icon: Clock },
                  { label: 'Noted', value: insights.summary.noted, color: 'from-emerald-600 to-emerald-700', icon: CheckCircle },
                  { label: 'Rejected', value: insights.summary.rejected, color: 'from-red-600 to-red-700', icon: XCircle },
                ].map(card => (
                  <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 shadow-lg`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white/80 text-sm font-medium">{card.label}</p>
                      <card.icon size={18} className="text-white/60" />
                    </div>
                    <p className="text-4xl font-bold text-white">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Top Branches Table */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={17} className="text-amber-400" />
                  <h2 className="text-white font-semibold">Top Branches by Request Volume</h2>
                </div>
                {insights.topBranches.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {insights.topBranches.map((b, i) => {
                      const pct = insights.topBranches[0].request_count
                        ? Math.round((b.request_count / insights.topBranches[0].request_count) * 100)
                        : 0;
                      return (
                        <div key={b.branch_id || i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 font-medium">
                              {i + 1}. {b.branch_name || 'Unknown Branch'}
                            </span>
                            <div className="flex gap-3 text-xs text-gray-400">
                              <span>{b.request_count} total</span>
                              <span className="text-amber-400">{b.pending_count} pending</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div
                              className="bg-amber-500 h-2 rounded-full transition-all duration-500"
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
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={17} className="text-amber-400" />
                  <h2 className="text-white font-semibold">Last 30 Days — Daily Requests</h2>
                </div>
                {insights.recentTrend.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No requests in the last 30 days</p>
                ) : (
                  <div className="flex items-end gap-1 h-28">
                    {(() => {
                      const maxVal = Math.max(...insights.recentTrend.map(d => d.count), 1);
                      return insights.recentTrend.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            className="w-full bg-amber-500 rounded-t hover:bg-amber-400 transition-colors cursor-pointer"
                            style={{ height: `${Math.max(4, (d.count / maxVal) * 100)}%` }}
                            title={`${d.day}: ${d.count} requests`}
                          />
                          {/* tooltip on hover */}
                          <div className="hidden group-hover:flex absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg z-10">
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
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
