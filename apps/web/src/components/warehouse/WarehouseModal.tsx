'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Warehouse as WarehouseIcon,
  Building,
  X,
  MapPin,
  Sparkles,
  AlertCircle,
  Check,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Save,
  Thermometer,
  Layers,
  User,
  Phone,
  Mail,
  HardDrive
} from 'lucide-react';
import { api as apiClient } from '@/services/api.client';
import { WarehouseItem } from './WarehouseCard';

const MapPicker = dynamic(() => import('@/components/shared/MapPicker'), { ssr: false });

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  warehouse?: WarehouseItem | null;
}

export interface WarehouseFormData {
  name: string;
  code: string;
  warehouse_type: string;
  branch_id: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  manager_name: string;
  manager_phone: string;
  manager_email: string;
  capacity: number | string;
  capacity_unit: string;
  temperature_type: string;
  is_active: boolean;
  notes: string;
}

const DEFAULT_FORM: WarehouseFormData = {
  name: '',
  code: '',
  warehouse_type: 'main',
  branch_id: '',
  address_line_1: '',
  address_line_2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  country: 'India',
  pincode: '',
  latitude: 12.9716,
  longitude: 77.5946,
  manager_name: '',
  manager_phone: '',
  manager_email: '',
  capacity: '',
  capacity_unit: 'ltr',
  temperature_type: 'ambient',
  is_active: true,
  notes: '',
};

export default function WarehouseModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  warehouse,
}: WarehouseModalProps) {
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<WarehouseFormData>(DEFAULT_FORM);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch branch options
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await apiClient.get<any>('/admin/branch/table?limit=100');
        const rows = res.data?.data || res.data?.rows || res.data || [];
        if (Array.isArray(rows)) {
          setBranches(rows);
        }
      } catch (err) {
        console.error('Failed to load branches for warehouse modal:', err);
      }
    }
    if (isOpen) {
      fetchBranches();
    }
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (isOpen) {
      setError('');
      setFormStep(1);
      if (mode === 'edit' && warehouse) {
        setLoading(true);
        // Also fetch fresh details from API if available
        apiClient.get<any>(`/admin/warehouses/${warehouse.id}/showEdit`)
          .then((res) => {
            const row = res.data?.data || warehouse;
            setForm({
              name: row.name || warehouse.name || '',
              code: row.code || warehouse.code || '',
              warehouse_type: row.warehouse_type || warehouse.warehouse_type || 'main',
              branch_id: row.branch_id || warehouse.branch_id || '',
              address_line_1: row.address_line_1 || '',
              address_line_2: row.address_line_2 || '',
              city: row.city || warehouse.city || 'Bengaluru',
              state: row.state || warehouse.state || 'Karnataka',
              country: row.country || 'India',
              pincode: row.pincode || '',
              latitude: row.latitude ? parseFloat(row.latitude) : (warehouse.latitude ? parseFloat(String(warehouse.latitude)) : 12.9716),
              longitude: row.longitude ? parseFloat(row.longitude) : (warehouse.longitude ? parseFloat(String(warehouse.longitude)) : 77.5946),
              manager_name: row.manager_name || warehouse.manager_name || '',
              manager_phone: row.manager_phone || warehouse.manager_phone || '',
              manager_email: row.manager_email || '',
              capacity: row.capacity || warehouse.capacity || '',
              capacity_unit: row.capacity_unit || warehouse.capacity_unit || 'ltr',
              temperature_type: row.temperature_type || warehouse.temperature_type || 'ambient',
              is_active: row.is_active !== undefined ? (row.is_active === true || row.is_active === 1 || row.is_active === 'true') : true,
              notes: row.notes || '',
            });
          })
          .catch(() => {
            setForm({
              name: warehouse.name || '',
              code: warehouse.code || '',
              warehouse_type: warehouse.warehouse_type || 'main',
              branch_id: warehouse.branch_id || '',
              address_line_1: warehouse.address_line_1 || '',
              address_line_2: warehouse.address_line_2 || '',
              city: warehouse.city || 'Bengaluru',
              state: warehouse.state || 'Karnataka',
              country: warehouse.country || 'India',
              pincode: warehouse.pincode || '',
              latitude: warehouse.latitude ? parseFloat(String(warehouse.latitude)) : 12.9716,
              longitude: warehouse.longitude ? parseFloat(String(warehouse.longitude)) : 77.5946,
              manager_name: warehouse.manager_name || '',
              manager_phone: warehouse.manager_phone || '',
              manager_email: warehouse.manager_email || '',
              capacity: warehouse.capacity || '',
              capacity_unit: warehouse.capacity_unit || 'ltr',
              temperature_type: warehouse.temperature_type || 'ambient',
              is_active: warehouse.is_active !== undefined ? (warehouse.is_active === true || warehouse.is_active === 1 || warehouse.is_active === 'true') : true,
              notes: warehouse.notes || '',
            });
          })
          .finally(() => setLoading(false));
      } else {
        setForm(DEFAULT_FORM);
      }
    }
  }, [isOpen, mode, warehouse]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('Warehouse Name is required');
      setFormStep(1);
      return;
    }
    if (!form.code.trim()) {
      setError('Warehouse Code is required');
      setFormStep(1);
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...form,
        latitude: form.latitude !== null ? Number(form.latitude) : null,
        longitude: form.longitude !== null ? Number(form.longitude) : null,
        capacity: form.capacity !== '' ? Number(form.capacity) : null,
      };

      let res;
      if (mode === 'edit' && warehouse) {
        res = await apiClient.post<any>(`/admin/warehouses/${warehouse.id}/saveEdit`, payload);
      } else {
        res = await apiClient.post<any>('/admin/warehouses/saveAdd', payload);
      }

      if (res.error || (res as any)?.status === false) {
        setError(res.error || (res as any)?.message || 'Failed to save warehouse');
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!saving) onClose();
        }}
      />

      {/* Modal Box */}
      <div className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100 shadow-xs">
              <WarehouseIcon size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'edit' ? `Edit Warehouse: ${warehouse?.name || ''}` : 'Create New Warehouse'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure warehouse properties, storage specs, and pin Google Map location.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!saving) onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper / Tab Bar */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 select-none bg-slate-50/40">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                formStep === 1
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>General & Operations</span>
            </button>

            <div className="w-6 h-0.5 bg-slate-200" />

            <button
              type="button"
              onClick={() => setFormStep(2)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                formStep === 2
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <MapPin size={13} />
              <span>Location & Google Map</span>
            </button>
          </div>

          {form.latitude && form.longitude ? (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
              <MapPin size={12} className="text-emerald-600" />
              <span>{Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}</span>
            </div>
          ) : null}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading warehouse configuration...</p>
            </div>
          ) : formStep === 1 ? (
            /* STEP 1: General & Operational Details */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Row 1: Name and Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800 placeholder:text-slate-300"
                    placeholder="e.g. Central Bangalore Hub"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Warehouse Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800 placeholder:text-slate-300"
                    placeholder="e.g. WH-BLR-01"
                  />
                </div>
              </div>

              {/* Row 2: Type and Linked Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Warehouse Type
                  </label>
                  <select
                    value={form.warehouse_type}
                    onChange={(e) => setForm((f) => ({ ...f, warehouse_type: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800"
                  >
                    <option value="main">Main Warehouse</option>
                    <option value="hub">Distribution Hub / Fulfillment Center</option>
                    <option value="cold_storage">Cold Storage Facility</option>
                    <option value="processing">Processing & Packaging Unit</option>
                    <option value="spoke">Transit / Spoke Node</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Linked Branch
                  </label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800"
                  >
                    <option value="">-- Unassigned / Central --</option>
                    {branches.map((b: any) => (
                      <option key={b.branch_id || b.id} value={b.branch_id || b.id}>
                        {b.branch_name || b.name} ({b.branch_code || b.code || 'Hub'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Storage Capacity & Temperature Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Storage Capacity
                  </label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800 placeholder:text-slate-300"
                    placeholder="e.g. 50000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Capacity Unit
                  </label>
                  <select
                    value={form.capacity_unit}
                    onChange={(e) => setForm((f) => ({ ...f, capacity_unit: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800"
                  >
                    <option value="ltr">Liters (ltr)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="units">Units / Bottles</option>
                    <option value="crates">Crates</option>
                    <option value="cbm">Cubic Meters (cbm)</option>
                    <option value="pallets">Pallets</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Temperature Zone
                  </label>
                  <select
                    value={form.temperature_type}
                    onChange={(e) => setForm((f) => ({ ...f, temperature_type: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800"
                  >
                    <option value="ambient">Ambient (20-25°C)</option>
                    <option value="cool">Cool (10-15°C)</option>
                    <option value="chilled">Chilled (2-8°C)</option>
                    <option value="frozen">Frozen (-18°C)</option>
                    <option value="variable">Multi-Temperature</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Manager Contacts */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <User size={14} className="text-emerald-600" />
                  <span>Warehouse In-Charge / Manager Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    value={form.manager_name}
                    onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="Manager Name"
                  />
                  <input
                    value={form.manager_phone}
                    onChange={(e) => setForm((f) => ({ ...f, manager_phone: e.target.value }))}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="Manager Phone"
                  />
                  <input
                    type="email"
                    value={form.manager_email}
                    onChange={(e) => setForm((f) => ({ ...f, manager_email: e.target.value }))}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="Manager Email"
                  />
                </div>
              </div>

              {/* Row 5: Active Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Operational Active Status</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Allow inventory movements and allocations.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Notes / Remarks
                  </label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Loading dock 3 is reserved for morning dairy intake"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Location & Google Map Pinning */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Address inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Address Line 1
                  </label>
                  <input
                    value={form.address_line_1}
                    onChange={(e) => setForm((f) => ({ ...f, address_line_1: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="Plot / Street / Building No."
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Address Line 2 (Area / Landmark)
                  </label>
                  <input
                    value={form.address_line_2}
                    onChange={(e) => setForm((f) => ({ ...f, address_line_2: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="Landmark or Industrial Area"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">City</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Bengaluru"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</label>
                  <input
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Karnataka"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pincode</label>
                  <input
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="e.g. 560066"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Country</label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    placeholder="India"
                  />
                </div>
              </div>

              {/* Google Map Pin Picker */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin size={14} className="text-emerald-600" />
                    Google Map Pin Location (Click anywhere or drag marker to set warehouse position)
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative h-[380px]">
                  <MapPicker
                    lat={form.latitude}
                    lng={form.longitude}
                    radiusKm={3}
                    onLocationChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div>
            {error && (
              <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 text-xs font-medium">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {formStep === 2 ? (
              <button
                type="button"
                onClick={() => setFormStep(1)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft size={14} /> Back to Details
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFormStep(2)}
                className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Pin on Google Map</span> <ChevronRight size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Saving...' : mode === 'edit' ? 'Update Warehouse' : 'Create Warehouse'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
