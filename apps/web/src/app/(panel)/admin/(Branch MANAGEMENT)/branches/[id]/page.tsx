'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Building2, Hexagon, Users, Activity, Globe, ArrowLeft, Pencil, CheckCircle2,
  AlertTriangle, Phone, Mail, Truck, ShieldCheck, DollarSign, Package, UserPlus, Trash2, ArrowUpRight, Search, Check
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api.client';
import { showSuccessToast } from '@/services/toast.service';

const HexSectorMap = dynamic(() => import('@/components/branch/HexSectorMap'), { ssr: false });

export default function Branch360PortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Partner Fleet');

  const [hexes, setHexes] = useState<{ hex_id: string; sector_index: number }[]>([]);
  const [hexMessage, setHexMessage] = useState('');

  const [branchPartners, setBranchPartners] = useState<any[]>([]);
  const [unassignedPartners, setUnassignedPartners] = useState<any[]>([]);
  const [selectedPartnerToAssign, setSelectedPartnerToAssign] = useState('');
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [allocating, setAllocating] = useState(false);

  const fetchBranchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [fullRes, hexRes, partnersRes] = await Promise.all([
        api.get<any>(`/admin/branch/${id}/detail`),
        api.get<any>(`/admin/branch/hexes/${id}`),
        api.get<any>(`/admin/delivery/partners?limit=200`),
      ]);

      if (fullRes.data?.status && fullRes.data?.data) {
        setBranch(fullRes.data.data);
      }
      if (hexRes.data?.status) {
        setHexes(hexRes.data.data || []);
        setHexMessage(hexRes.data.message || '');
      }

      if (partnersRes.data?.data) {
        const all = partnersRes.data.data || [];
        const allocated = all.filter((p: any) => p.branch_id === id);
        const others = all.filter((p: any) => p.branch_id !== id);
        setBranchPartners(allocated);
        setUnassignedPartners(others);
      }
    } catch (e) {
      console.error('Failed to load branch 360 portfolio:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBranchDetail();
  }, [fetchBranchDetail]);

  const filteredUnassignedPartners = useMemo(() => {
    if (!partnerSearchQuery.trim()) return unassignedPartners;
    const q = partnerSearchQuery.toLowerCase();
    return unassignedPartners.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.vehicle_type || '').toLowerCase().includes(q)
    );
  }, [unassignedPartners, partnerSearchQuery]);

  const handleAllocatePartner = async (partnerId: string, targetBranchId: string | null) => {
    if (!partnerId) return;
    setAllocating(true);
    try {
      const all = [...branchPartners, ...unassignedPartners];
      const targetPartner = all.find(p => (p.delivery_partner_id || p.id) === partnerId);
      if (targetPartner) {
        await api.post(`/admin/delivery/partners/saveEdit/${partnerId}`, {
          full_name: targetPartner.full_name,
          phone: targetPartner.phone,
          branch_id: targetBranchId
        });
        showSuccessToast(targetBranchId ? 'Delivery partner allocated to branch!' : 'Delivery partner de-allocated!', 3000);
        setSelectedPartnerToAssign('');
        await fetchBranchDetail();
      }
    } catch (e) {
      console.error('Failed to allocate partner:', e);
    } finally {
      setAllocating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50/50 gap-3">
        <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Loading Branch Control Center...</p>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        Branch hub not found
      </div>
    );
  }

  const activePartnerCount = branchPartners.filter(p => p.is_active).length;

  return (
    <div className="space-y-6 p-4 md:p-8 font-sans min-h-screen bg-slate-50/50 text-slate-900">
      
      {/* Top Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6 bg-white p-6 rounded-2xl shadow-xs border">
        <div className="flex items-center gap-3">
          <Link href="/admin/branches" className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors border border-slate-200">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700">Branch Logistics Hub</span>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded border border-slate-200">#{branch.branch_code}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">{branch.branch_name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            branch.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${branch.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} />
            {branch.is_active ? 'Active Hub' : 'Inactive Hub'}
          </span>
        </div>
      </div>

      {/* Hero Command Grid: Stats + Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Light KPI Cards */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-4">
            
            {/* Allocated Fleet */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allocated Fleet</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Users size={18} />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{branchPartners.length}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-emerald-700 font-bold">{activePartnerCount} Active</span>
                <span className="text-slate-400">{branchPartners.length - activePartnerCount} Off-duty</span>
              </div>
            </div>

            {/* Coverage Radius */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Radius</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Globe size={18} />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{branch.delivery_radius_km || 0} <span className="text-xs font-bold text-slate-400 uppercase">KM</span></p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-purple-600 font-bold">+{branch.buffer_zone || 0} KM Buffer</span>
                <span className="text-slate-400">{branch.allow_buffer_order ? 'Buffer On' : 'Buffer Off'}</span>
              </div>
            </div>

            {/* H3 Hex Density */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">H3 Coverage Hexes</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Hexagon size={18} />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{hexes.length}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-indigo-600 font-bold">Res-{branch.h3_resolution || 8}</span>
                <span className="text-slate-400">{branch.hex_shape || 'Hexagon'}</span>
              </div>
            </div>

            {/* Operational Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Status</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Activity size={18} />
                </div>
              </div>
              <p className="text-xl font-black text-slate-900 mt-1">{branch.is_active ? 'Fully Active' : 'Offline'}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-emerald-600 font-bold">Live Dispatching</span>
              </div>
            </div>

          </div>

          {/* Location Details Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 border border-emerald-100">
              <MapPin size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hub Geocoded Coordinates</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {branch.lat ? `${Number(branch.lat).toFixed(6)}, ${Number(branch.lng).toFixed(6)}` : 'Not geocoded'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {branch.city || 'N/A'}{branch.state ? `, ${branch.state}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Map Container */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Service Zone Coverage Map</span>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-md">Interactive Leaflet Tiles</span>
          </div>

          <div className="flex-1 w-full h-full min-h-[380px] p-3">
            {branch.lat && branch.lng ? (
              <HexSectorMap
                hexes={hexes}
                centerLat={Number(branch.lat)}
                centerLng={Number(branch.lng)}
                radiusKm={Number(branch.delivery_radius_km)}
                bufferZoneKm={Number(branch.buffer_zone)}
                height="380px"
                emptyMessage={hexMessage}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[350px]">
                <AlertTriangle size={36} className="text-amber-500 mb-2" />
                <p className="font-bold text-xs">Coordinates missing for map rendering</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {['Partner Fleet', 'Live Service Zone Map', 'Branch Performance & Analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-emerald-600 text-emerald-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab 1: Partner Fleet */}
        <div className="p-6">
          {activeTab === 'Partner Fleet' && (
            <div className="space-y-6">
              
              {/* Partner Allocator Box */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus size={18} className="text-emerald-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Allocate Delivery Partner to {branch.branch_name}</h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{unassignedPartners.length} Partners Available</span>
                </div>

                {/* Search & Rich Select Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-8 relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={selectedPartnerToAssign}
                      onChange={(e) => setSelectedPartnerToAssign(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-none shadow-2xs"
                    >
                      <option value="">Choose delivery boy by name, phone or vehicle...</option>
                      {filteredUnassignedPartners.map((p) => (
                        <option key={p.delivery_partner_id || p.id} value={p.delivery_partner_id || p.id}>
                          👤 {p.full_name || 'Delivery Partner'} — 📞 {p.phone || 'No Phone'} — 🏍️ {p.vehicle_type || 'Bike'} (Current Hub: {p.branch_name || p.branch_id || 'Unassigned'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <button
                      type="button"
                      disabled={!selectedPartnerToAssign || allocating}
                      onClick={() => handleAllocatePartner(selectedPartnerToAssign, branch.branch_id)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {allocating ? 'Allocating...' : 'Assign to Branch Hub'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Fleet List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Allocated Delivery Fleet ({branchPartners.length})</h3>
                
                {branchPartners.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    No delivery partners allocated to this branch yet. Use the allocator form above to assign delivery partners.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branchPartners.map((p) => (
                      <div key={p.delivery_partner_id || p.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-inner">
                              {(p.full_name || 'D').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <Link href={`/admin/delivery/partners/${p.delivery_partner_id || p.id}`} className="text-xs font-black text-slate-900 hover:text-emerald-600 transition-colors flex items-center gap-1">
                                {p.full_name} <ArrowUpRight size={12} />
                              </Link>
                              <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                <Phone size={11} className="text-emerald-600" /> {p.phone || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                            p.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-slate-600 font-bold flex items-center gap-1">
                            <Truck size={13} className="text-slate-400" /> {p.vehicle_type || 'Bike'}
                          </span>
                          <span className="text-emerald-700 font-extrabold">
                            ₹{Number(p.daily_salary || 0).toLocaleString()} / day
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={allocating}
                          onClick={() => handleAllocatePartner(p.delivery_partner_id || p.id, null)}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={13} /> De-assign from Branch
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Tab 2: Map */}
          {activeTab === 'Live Service Zone Map' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-[450px] flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Interactive Service Zone Coverage Map</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">Leaflet H3 Grid Overlay</span>
                </div>
                <div className="p-3 flex-1 min-h-[400px]">
                  {branch.lat && branch.lng ? (
                    <HexSectorMap
                      hexes={hexes}
                      centerLat={Number(branch.lat)}
                      centerLng={Number(branch.lng)}
                      radiusKm={Number(branch.delivery_radius_km)}
                      bufferZoneKm={Number(branch.buffer_zone)}
                      height="400px"
                      emptyMessage={hexMessage}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                      <AlertTriangle size={36} className="text-amber-500 mb-2" />
                      <p className="font-bold text-xs">Coordinates missing for map view</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Analytics */}
          {activeTab === 'Branch Performance & Analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Fleet Ratio</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{activePartnerCount} / {branchPartners.length}</p>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${branchPartners.length > 0 ? (activePartnerCount / branchPartners.length) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buffer Orders Allowed</p>
                  <p className="text-xl font-bold text-slate-900 mt-2">{branch.allow_buffer_order ? 'Enabled' : 'Disabled'}</p>
                  <p className="text-xs text-slate-400 mt-1">Customer orders permitted within buffer zone radius.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">H3 Grid Density</p>
                  <p className="text-xl font-mono font-bold text-indigo-600 mt-2">{hexes.length} Hexagons</p>
                  <p className="text-xs text-slate-400 mt-1">Resolution index: H3 Res-{branch.h3_resolution || 8}</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
