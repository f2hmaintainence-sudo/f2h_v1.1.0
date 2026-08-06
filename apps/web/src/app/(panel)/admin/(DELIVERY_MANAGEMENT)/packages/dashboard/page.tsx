// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Containers & Balances — Containers Master & Customer Balances
//
// ============================================================================

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Home,
  RefreshCw,
  Search,
  Undo2,
  X,
  Container,
  Skull,
  Truck,
  Eye,
  Box,
  Layers,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Building,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/services/api.client';

type PendingRow = {
  customer_id: string;
  customer_name: string;
  phone: string;
  container_type_id: string;
  container_name: string;
  capacity: string;
  unit: string;
  issued_quantity: number;
  returned_quantity: number;
  damaged_quantity: number;
  lost_quantity: number;
  pending_count: number;
  updated_at: string;
  latest_order_id?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  latest_delivery_date?: string;
};

type AdjustState = {
  row: PendingRow;
  action: 'returned' | 'lost' | 'damaged';
  quantity: number;
  notes: string;
};

export default function ContainersPage() {
  const [activeMainTab, setActiveMainTab] = useState<'containers' | 'balances'>('containers');

  // Containers Master State
  const [containersMaster, setContainersMaster] = useState<any[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [containerSearch, setContainerSearch] = useState('');
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<any | null>(null);

  // Add/Edit Container Form State
  const [containerId, setContainerId] = useState('');
  const [containerName, setContainerName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [isReturnable, setIsReturnable] = useState(true);
  const [status, setStatus] = useState('active');
  const [savingContainer, setSavingContainer] = useState(false);
  const [containerFormError, setContainerFormError] = useState('');

  // Dynamic Warehouses List
  const [warehousesList, setWarehousesList] = useState<any[]>([]);

  // Customer Container Balances State
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedDetailRow, setSelectedDetailRow] = useState<PendingRow | null>(null);
  const [adjusting, setAdjusting] = useState<AdjustState | null>(null);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const limit = 20;
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Warehouses for Dynamic Dropdown
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get('/admin/warehouses/active/list');
      if (res.data && res.data.data) {
        setWarehousesList(res.data.data);
      } else {
        const tableRes = await api.get('/admin/warehouses/table');
        if (tableRes.data && tableRes.data.data) {
          setWarehousesList(tableRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch warehouses list:', err);
    }
  }, []);

  // Fetch Master Containers List
  const fetchMasterContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const res = await api.get('/admin/catalog/containers', {
        params: { search: containerSearch },
      });
      if (res.data) {
        const payload = (res.data as any).data || res.data;
        setContainersMaster(Array.isArray(payload) ? payload : []);
      }
    } catch (err) {
      console.error('Failed to fetch containers master:', err);
    } finally {
      setLoadingContainers(false);
    }
  }, [containerSearch]);

  // Fetch Package Dashboard Summary
  const fetchDashboardSummary = useCallback(async () => {
    try {
      const res = await api.get('/admin/package/dashboard');
      if (res.data?.data?.summary) {
        setDashboardSummary(res.data.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch package dashboard summary:', err);
    }
  }, []);

  // Fetch Customer Pending Balances
  const loadBalances = useCallback(async (s = search, p = page) => {
    setLoadingBalances(true);
    try {
      const res = await api.get('/admin/package/pending', {
        params: { search: s, page: p, limit },
      });
      const data = res.data || {};
      setRows(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setRows([]);
    } finally {
      setLoadingBalances(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchWarehouses();
    fetchMasterContainers();
    fetchDashboardSummary();
    loadBalances();
  }, [fetchDashboardSummary, fetchMasterContainers, fetchWarehouses, loadBalances]);

  const onSearchBalances = (v: string) => {
    setSearch(v);
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); loadBalances(v, 1); }, 400);
  };

  // Open Add Container Modal
  const openAddContainerModal = () => {
    setEditingContainer(null);
    setContainerId(`CONT-${Math.floor(1000 + Math.random() * 9000)}`);
    setContainerName('');
    setWarehouseId(warehousesList.length > 0 ? (warehousesList[0].warehouse_id || warehousesList[0].id) : '');
    setQuantity('100');
    setIsReturnable(true);
    setStatus('active');
    setContainerFormError('');
    setIsContainerModalOpen(true);
  };

  // Open Edit Container Modal
  const openEditContainerModal = (container: any) => {
    setEditingContainer(container);
    setContainerId(container.container_id);
    setContainerName(container.name);
    setWarehouseId(container.warehouse_id || '');
    setQuantity(String(container.quantity || 0));
    setIsReturnable(container.is_returnable ?? true);
    setStatus(container.status || 'active');
    setContainerFormError('');
    setIsContainerModalOpen(true);
  };

  // Handle Save Container (Add / Edit)
  const handleSaveContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setContainerFormError('');
    if (!containerName.trim() || !quantity) {
      setContainerFormError('Container name and valid quantity are required');
      return;
    }

    setSavingContainer(true);
    try {
      if (editingContainer) {
        await api.put(`/admin/catalog/containers/${editingContainer.id || editingContainer.container_id}`, {
          name: containerName,
          quantity: Number(quantity),
          warehouse_id: warehouseId || null,
          is_returnable: isReturnable,
          status,
        });
        showToast('Container updated successfully!', true);
      } else {
        await api.post('/admin/catalog/containers', {
          container_id: containerId,
          name: containerName,
          quantity: Number(quantity),
          warehouse_id: warehouseId || null,
          is_returnable: isReturnable,
          status,
        });
        showToast('Container created successfully!', true);
      }
      setIsContainerModalOpen(false);
      fetchMasterContainers();
    } catch (err: any) {
      console.error('Failed to save container:', err);
      const errMsg = err.response?.data?.message || 'Failed to save container';
      setContainerFormError(errMsg);
      showToast(errMsg, false);
    } finally {
      setSavingContainer(false);
    }
  };

  // Handle Adjust Container Balance
  const handleAdjust = async () => {
    if (!adjusting) return;
    setSavingAdjust(true);
    try {
      const res = await api.post('/admin/package/adjust', {
        customer_id: adjusting.row.customer_id,
        container_type_id: adjusting.row.container_type_id,
        action: adjusting.action,
        quantity: adjusting.quantity,
        notes: adjusting.notes,
      });
      const json = res.data || {};
      if (json.status === false) throw new Error(json.message);
      showToast(json.message || 'Adjusted successfully', true);
      setAdjusting(null);
      loadBalances();
      fetchMasterContainers();
      fetchDashboardSummary();
    } catch (e: any) {
      showToast(e.response?.data?.message || e.message || 'Failed to adjust', false);
    } finally {
      setSavingAdjust(false);
    }
  };

  const filteredMasterContainers = containersMaster.filter((item: any) => {
    if (!containerSearch.trim()) return true;
    const q = containerSearch.toLowerCase().trim();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.container_id || '').toLowerCase().includes(q) ||
      (item.warehouse_name || '').toLowerCase().includes(q)
    );
  });

  const totalWarehouseStock = containersMaster.reduce((acc, c) => acc + Number(c.quantity || 0), 0);
  const totalPages = Math.ceil(total / limit);

  const renderKpiCards = () => {
    const totalIssued = dashboardSummary?.issued_quantity ?? rows.reduce((acc, r) => acc + Number(r.issued_quantity || 0), 0);
    const totalReturned = dashboardSummary?.returned_quantity ?? rows.reduce((acc, r) => acc + Number(r.returned_quantity || 0), 0);
    const totalPending = dashboardSummary?.balance_quantity ?? rows.reduce((acc, r) => acc + Number(r.pending_count || 0), 0);
    const totalDamaged = dashboardSummary?.damaged_quantity ?? rows.reduce((acc, r) => acc + Number(r.damaged_quantity || 0), 0);
    const totalLost = dashboardSummary?.lost_quantity ?? rows.reduce((acc, r) => acc + Number(r.lost_quantity || 0), 0);
    const returnRate = totalIssued > 0 ? ((totalReturned / totalIssued) * 100).toFixed(1) : '100.0';

    return (
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider mb-1">Container Types</p>
          <p className="text-xl font-black text-purple-700">{containersMaster.length}</p>
          <p className="text-[10px] text-purple-600/70 mt-0.5">{totalWarehouseStock} Total Units</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Issued</p>
          <p className="text-xl font-black text-gray-900">{totalIssued}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Issued to customers</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Returned</p>
          <p className="text-xl font-black text-emerald-700">{totalReturned}</p>
          <p className="text-[10px] text-emerald-600/70 mt-0.5">Collected back</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Pending Return</p>
          <p className="text-xl font-black text-amber-700">{totalPending}</p>
          <p className="text-[10px] text-amber-600/70 mt-0.5">With customers</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-100 bg-rose-50/20 shadow-2xs">
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">Broken / Lost</p>
          <p className="text-xl font-black text-rose-700">{totalDamaged + totalLost}</p>
          <p className="text-[10px] text-rose-600/70 mt-0.5">Damaged: {totalDamaged} | Lost: {totalLost}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Return Rate</p>
          <p className="text-xl font-black text-blue-700">{returnRate}%</p>
          <p className="text-[10px] text-blue-600/70 mt-0.5">Efficiency rating</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-1 md:p-3 font-sans min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Page Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors">
            <Home size={14} /><span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Logistics</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">Containers & Balances</span>
        </nav>

        {activeMainTab === 'containers' ? (
          <button
            type="button"
            onClick={openAddContainerModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Container
          </button>
        ) : (
          <button
            type="button"
            onClick={() => loadBalances()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-deep-green text-sm font-bold rounded-xl shadow-sm hover:border-fresh-green transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loadingBalances ? 'animate-spin' : ''} /> Refresh Balances
          </button>
        )}
      </div>

      {/* Main 2-Tab Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 rounded-t-2xl">
        <button
          onClick={() => setActiveMainTab('containers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeMainTab === 'containers'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Box size={16} /> Containers
        </button>

        <button
          onClick={() => setActiveMainTab('balances')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeMainTab === 'balances'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Container size={16} /> Container Balances
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CONTAINERS MASTER TAB */}
      {/* ========================================================================= */}
      {activeMainTab === 'containers' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="relative max-w-sm w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search container by name, ID or warehouse…"
                value={containerSearch}
                onChange={(e) => setContainerSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
              />
              {containerSearch && (
                <button
                  type="button"
                  onClick={() => setContainerSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={fetchMasterContainers}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 border border-gray-200 text-xs font-bold text-emerald-800 rounded-xl hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={loadingContainers ? 'animate-spin text-emerald-600' : ''} /> Refresh List
            </button>
          </div>

          {/* Containers Data Table */}
          {loadingContainers ? (
            <div className="py-12 flex justify-center items-center">
              <div className="animate-spin w-7 h-7 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredMasterContainers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">
              <Box size={40} className="mx-auto mb-2 text-gray-300" />
              {containerSearch ? `No containers match "${containerSearch}"` : 'No container records found. Click "+ Add Container" to create one.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-emerald-50/50 text-emerald-950 uppercase font-extrabold tracking-wider border-b border-emerald-100">
                  <tr>
                    <th className="px-4 py-3.5">Container ID</th>
                    <th className="px-4 py-3.5">Name</th>
                    <th className="px-4 py-3.5">Warehouse</th>
                    <th className="px-4 py-3.5 text-right">Quantity</th>
                    <th className="px-4 py-3.5 text-center">Returnable</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMasterContainers.map((item: any) => (
                    <tr key={item.id || item.container_id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-800">{item.container_id}</td>
                      <td className="px-4 py-3.5 font-bold text-gray-900 text-sm">{item.name}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs">
                          <Building size={13} className="text-slate-500" />
                          {item.warehouse_name || 'Default Warehouse'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900 text-sm">
                        {Number(item.quantity || 0).toLocaleString()} units
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          item.is_returnable !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.is_returnable !== false ? <><CheckCircle size={12} /> Yes</> : <><XCircle size={12} /> Disposable</>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {item.status || 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => openEditContainerModal(item)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Container"
                        >
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CONTAINER BALANCES TAB */}
      {/* ========================================================================= */}
      {activeMainTab === 'balances' && (
        <div className="space-y-4">
          {renderKpiCards()}

          {/* Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
            <div className="relative w-full md:w-72 shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="Search customer name, phone, container…"
                value={search}
                onChange={(e) => onSearchBalances(e.target.value)}
              />
              {search && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => onSearchBalances('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto shrink">
              <button
                onClick={() => setSelectedType('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedType === 'All'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Types ({containersMaster.length})
              </button>
              {containersMaster.slice(0, 4).map((c) => {
                const val = c.container_id || c.name;
                const isSelected = selectedType === val;
                return (
                  <button
                    key={c.container_id || c.id}
                    onClick={() => setSelectedType(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c.name} ({Number(c.quantity || 0)})
                  </button>
                );
              })}

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shrink-0 max-w-[200px]"
              >
                <option value="All">📦 Filter Container ({containersMaster.length})</option>
                {containersMaster.map((c) => {
                  const val = c.container_id || c.name;
                  return (
                    <option key={c.container_id || c.id} value={val}>
                      {c.name} ({c.quantity || 0} units)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Balances Data Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold">Container</th>
                    <th className="text-center px-4 py-3 font-semibold">Issued</th>
                    <th className="text-center px-4 py-3 font-semibold">Returned</th>
                    <th className="text-center px-4 py-3 font-semibold">
                      <span className="text-amber-600">⏳ Pending</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingBalances && (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                  {!loadingBalances && rows
                    .filter(r => {
                      if (selectedType === 'All') return true;
                      const target = selectedType.toLowerCase();
                      return (
                        (r.container_type_id || '').toLowerCase() === target ||
                        (r.container_name || '').toLowerCase().includes(target)
                      );
                    })
                    .map((row) => (
                    <tr key={`${row.customer_id}_${row.container_type_id}`} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-4 py-3 align-middle">
                        <div className="font-bold text-slate-900">{row.customer_name || `Customer #${row.customer_id}`}</div>
                        <div className="text-xs text-slate-400 font-medium">{row.phone} · <span className="font-mono text-[10px] text-slate-400">{row.customer_id}</span></div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="font-bold text-slate-800">{row.container_name}</div>
                        {row.capacity && (
                          <div className="text-xs text-slate-400 font-medium">{row.capacity} {row.unit}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-bold align-middle">{row.issued_quantity}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-bold align-middle">{row.returned_quantity}</td>
                      <td className="px-4 py-3 text-center align-middle">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-black text-base">
                          {row.pending_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <button
                          onClick={() => setSelectedDetailRow(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="View order & container details"
                        >
                          <Eye size={14} className="text-slate-600" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loadingBalances && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-300" />
                        <p className="font-semibold text-gray-500">All clear! No pending returns.</p>
                        <p className="text-xs text-gray-400 mt-1">Containers are automatically tracked from delivered orders.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-800">{total > 0 ? (page - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(page * limit, total)}</strong> of <strong className="text-slate-800">{total}</strong> container balances
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loadingBalances}
                  onClick={() => { const p = page - 1; setPage(p); loadBalances(search, p); }}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <button
                  disabled={page >= totalPages || loadingBalances}
                  onClick={() => { const p = page + 1; setPage(p); loadBalances(search, p); }}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CONTAINER MODAL (WITH WAREHOUSE SELECT & QUANTITY) */}
      {/* ========================================================================= */}
      {isContainerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveContainer}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Box size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingContainer ? 'Edit Container' : 'Add New Container'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsContainerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {containerFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {containerFormError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Container ID
              </label>
              <input
                type="text"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                disabled={Boolean(editingContainer)}
                placeholder="e.g. CONT-001"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Container Name
              </label>
              <input
                type="text"
                value={containerName}
                onChange={(e) => setContainerName(e.target.value)}
                placeholder="e.g. Glass Bottle 1L, Plastic Bucket 5L"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            {/* Dynamic Warehouse Select Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Warehouse
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="">-- Select Warehouse --</option>
                {warehousesList.map((w: any) => (
                  <option key={w.id || w.warehouse_id} value={w.warehouse_id || w.id}>
                    {w.name} ({w.warehouse_id || 'ID: ' + w.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Simplified Quantity Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter container quantity"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Returnable Container</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReturnable}
                  onChange={(e) => setIsReturnable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-bold text-slate-700">Status Active</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsContainerModalOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingContainer}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {savingContainer ? 'Saving...' : editingContainer ? 'Update Container' : 'Create Container'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER CONTAINER BALANCE DETAILS */}
      {/* ========================================================================= */}
      {selectedDetailRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Container size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Container & Order Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Customer Container Balance Record</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Customer Profile</p>
              <p className="text-sm font-extrabold text-slate-900">{selectedDetailRow.customer_name}</p>
              <p className="text-xs text-slate-500 font-medium">
                Phone: <span className="font-bold text-slate-700">{selectedDetailRow.phone}</span> • ID: <span className="font-mono text-slate-600">{selectedDetailRow.customer_id}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Container Name</p>
                <p className="text-sm font-bold text-slate-900">{selectedDetailRow.container_name}</p>
                <p className="text-[11px] text-slate-500 font-medium">{selectedDetailRow.container_type_id}</p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Current Balance Status</p>
                <p className="text-sm font-black text-amber-700">{selectedDetailRow.pending_count} Pending Return</p>
                <p className="text-[11px] text-slate-500 font-medium">{selectedDetailRow.issued_quantity} Issued • {selectedDetailRow.returned_quantity} Returned</p>
              </div>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 space-y-2.5">
              <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-emerald-600" /> Issued Order & Delivery Partner
              </p>

              {selectedDetailRow.latest_order_id ? (
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Issued Order ID:</span>
                    <span className="bg-white text-emerald-900 border border-emerald-300 font-extrabold px-2 py-0.5 rounded text-xs shadow-2xs">
                      #{selectedDetailRow.latest_order_id}
                    </span>
                  </div>
                  {selectedDetailRow.delivery_partner_name ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Delivered By Agent:</span>
                      <span className="font-bold text-emerald-800">
                        {selectedDetailRow.delivery_partner_name}
                        {selectedDetailRow.delivery_partner_phone && (
                          <span className="text-slate-500 font-normal ml-1">({selectedDetailRow.delivery_partner_phone})</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic">No delivery partner assigned</div>
                  )}
                  {selectedDetailRow.latest_delivery_date && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Delivery Timestamp:</span>
                      <span className="font-medium text-slate-800">
                        {new Date(selectedDetailRow.latest_delivery_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No order details linked to this container</p>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedDetailRow(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADJUST CONTAINER RETURN */}
      {/* ========================================================================= */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Adjust Container Return</h2>
              <button onClick={() => setAdjusting(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                <div className="font-semibold text-gray-800">{adjusting.row.customer_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {adjusting.row.phone} · {adjusting.row.container_name} · {adjusting.row.pending_count} pending
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['returned', 'damaged', 'lost'] as const).map((a) => {
                    const icons = { returned: <Undo2 size={14} />, damaged: <AlertTriangle size={14} />, lost: <Skull size={14} /> };
                    const colors = {
                      returned: 'border-emerald-300 bg-emerald-50 text-emerald-700',
                      damaged: 'border-orange-300 bg-orange-50 text-orange-700',
                      lost: 'border-rose-300 bg-rose-50 text-rose-700',
                    };
                    return (
                      <button key={a} onClick={() => setAdjusting(s => s ? { ...s, action: a } : s)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold capitalize transition-all ${adjusting.action === a ? colors[a] : 'border-gray-200 text-gray-400 hover:border-gray-300'
                          }`}>
                        {icons[a]}{a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={adjusting.row.pending_count}
                  value={adjusting.quantity}
                  onChange={(e) => setAdjusting(s => s ? { ...s, quantity: Math.max(1, parseInt(e.target.value) || 1) } : s)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fresh-green/30 focus:border-fresh-green"
                />
                <p className="text-xs text-gray-400 mt-1">Max: {adjusting.row.pending_count} pending</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={adjusting.notes}
                  placeholder="e.g. Collected during morning visit"
                  onChange={(e) => setAdjusting(s => s ? { ...s, notes: e.target.value } : s)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fresh-green/30 focus:border-fresh-green"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setAdjusting(null)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdjust} disabled={savingAdjust}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-fresh-green rounded-xl hover:bg-deep-green transition-colors disabled:opacity-60">
                {savingAdjust ? 'Saving…' : `Mark ${adjusting.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

