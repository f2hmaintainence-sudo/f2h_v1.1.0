'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Building2, Users, Activity, Globe, ArrowLeft, Pencil, CheckCircle2,
  AlertTriangle, Phone, Mail, Truck, ShieldCheck, DollarSign, Package, UserPlus, Trash2, ArrowUpRight, Search, Check, ChevronDown, User, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api.client';
import { showSuccessToast } from '@/services/toast.service';

const SectorMap = dynamic(() => import('@/components/branch/SectorMap'), { ssr: false });

function getPartnerDisplayName(p: any): string {
  if (!p) return 'Delivery Partner';
  if (p.full_name?.trim()) return p.full_name.trim();
  if (p.name?.trim()) return p.name.trim();
  const first = p.first_name?.trim() || '';
  const last = p.last_name?.trim() || '';
  if (first || last) return `${first} ${last}`.trim();
  if (p.user_name?.trim()) return p.user_name.trim();
  if (p.phone?.trim()) return `Partner (${p.phone.trim()})`;
  if (p.mobile?.trim()) return `Partner (${p.mobile.trim()})`;
  return `Partner #${p.delivery_partner_id || p.id || '001'}`;
}

export default function Branch360PortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'fleet' | 'map' | 'analytics'>('fleet');

  const [branchPartners, setBranchPartners] = useState<any[]>([]);
  const [unassignedPartners, setUnassignedPartners] = useState<any[]>([]);
  const [selectedPartnerToAssign, setSelectedPartnerToAssign] = useState('');
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBranchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [fullRes, partnersRes] = await Promise.all([
        api.get<any>(`/admin/branch/${id}/detail`).catch(() => null),
        api.get<any>(`/admin/delivery/partners?limit=200`).catch(() => null),
      ]);

      const branchObj = fullRes?.data?.data || fullRes?.data || null;
      if (branchObj) {
        setBranch(branchObj);
      }

      if (partnersRes?.data?.data) {
        const all = partnersRes.data.data || [];
        const targetBranchId = branchObj?.branch_id || id;
        const allocated = all.filter((p: any) => p.branch_id === targetBranchId || p.branch_id === id);
        const others = all.filter((p: any) => p.branch_id !== targetBranchId && p.branch_id !== id);
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
    return unassignedPartners.filter(p => {
      const name = getPartnerDisplayName(p).toLowerCase();
      return (
        name.includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.vehicle_type || '').toLowerCase().includes(q)
      );
    });
  }, [unassignedPartners, partnerSearchQuery]);

  const handleAllocatePartner = async (partnerId: string, targetBranchId: string | null) => {
    if (!partnerId) return;
    setAllocating(true);
    try {
      const all = [...branchPartners, ...unassignedPartners];
      const targetPartner = all.find(p => (p.delivery_partner_id || p.id) === partnerId);
      if (targetPartner) {
        await api.post(`/admin/delivery/partners/saveEdit/${partnerId}`, {
          full_name: getPartnerDisplayName(targetPartner),
          phone: targetPartner.phone || targetPartner.mobile,
          branch_id: targetBranchId
        });
        showSuccessToast(targetBranchId ? 'Delivery partner allocated to branch!' : 'Delivery partner de-allocated!', 3000);
        setSelectedPartnerToAssign('');
        setPartnerSearchQuery('');
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
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <Building2 size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Branch Hub Not Found</h2>
        <p className="text-sm text-slate-500 max-w-sm mb-6">The requested branch hub could not be retrieved or has been removed.</p>
        <Link
          href="/admin/branches"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <ArrowLeft size={16} /> Back to Branch Management
        </Link>
      </div>
    );
  }

  const activePartnerCount = branchPartners.filter(p => p.is_active).length;

  return (
    <div className="space-y-6 p-4 md:p-8 font-sans min-h-screen bg-slate-50/50 text-slate-900">
      
      {/* Top Executive Header & Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div className="flex items-center gap-3">
          <Link href="/admin/branches" className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors border border-slate-200">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700">Enterprise Logistics Hub</span>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded border border-slate-200">#{branch.branch_code || 'HUB-01'}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-0.5">{branch.branch_name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBranchDetail}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-200 cursor-pointer"
            title="Refresh Branch Data"
          >
            <RefreshCw size={16} />
          </button>

          <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            branch.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${branch.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} />
            {branch.is_active ? 'Operational' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Metric Cards & Live Coverage Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: KPI Cards */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            
            {/* Allocated Fleet */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allocated Delivery Fleet</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Users size={18} />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{branchPartners.length} <span className="text-xs font-bold text-slate-400">Partners</span></p>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-emerald-700 font-bold">{activePartnerCount} On-Duty Active</span>
                <span className="text-slate-400">{branchPartners.length - activePartnerCount} Off-duty</span>
              </div>
            </div>

            {/* Coverage Radius */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Coverage Radius</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Globe size={18} />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{branch.delivery_radius_km || 5} <span className="text-xs font-bold text-slate-400 uppercase">KM</span></p>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-purple-600 font-bold">+{branch.buffer_zone || 0} KM Buffer Zone</span>
                <span className="text-slate-500 font-bold">{branch.allow_buffer_order ? 'Buffer Enabled' : 'Buffer Disabled'}</span>
              </div>
            </div>

            {/* Operational Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Status</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Activity size={18} />
                </div>
              </div>
              <p className="text-xl font-black text-slate-900">{branch.is_active ? 'Fully Operational' : 'Hub Offline'}</p>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium">
                <span className="text-emerald-600 font-bold">Live Order Dispatching</span>
              </div>
            </div>

          </div>

          {/* Location & Coordinates Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 border border-emerald-100">
              <MapPin size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hub Geocoded Location</p>
              <p className="text-sm font-mono font-bold text-slate-800 mt-1">
                {branch.lat ? `${Number(branch.lat).toFixed(6)}, ${Number(branch.lng).toFixed(6)}` : 'Not geocoded'}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                {branch.city || 'N/A'}{branch.state ? `, ${branch.state}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Full-Bleed Map Card Covering Entire Container */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col relative h-full min-h-[460px]">
          {/* Floating Glassmorphism Map Header Overlay */}
          <div className="absolute top-3 left-3 right-3 z-10 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Service Zone Coverage Map</span>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-md">Google Maps Live</span>
          </div>

          {/* Map Expands 100% Edge-to-Edge */}
          <div className="w-full h-full flex-1 min-h-[460px]">
            <SectorMap
              centerLat={branch.lat ? Number(branch.lat) : undefined}
              centerLng={branch.lng ? Number(branch.lng) : undefined}
              radiusKm={Number(branch.delivery_radius_km) || 5}
              bufferZoneKm={Number(branch.buffer_zone) || 0}
              height="100%"
            />
          </div>
        </div>

      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-3 pt-2">
          {[
            { id: 'fleet', label: 'Delivery Fleet Roster', icon: Users },
            { id: 'map', label: 'Service Zone Map', icon: Globe },
            { id: 'analytics', label: 'Hub Intelligence & Config', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Delivery Fleet Roster */}
        <div className="p-6">
          {activeTab === 'fleet' && (
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

                {/* Search & Dropdown Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-8 relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search available delivery partner by name, phone or vehicle..."
                        value={partnerSearchQuery}
                        onFocus={() => setDropdownOpen(true)}
                        onChange={(e) => {
                          setPartnerSearchQuery(e.target.value);
                          setDropdownOpen(true);
                          if (selectedPartnerToAssign) {
                            setSelectedPartnerToAssign('');
                          }
                        }}
                        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-none shadow-2xs placeholder-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown size={16} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50 divide-y divide-slate-100 py-1.5 scrollbar-thin">
                        {filteredUnassignedPartners.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No unallocated partners found
                          </div>
                        ) : (
                          filteredUnassignedPartners.map((p) => {
                            const partnerId = p.delivery_partner_id || p.id;
                            const isSelected = selectedPartnerToAssign === partnerId;
                            const partnerName = getPartnerDisplayName(p);
                            return (
                              <button
                                key={partnerId}
                                type="button"
                                onClick={() => {
                                  setSelectedPartnerToAssign(partnerId);
                                  setPartnerSearchQuery(partnerName);
                                  setDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs gap-3 ${
                                  isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''
                                }`}
                              >
                                <div className="flex flex-col min-w-0 gap-1">
                                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                                    <User size={14} className="text-emerald-600 shrink-0" />
                                    <span className="truncate">{partnerName}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-semibold pl-5">
                                    <span className="flex items-center gap-1">
                                      <Phone size={10} className="text-slate-400 shrink-0" />
                                      {p.phone || p.mobile || 'No Phone'}
                                    </span>
                                    <span className="flex items-center gap-1 capitalize">
                                      <Truck size={10} className="text-slate-400 shrink-0" />
                                      {p.vehicle_type || 'Bike'}
                                    </span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check size={14} className="text-emerald-600 shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-4">
                    <button
                      type="button"
                      disabled={!selectedPartnerToAssign || allocating}
                      onClick={() => handleAllocatePartner(selectedPartnerToAssign, branch.branch_id || id)}
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
                    {branchPartners.map((p) => {
                      const isActive = p.is_active;
                      const partnerName = getPartnerDisplayName(p);
                      const initials = partnerName
                        .split(' ')
                        .filter(Boolean)
                        .map((part: string) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div key={p.delivery_partner_id || p.id} className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-300 hover:shadow-md transition-all group">
                          <div className={`absolute top-0 left-0 right-0 h-1 transition-opacity ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />

                          <div className="flex items-start justify-between gap-3 pt-1">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-2xl ${
                                isActive ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20' : 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-slate-700/20'
                              } font-black text-sm flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105`}>
                                {initials || <Truck size={18} />}
                              </div>
                              <div className="min-w-0">
                                <Link href={`/admin/delivery/partners/${p.delivery_partner_id || p.id}`} className="text-xs font-black text-slate-900 hover:text-emerald-600 transition-colors flex items-center gap-1 truncate">
                                  <span className="truncate">{partnerName}</span>
                                  <ArrowUpRight size={12} className="text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                                </Link>
                                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                  <Phone size={11} className="text-slate-400 shrink-0" /> {p.phone || p.mobile || 'No Phone'}
                                </p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-600 font-bold flex items-center gap-1.5">
                              <Truck size={13} className="text-slate-400" /> {p.vehicle_type || 'Bike'}
                            </span>
                            <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50">
                              ₹{Number(p.daily_salary || 0).toLocaleString()} / day
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={allocating}
                            onClick={() => handleAllocatePartner(p.delivery_partner_id || p.id, null)}
                            className="w-full py-2 bg-rose-50/60 hover:bg-rose-600 hover:text-white text-rose-600 text-xs font-bold rounded-xl border border-rose-200/50 hover:border-rose-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                          >
                            <Trash2 size={13} /> De-assign from Branch
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Tab 2: Map */}
          {activeTab === 'map' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-[500px] flex flex-col relative">
                <div className="absolute top-3 left-3 right-3 z-10 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between pointer-events-auto">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Interactive Service Zone Coverage Map</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">Google Maps Service View</span>
                </div>
                <div className="w-full h-full flex-1">
                  <SectorMap
                    centerLat={branch.lat ? Number(branch.lat) : undefined}
                    centerLng={branch.lng ? Number(branch.lng) : undefined}
                    radiusKm={Number(branch.delivery_radius_km) || 5}
                    bufferZoneKm={Number(branch.buffer_zone) || 0}
                    height="100%"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Intelligence & Analytics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Fleet Utilization Ratio</p>
                  <p className="text-3xl font-black text-slate-900">{activePartnerCount} / {branchPartners.length}</p>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${branchPartners.length > 0 ? (activePartnerCount / branchPartners.length) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buffer Zone Policy</p>
                  <p className="text-xl font-bold text-slate-900">{branch.allow_buffer_order ? 'Buffer Orders Active' : 'Buffer Orders Disabled'}</p>
                  <p className="text-xs text-slate-400">Customer orders allowed up to +{branch.buffer_zone || 0} KM beyond main radius.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
