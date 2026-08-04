// Trigger build deploy: 2026-08-04-v2
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Plus, Search, Building2, Building, Loader2, ChevronRight,
  AlertTriangle, Users, Hexagon, Pencil, Eye, X, Check, RefreshCw, ArrowLeft, Info, Activity, Globe
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api.client';
import { showSuccessToast } from '@/services/toast.service';

const MapPicker = dynamic(() => import('@/components/shared/MapPicker'), { ssr: false });
const SectorMap = dynamic(() => import('@/components/branch/SectorMap'), { ssr: false });

type BranchHexShape = 'hexagon' | 'circle' | 'square';

interface Branch {
  id?: number;
  branch_id: string;
  branch_name: string;
  branch_code: string;
  city?: string;
  state?: string;
  is_active: boolean;
  lat?: number | null;
  lng?: number | null;
  delivery_radius_km?: number | null;
  buffer_zone?: number | null;
  allow_buffer_order?: boolean | null;
  sector_count?: number | null;
}

type FormState = {
  branch_name: string;
  branch_code: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  delivery_radius_km: number;
  buffer_zone: number;
  allow_buffer_order: boolean;
  sector_count: number;
  is_active: boolean;
};

export default function BranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'detail' | 'edit'>('list');

  // Form state (shared between create and edit)
  const emptyForm: FormState = {
    branch_name: '', branch_code: '', city: '', state: '',
    lat: null, lng: null, delivery_radius_km: 5, buffer_zone: 0, allow_buffer_order: false, sector_count: 3, is_active: true,
  };
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'list' | 'form' | 'detail'>('list');
  const [formStep, setFormStep] = useState(1);
  const [detailStep, setDetailStep] = useState(1);
  const [formModalOpen, setFormModalOpen] = useState(false);

  // Detail view state
  const [sectors, setSectors] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Partner Allocation & Analytics State
  const [branchPartners, setBranchPartners] = useState<any[]>([]);
  const [unassignedPartners, setUnassignedPartners] = useState<any[]>([]);
  const [selectedPartnerToAssign, setSelectedPartnerToAssign] = useState('');
  const [allocating, setAllocating] = useState(false);

  const normalizeHexShape = (value: unknown): BranchHexShape => {
    return value === 'circle' || value === 'square' || value === 'hexagon' ? value : 'hexagon';
  };

  // Fetch branches list
  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/branch/table?page=1&limit=100&_=${Date.now()}`);
      if (res.data?.status && res.data?.data) {
        const rawRows = Array.isArray(res.data.data) ? res.data.data : res.data.data.rows || [];
        const normalized = rawRows
          .filter((b: any) => b && typeof b === 'object')
          .map((b: any) => ({
            ...b,
            is_active: typeof b.is_active === 'string'
              ? (b.is_active.includes('badge-success') || b.is_active.includes('Active') || b.is_active === 'true')
              : !!b.is_active,
            allow_buffer_order: typeof b.allow_buffer_order === 'string'
              ? b.allow_buffer_order === 'true' || b.allow_buffer_order.includes('badge-success') || b.allow_buffer_order.includes('Allowed')
              : !!b.allow_buffer_order,
            hex_shape: normalizeHexShape(b.hex_shape)
          }));
        setBranches(normalized);
      }
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  // Load full branch detail
  const loadBranchDetail = useCallback(async (branch: Branch) => {
    setSelectedBranch(branch);
    setMode('detail');
    setStep('detail');
    setDetailStep(1);
    setLoadingDetail(true);
    setSectors([]);
    setBranchPartners([]);
    setUnassignedPartners([]);
    try {
      const [fullRes, sectorRes, partnersRes] = await Promise.all([
        api.get<any>(`/admin/branch/${branch.branch_id}/detail`),
        api.get<any>(`/admin/zone/sectors/${branch.branch_id}`),
        api.get<any>(`/admin/delivery/partners?limit=200`),
      ]);
      if (fullRes.data?.status && fullRes.data?.data) setSelectedBranch(fullRes.data.data);
      if (sectorRes.data?.status) setSectors(sectorRes.data.data || []);
      if (partnersRes.data?.data) {
        const all = partnersRes.data.data || [];
        const allocated = all.filter((p: any) => p.branch_id === branch.branch_id);
        const others = all.filter((p: any) => p.branch_id !== branch.branch_id);
        setBranchPartners(allocated);
        setUnassignedPartners(others);
      }
    } catch { }
    setLoadingDetail(false);
  }, []);

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
        if (selectedBranch) await loadBranchDetail(selectedBranch);
      }
    } catch (e) {
      console.error('Failed to allocate partner:', e);
    } finally {
      setAllocating(false);
    }
  };

  // Create branch
  const handleSave = async () => {
    if (!form.branch_name.trim()) { setError('Branch name is required'); return; }
    if (!form.branch_code.trim()) { setError('Branch code is required'); return; }

    setSaving(true); setError('');
    try {
      const res = await api.post<any>('/admin/branch/saveAdd', form);
      if (res.data?.status) {
        showSuccessToast(res.data.message || 'Branch created!', 3000);
        setMode('list');
        setStep('list');
        setFormStep(1);
        setFormModalOpen(false);
        resetForm();
        fetchBranches();
      } else {
        setError(res.data?.message || res.error || 'Failed to create branch');
      }
    } catch { setError('Network error'); }
    setSaving(false);
  };

  // Edit branch
  const handleEdit = async () => {
    if (!selectedBranch) return;
    if (!form.branch_name.trim()) { setError('Branch name is required'); return; }

    setSaving(true); setError('');
    try {
      const res = await api.post<any>(`/admin/branch/${selectedBranch.branch_id}/saveEdit`, form);
      if (res.data?.status) {
        showSuccessToast(res.data.message || 'Branch updated!', 3000);
        setFormModalOpen(false);
        setStep('list');
        setMode('list');
        fetchBranches();
      } else {
        setError(res.data?.message || res.error || 'Failed to update branch');
      }
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setError('');
  };

  const willRegenSectors = selectedBranch && mode === 'edit' && (
    (form.lat !== null && form.lng !== null) && (
      String(form.lat) !== String(selectedBranch.lat) ||
      String(form.lng) !== String(selectedBranch.lng) ||
      form.delivery_radius_km !== Number(selectedBranch.delivery_radius_km) ||
      form.sector_count !== Number(selectedBranch.sector_count)
    )
  );
  const openEditBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    setForm({
      branch_name: branch.branch_name || '',
      branch_code: branch.branch_code || '',
      city: branch.city || '',
      state: branch.state || '',
      lat: branch.lat !== null && branch.lat !== undefined ? Number(branch.lat) : null,
      lng: branch.lng !== null && branch.lng !== undefined ? Number(branch.lng) : null,
      delivery_radius_km: Number(branch.delivery_radius_km) || 5,
      buffer_zone: Number(branch.buffer_zone) || 0,
      allow_buffer_order: !!branch.allow_buffer_order,
      sector_count: Number(branch.sector_count) || 3,
      is_active: branch.is_active,
    });
    setError('');
    setMode('edit');
    setStep('form');
    setFormStep(1);
    setFormModalOpen(true);
  };


  const filtered = branches.filter(b => {
    if (filter === 'active' && !b.is_active) return false;
    if (filter === 'inactive' && b.is_active) return false;
    if (search && !b.branch_name?.toLowerCase().includes(search.toLowerCase()) &&
      !b.city?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const existingBranchesToDisplay = branches.filter(b => {
    if (mode === 'edit' && selectedBranch && b.branch_id === selectedBranch.branch_id) {
      return false;
    }
    return true;
  });

  // Stats calculation
  const totalHubs = branches.length;
  const activeHubs = branches.filter(b => b.is_active).length;
  const inactiveHubs = totalHubs - activeHubs;
  const totalCoverageKm = branches.reduce((acc, curr) => acc + (curr.is_active ? Number(curr.delivery_radius_km || 0) : 0), 0);
  const totalSectorsCount = branches.reduce((acc, curr) => acc + (curr.is_active ? Number(curr.sector_count || 0) : 0), 0);

  return (
    <div className="w-full h-[calc(100vh-80px)] bg-slate-50/50 overflow-hidden relative flex flex-col animate-in fade-in duration-300" style={{ fontFamily: "'Plus Jakarta Sans', var(--font-plus-jakarta), sans-serif", fontStyle: 'normal' }}>
{/* Main Dashboard Panel */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-[1600px] mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Branch Control Center</h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">Monitor delivery coverage, logistics zones, and operational parameters.</p>
            </div>
            <button
              onClick={() => { setMode('create'); setStep('form'); setFormStep(1); resetForm(); setFormModalOpen(true); }}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-2xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={18} /> Add New Branch
            </button>
          </div>

          {/* Stats Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 p-6 rounded-[2rem] border border-indigo-100/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-[-10px] bottom-[-10px] text-indigo-200/40 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Building2 size={110} strokeWidth={0.5} />
              </div>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Total Hubs</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-950">{totalHubs}</span>
                <span className="text-xs text-indigo-600 font-bold bg-indigo-100/50 px-2 py-0.5 rounded-full">{activeHubs} Active</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-6 rounded-[2rem] border border-emerald-100/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-[-10px] bottom-[-10px] text-emerald-200/40 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Globe size={110} strokeWidth={0.5} />
              </div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Service Coverage</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-950">{totalCoverageKm.toFixed(1)}</span>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-100/50 px-2 py-0.5 rounded-full">KM Combined</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100/30 p-6 rounded-[2rem] border border-blue-100/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-[-10px] bottom-[-10px] text-blue-200/40 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Hexagon size={110} strokeWidth={0.5} />
              </div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Sectors</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-950">{totalSectorsCount}</span>
                <span className="text-xs text-blue-600 font-bold bg-blue-100/50 px-2 py-0.5 rounded-full">Operational</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100/30 p-6 rounded-[2rem] border border-purple-100/50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-[-10px] bottom-[-10px] text-purple-200/40 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Activity size={110} strokeWidth={0.5} />
              </div>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Active Ratio</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-purple-950">
                  {totalHubs > 0 ? Math.round((activeHubs / totalHubs) * 100) : 0}%
                </span>
                <span className="text-xs text-purple-600 font-bold bg-purple-100/50 px-2 py-0.5 rounded-full">{inactiveHubs} Inactive</span>
              </div>
            </div>
          </div>

          {/* Toolbar Search / Filter */}
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full max-w-lg">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by hub name, code, city..."
                className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
              />
            </div>
            <div className="flex p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50 select-none">
              {(['all', 'active', 'inactive'] as const).map(f => {
                const count = f === 'all' ? totalHubs : f === 'active' ? activeHubs : inactiveHubs;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${filter === f
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    <span className="uppercase">{f}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/60 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Retrieving branches...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search size={24} className="text-slate-300" />
              </div>
              <p className="text-base font-bold text-slate-800">No branches found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">We couldn't find any branches matching your search query or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((b, idx) => (
                <div
                  key={b.branch_id || `branch-${idx}`}
                  onClick={() => router.push(`/admin/branches/${b.branch_id}`)}
                  className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl cursor-pointer"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors shrink-0 shadow-inner">
                          <Building2 size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block truncate">
                            CODE: {b.branch_code || '-'}
                          </span>
                          <h3 className="mt-0.5 font-black text-slate-900 text-base leading-tight group-hover:text-emerald-700 transition-colors truncate" title={b.branch_name}>
                            {b.branch_name}
                          </h3>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${b.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${b.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                          {b.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openEditBranch(b); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-xs"
                          title="Edit branch"
                          aria-label={`Edit ${b.branch_name}`}
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>

                    <p className="mt-3.5 text-xs text-slate-500 flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{b.city || 'Unassigned city'}{b.state ? `, ${b.state}` : ''}</span>
                    </p>

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${b.allow_buffer_order ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${b.allow_buffer_order ? 'bg-teal-500' : 'bg-slate-300'}`} />
                        Buffer Orders {b.allow_buffer_order ? 'On' : 'Off'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-indigo-700 border border-indigo-100">
                        <Hexagon size={10} /> {b.sector_count || 0} Sectors
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 bg-slate-50/70 p-2.5 rounded-2xl">
                    <div className="rounded-xl bg-white px-2 py-2 text-center border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Radius</p>
                      <p className="mt-0.5 text-xs font-extrabold text-slate-900">{Number(b.delivery_radius_km || 0).toFixed(1)} <span className="text-[9px] text-slate-400 font-medium">km</span></p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 text-center border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Buffer</p>
                      <p className="mt-0.5 text-xs font-extrabold text-slate-900">{Number(b.buffer_zone || 0).toFixed(1)} <span className="text-[9px] text-slate-400 font-medium">km</span></p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 text-center border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sectors</p>
                      <p className="mt-0.5 text-xs font-extrabold text-slate-900">{b.sector_count || 0} <span className="text-[9px] text-slate-400 font-medium">slices</span></p>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Centered Modal (Create/Edit Branch Form) */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!saving) {
                setFormModalOpen(false);
                setStep('list');
                setMode('list');
              }
            }}
          />

          {/* Modal Box */}
          <div className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/50 shadow-xs">
                  <Building size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {mode === 'edit' ? 'Edit Branch' : 'Create Branch'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure hub details, operating radius, and geographic coordinates.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!saving) {
                    setFormModalOpen(false);
                    setStep('list');
                    setMode('list');
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Progress Steps Track */}
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-4 shrink-0 select-none bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${formStep === 1 ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-100 text-emerald-700'}`}>
                  1
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${formStep === 1 ? 'text-slate-700' : 'text-slate-400'}`}>Config</span>
              </div>
              <div className="w-10 h-0.5 bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${formStep === 2 ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                  2
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${formStep === 2 ? 'text-slate-700' : 'text-slate-400'}`}>Map Pin</span>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {formStep === 1 ? (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Identity inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch Name *</label>
                      <input
                        value={form.branch_name}
                        onChange={e => setForm(f => ({ ...f, branch_name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder:text-slate-300"
                        placeholder="e.g. Whitefield Hub"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch Code *</label>
                      <input
                        value={form.branch_code}
                        onChange={e => setForm(f => ({ ...f, branch_code: e.target.value }))}
                        readOnly={mode === 'edit'}
                        className={`w-full px-3.5 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder:text-slate-300 ${mode === 'edit' ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                        placeholder="e.g. WF-01"
                      />
                    </div>
                  </div>

                  {/* City State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">City</label>
                      <input
                        value={form.city}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder:text-slate-300"
                        placeholder="e.g. Bengaluru"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</label>
                      <input
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder:text-slate-300"
                        placeholder="e.g. Karnataka"
                      />
                    </div>
                  </div>

                  {/* Numeric params */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Radius (km)</label>
                      <input
                        type="number"
                        value={form.delivery_radius_km}
                        onChange={e => setForm(f => ({ ...f, delivery_radius_km: parseFloat(e.target.value) || 5 }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700"
                        min={0.5} max={50} step={0.5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Buffer (km)</label>
                      <input
                        type="number"
                        value={form.buffer_zone}
                        onChange={e => setForm(f => ({ ...f, buffer_zone: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700"
                        min={0} max={20} step={0.1}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sectors Count</label>
                      <input
                        type="number"
                        value={form.sector_count}
                        onChange={e => setForm(f => ({ ...f, sector_count: parseInt(e.target.value) || 3 }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700"
                        min={1} max={20}
                      />
                    </div>
                  </div>

                  {/* Branch behavior toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Hub Active Status</p>
                        <p className="text-xs text-slate-400 mt-0.5">Control whether order allocations are allowed for this hub.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Allow Buffer Orders</p>
                        <p className="text-xs text-slate-400 mt-0.5">Permit orders from the configured buffer-zone area.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={form.allow_buffer_order}
                          onChange={e => setForm(f => ({ ...f, allow_buffer_order: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Map picker */}
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm relative h-[380px]">
                    <MapPicker
                      lat={form.lat}
                      lng={form.lng}
                      radiusKm={form.delivery_radius_km}
                      bufferZoneKm={form.buffer_zone}
                      onLocationChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
                      existingBranches={existingBranchesToDisplay}
                      selectedShape={form.hex_shape}
                      onShapeChange={(hex_shape) => setForm(f => ({ ...f, hex_shape }))}
                    />
                  </div>

                  {mode === 'edit' && willRegenSectors && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Sector Regeneration</p>
                        <p className="text-xs text-amber-700 leading-relaxed mt-1">
                          Updating the location pin, radius, or sector count will reset all delivery sectors and assignments.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                {error && (
                  <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                    <AlertTriangle size={13} className="flex-shrink-0" />
                    <p className="text-xs font-semibold">{error}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (formStep > 1) { setFormStep(1); }
                    else {
                      setFormModalOpen(false);
                      setStep('list');
                      setMode('list');
                    }
                  }}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors text-xs disabled:opacity-50"
                >
                  {formStep === 1 ? 'Cancel' : 'Back'}
                </button>

                {formStep === 1 ? (
                  <button
                    onClick={() => {
                      if (!form.branch_name.trim()) { setError('Branch name is required'); return; }
                      if (!form.branch_code.trim()) { setError('Branch code is required'); return; }
                      setError('');
                      setFormStep(2);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                  >
                    Next Step <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={mode === 'edit' ? handleEdit : handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <><Loader2 size={14} className="animate-spin" /> Saving...</>
                    ) : (
                      <><Check size={14} /> {mode === 'edit' ? 'Save Changes' : 'Create Branch'}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
