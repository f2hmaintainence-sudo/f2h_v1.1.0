'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Users, ChevronDown, Loader2, AlertTriangle,
  UserCheck, UserX, RefreshCw, Hash, Check, X, Plus,
  Route as RouteIcon, Zap, ClipboardList
} from 'lucide-react';
import RouteCard from '@/components/branch/RouteCard';
import { api } from '@/services/api.client';

const SectorMap = dynamic(() => import('@/components/branch/SectorMap'), { ssr: false });
const RunSheetModal = dynamic(() => import('@/components/branch/RunSheetModal'), { ssr: false });

const SECTOR_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

export default function ZonesPage() {
  // Branch
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<any>(null);

  // Sectors
  const [sectors, setSectors] = useState<any[]>([]);
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Routes
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Unrouted customers
  const [unrouted, setUnrouted] = useState<any[]>([]);
  const [loadingUnrouted, setLoadingUnrouted] = useState(false);

  // Delivery boys
  const [deliveryPartners, setDeliveryPartners] = useState<any[]>([]);

  // Create route form
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteShift, setNewRouteShift] = useState<'morning' | 'evening'>('morning');
  const [creating, setCreating] = useState(false);

  // Run sheet modal
  const [runSheetRouteId, setRunSheetRouteId] = useState<string | null>(null);

  // Change sector count
  const [showChangeSectors, setShowChangeSectors] = useState(false);
  const [newSectorCount, setNewSectorCount] = useState(3);
  const [changingCount, setChangingCount] = useState(false);

  // Assigning
  const [assigning, setAssigning] = useState(false);
  const [assigningCustomer, setAssigningCustomer] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // ─── Fetch branches ──────────────────────────────────────────
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get<any>('/admin/zone/branches-list');
        if (res.data?.status) setBranches(res.data.data || []);
      } catch { }
    };
    fetchBranches();
  }, []);

  // ─── Load branch data ────────────────────────────────────────
  const loadBranch = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setSelectedBranchId(branchId);
    const branch = branches.find(b => b.branch_id === branchId);
    setSelectedBranch(branch);
    setSelectedSector(null);
    setRoutes([]);
    setUnrouted([]);
    setSelectedRouteId(null);
    setLoading(true);

    try {
      const [sectorRes, boysRes] = await Promise.all([
        api.get<any>(`/admin/zone/sectors/${branchId}`),
        api.get<any>(`/admin/zone/delivery-boys/${branchId}`),
      ]);
      if (sectorRes.data?.status) setSectors(sectorRes.data.data || []);
      if (boysRes.data?.status) setDeliveryPartners(boysRes.data.data || []);
    } catch { }
    setLoading(false);
  }, [branches]);

  // ─── Load routes for a sector ─────────────────────────────────
  const loadSectorRoutes = useCallback(async (sectorIndex: number) => {
    if (!selectedBranchId) return;
    setSelectedSector(sectorIndex);
    setSelectedRouteId(null);
    setLoadingRoutes(true);
    setLoadingUnrouted(true);

    try {
      const [routeRes, unroutedRes] = await Promise.all([
        api.get<any>(`/admin/zone/routes/${selectedBranchId}/${sectorIndex}`),
        api.get<any>(`/admin/zone/unrouted/${selectedBranchId}/${sectorIndex}`),
      ]);
      if (routeRes.data?.status) setRoutes(routeRes.data.data || []);
      if (unroutedRes.data?.status) setUnrouted(unroutedRes.data.data || []);
    } catch { }
    setLoadingRoutes(false);
    setLoadingUnrouted(false);
  }, [selectedBranchId]);

  // ─── Create route ─────────────────────────────────────────────
  const handleCreateRoute = async () => {
    if (!newRouteName.trim() || selectedSector === null) return;
    setCreating(true);
    try {
      const res = await api.post<any>('/admin/zone/routes', {
        branch_id: selectedBranchId,
        sector_index: selectedSector,
        route_name: newRouteName.trim(),
        shift_type: newRouteShift,
      });
      if (res.data?.status) {
        showToast(res.data.message);
        setNewRouteName('');
        setShowCreateRoute(false);
        loadSectorRoutes(selectedSector);
      }
    } catch { }
    setCreating(false);
  };

  // ─── Assign boy to route ──────────────────────────────────────
  const handleAssignBoy = async (routeId: string, boyId: string) => {
    setAssigning(true);
    try {
      const res = await api.patch<any>(`/admin/zone/routes/${routeId}/assign-boy`, {
        delivery_partner_id: boyId,
      });
      if (res.data?.status) {
        showToast(res.data.message);
        if (selectedSector !== null) loadSectorRoutes(selectedSector);
      }
    } catch { }
    setAssigning(false);
  };

  // ─── Delete route ─────────────────────────────────────────────
  const handleDeleteRoute = async (routeId: string) => {
    try {
      const res = await api.delete<any>(`/admin/zone/routes/${routeId}`);
      if (res.data?.status) {
        showToast(res.data.message);
        if (selectedSector !== null) loadSectorRoutes(selectedSector);
      }
    } catch { }
  };

  // ─── Assign customer to route ─────────────────────────────────
  const handleAssignCustomer = async (customerId: string, routeId: string) => {
    setAssigningCustomer(customerId);
    try {
      const res = await api.post<any>(`/admin/zone/routes/${routeId}/add-customer`, {
        customer_id: customerId,
      });
      if (res.data?.status) {
        showToast(res.data.message);
        if (selectedSector !== null) loadSectorRoutes(selectedSector);
      }
    } catch { }
    setAssigningCustomer(null);
  };

  // ─── Auto-group ───────────────────────────────────────────────
  const handleAutoGroup = async () => {
    if (selectedSector === null) return;
    try {
      const res = await api.post<any>(`/admin/zone/routes/${selectedBranchId}/${selectedSector}/auto-group`);
      if (res.data?.status) {
        showToast(res.data.message);
        loadSectorRoutes(selectedSector);
      }
    } catch { }
  };

  // ─── Change sector count ──────────────────────────────────────
  const handleChangeSectorCount = async () => {
    if (!selectedBranchId) return;
    setChangingCount(true);
    try {
      const res = await api.post<any>(`/admin/zone/sectors/${selectedBranchId}/change-count`, {
        sector_count: newSectorCount,
      });
      if (res.data?.status) {
        showToast(res.data.message);
        setShowChangeSectors(false);
        loadBranch(selectedBranchId);
      }
    } catch { }
    setChangingCount(false);
  };

  const unassignedSectors = sectors.filter(s => s.is_unassigned);
  const sectorRouteCount = routes.length;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
          <Check size={18} /> {toast}
        </div>
      )}

      {/* Top: Branch Selector */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900 mr-4">Zone & Route Management</h1>
        <div className="relative">
          <select value={selectedBranchId} onChange={e => loadBranch(e.target.value)}
            className="pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm font-medium bg-white appearance-none cursor-pointer min-w-[250px] focus:ring-2 focus:ring-fresh-green/30 focus:border-fresh-green outline-none">
            <option value="">create a branch...</option>
            {branches.map(b => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}{b.city ? ` — ${b.city}` : ''}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {selectedBranch && (
          <div className="flex gap-2 text-xs text-gray-500 ml-2">
            <span className="px-2.5 py-1 bg-gray-50 rounded-md">📍 {selectedBranch.delivery_radius_km || '?'} km</span>
            <span className="px-2.5 py-1 bg-gray-50 rounded-md">🔷 {sectors.length} sectors</span>
          </div>
        )}
      </div>

      {/* Unassigned warning */}
      {unassignedSectors.length > 0 && (
        <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={18} />
          <span><strong>{unassignedSectors.length} sector(s)</strong> have no delivery boy assigned.</span>
        </div>
      )}

      {!selectedBranchId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><MapPin size={56} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400">Select a branch to manage sectors & routes</p></div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-fresh-green" /></div>
      ) : (
        <div className="flex-1 flex gap-0 overflow-hidden">

          {/* ═══ PANEL 1: Sector List (25%) ═══ */}
          <div className="w-[25%] border-r border-gray-100 flex flex-col bg-white overflow-y-auto">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-bold text-gray-700">Sectors</h2>
            </div>
            <div className="flex-1 px-3 pb-3 space-y-2">
              {sectors.map((s: any) => {
                const color = SECTOR_COLORS[s.sector_index % SECTOR_COLORS.length];
                const isSelected = selectedSector === s.sector_index;
                return (
                  <div key={s.sector_index}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-gray-800 bg-gray-50 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => loadSectorRoutes(s.sector_index)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="font-semibold text-sm text-gray-800">Sector {s.sector_index}</span>
                      </div>
                      <span className="text-xs text-gray-400">{s.customer_count} cust.</span>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-500">
                      {s.delivery_partner_name ? (
                        <span className="flex items-center gap-1"><UserCheck size={12} className="text-green-500" /> {s.delivery_partner_name}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={12} /> Unassigned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-3 pb-3 border-t border-gray-50 pt-3">
              <button onClick={() => { setShowChangeSectors(true); setNewSectorCount(sectors.length || 3); }}
                className="w-full py-2 text-xs font-semibold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5">
                <Hash size={14} /> Change sector count
              </button>
            </div>
          </div>

          {/* ═══ PANEL 2: Routes for Selected Sector (40%) ═══ */}
          <div className="w-[40%] border-r border-gray-100 flex flex-col bg-white overflow-y-auto">
            {selectedSector === null ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <RouteIcon size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Click a sector to view routes</p>
                </div>
              </div>
            ) : loadingRoutes ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-700">
                    Routes — Sector {selectedSector}
                    <span className="font-normal text-gray-400 ml-2">({sectorRouteCount} routes)</span>
                  </h2>
                  <button onClick={handleAutoGroup}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1">
                    <Zap size={12} /> Auto-Group
                  </button>
                </div>

                <div className="flex-1 px-3 pb-3 space-y-2">
                  {routes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm">No routes yet in this sector.</p>
                      <p className="text-gray-300 text-xs mt-1">Create a route or use Auto-Group.</p>
                    </div>
                  ) : (
                    routes.map((r: any) => (
                      <RouteCard
                        key={r.id}
                        route={r}
                        deliveryPartners={deliveryPartners}
                        isSelected={selectedRouteId === r.id}
                        onSelect={() => setSelectedRouteId(r.id)}
                        onAssignBoy={handleAssignBoy}
                        onDelete={handleDeleteRoute}
                        onViewRunSheet={(id) => setRunSheetRouteId(id)}
                        assigning={assigning}
                      />
                    ))
                  )}
                </div>

                {/* Create Route */}
                <div className="px-3 pb-3 border-t border-gray-50 pt-3">
                  {showCreateRoute ? (
                    <div className="space-y-2">
                      <input
                        value={newRouteName} onChange={e => setNewRouteName(e.target.value)}
                        placeholder="Route name (e.g. Prestige Apt Morning)"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-fresh-green/30"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <select value={newRouteShift} onChange={e => setNewRouteShift(e.target.value as 'morning' | 'evening')}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-xs outline-none">
                          <option value="morning">☀️ Morning</option>
                          <option value="evening">🌙 Evening</option>
                        </select>
                        <button onClick={handleCreateRoute} disabled={!newRouteName.trim() || creating}
                          className="px-3 py-1.5 bg-fresh-green text-white text-xs font-semibold rounded-md disabled:opacity-40 flex items-center gap-1">
                          {creating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Create
                        </button>
                        <button onClick={() => { setShowCreateRoute(false); setNewRouteName(''); }}
                          className="p-1.5 bg-gray-100 text-gray-500 rounded-md"><X size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowCreateRoute(true)}
                      className="w-full py-2 text-xs font-semibold text-fresh-green bg-green-50 rounded-lg hover:bg-green-100 transition-all flex items-center justify-center gap-1.5">
                      <Plus size={14} /> Create Route
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ═══ PANEL 3: Map + Unrouted Customers (35%) ═══ */}
          <div className="w-[35%] flex flex-col overflow-y-auto bg-gray-50/30">
            {/* Map */}
            <div className="p-3">
              <SectorMap
                sectors={sectors}
                sectorCount={selectedBranch?.sector_count || sectors.length || 3}
                centerLat={Number(selectedBranch?.lat)}
                centerLng={Number(selectedBranch?.lng)}
                radiusKm={Number(selectedBranch?.delivery_radius_km) || 5}
                bufferZoneKm={Number(selectedBranch?.buffer_zone) || 0}
                selectedSector={selectedSector}
                onSectorClick={loadSectorRoutes}
                height="280px"
              />
            </div>

            {/* Unrouted Customers */}
            {selectedSector !== null && (
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                    <Users size={14} /> Unrouted Customers
                    <span className="font-normal text-gray-400">({unrouted.length})</span>
                  </h3>
                </div>

                {loadingUnrouted ? (
                  <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                ) : unrouted.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-xs">All customers are assigned to routes ✓</p>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-h-[300px] overflow-y-auto">
                    {unrouted.map((c: any) => (
                      <div key={c.id} className="px-3 py-2 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50/50">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{c.full_name || '—'}</div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {c.apartment_name || c.phone || '—'}
                          </div>
                        </div>
                        {routes.length > 0 && (
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <select
                              className="text-[11px] border border-gray-200 rounded px-1.5 py-1 outline-none max-w-[120px]"
                              defaultValue=""
                              onChange={e => { if (e.target.value) handleAssignCustomer(c.id, e.target.value); }}
                              disabled={assigningCustomer === c.id}
                            >
                              <option value="">→ Route</option>
                              {routes.map((r: any) => (
                                <option key={r.id} value={r.id}>{r.route_name}</option>
                              ))}
                            </select>
                            {assigningCustomer === c.id && <Loader2 size={12} className="animate-spin text-gray-400" />}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Run Sheet Modal */}
      {runSheetRouteId && (
        <RunSheetModal routeId={runSheetRouteId} onClose={() => setRunSheetRouteId(null)} />
      )}

      {/* Change Sector Count Modal */}
      {showChangeSectors && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowChangeSectors(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Change Sector Count</h3>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700 mb-4 flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <span>This will delete all existing routes and remap customers. This cannot be undone.</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Current: <strong>{sectors.length}</strong> sectors → New:</p>
            <input type="number" value={newSectorCount} onChange={e => setNewSectorCount(parseInt(e.target.value) || 1)} min={1} max={20}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowChangeSectors(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg text-sm">Cancel</button>
              <button onClick={handleChangeSectorCount} disabled={changingCount} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {changingCount ? <Loader2 size={16} className="animate-spin" /> : null} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
