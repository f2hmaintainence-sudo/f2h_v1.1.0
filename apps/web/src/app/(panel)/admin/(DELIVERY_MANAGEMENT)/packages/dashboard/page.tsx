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
  RotateCcw,
  ShieldAlert,
  ClipboardCheck,
  ArrowDownToLine,
  CheckCheck,
  Calendar,
  Phone,
  User,
  Filter,
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
  const [activeMainTab, setActiveMainTab] = useState<'containers' | 'balances' | 'recollections'>('containers');

  // Containers Master State
  const [containersMaster, setContainersMaster] = useState<any[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [containerSearch, setContainerSearch] = useState('');
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<any | null>(null);

  // Add/Edit Container Form State
  const [containerId, setContainerId] = useState('');
  const [containerName, setContainerName] = useState('');
  const [warehouseQuantities, setWarehouseQuantities] = useState<Record<string, string | number>>({});
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

  // Warehouse Container Recollections State
  const [recollectionsList, setRecollectionsList] = useState<any[]>([]);
  const [recollectionsSummary, setRecollectionsSummary] = useState<any>(null);
  const [recollectionsTotal, setRecollectionsTotal] = useState(0);
  const [loadingRecollections, setLoadingRecollections] = useState(false);
  const [recollectionSearch, setRecollectionSearch] = useState('');
  const [recollectionWarehouseId, setRecollectionWarehouseId] = useState('all');
  const [recollectionStatus, setRecollectionStatus] = useState('all');
  const [recollectionDate, setRecollectionDate] = useState('');
  const [recollectionPage, setRecollectionPage] = useState(1);
  const [selectedRecollectionDetail, setSelectedRecollectionDetail] = useState<any | null>(null);

  // Verification Modal State
  const [verifyingRecollection, setVerifyingRecollection] = useState<any | null>(null);
  const [verifyAcceptedQty, setVerifyAcceptedQty] = useState<string>('0');
  const [verifyDamagedQty, setVerifyDamagedQty] = useState<string>('0');
  const [verifyLostQty, setVerifyLostQty] = useState<string>('0');
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [submittingVerify, setSubmittingVerify] = useState<boolean>(false);

  // Direct Intake Modal State
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directWarehouseId, setDirectWarehouseId] = useState('');
  const [directContainerId, setDirectContainerId] = useState('');
  const [directRunId, setDirectRunId] = useState('');
  const [directPartnerId, setDirectPartnerId] = useState('');
  const [directCustomerId, setDirectCustomerId] = useState('');
  const [directQuantity, setDirectQuantity] = useState('10');
  const [directDamagedQuantity, setDirectDamagedQuantity] = useState('0');
  const [directLostQuantity, setDirectLostQuantity] = useState('0');
  const [directNotes, setDirectNotes] = useState('');
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [directFormError, setDirectFormError] = useState('');
  const [pendingRuns, setPendingRuns] = useState<any[]>([]);

  const limit = 20;
  const searchRef = useRef<NodeJS.Timeout | null>(null);
  const recSearchRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Warehouses for Dynamic Dropdown
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get<any>('/admin/warehouses/active/list');
      if (res.data && res.data.data) {
        setWarehousesList(res.data.data);
      } else {
        const tableRes = await api.get<any>('/admin/warehouses/table');
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
      const res = await api.get<any>('/admin/package/dashboard');
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
      const res = await api.get<any>('/admin/package/pending', {
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

  // Fetch Warehouse Container Recollections
  const fetchRecollections = useCallback(async (p = recollectionPage) => {
    setLoadingRecollections(true);
    try {
      const res = await api.get<any>('/admin/package/recollections', {
        params: {
          warehouse_id: recollectionWarehouseId !== 'all' ? recollectionWarehouseId : undefined,
          status: recollectionStatus !== 'all' ? recollectionStatus : undefined,
          search: recollectionSearch.trim() || undefined,
          date: recollectionDate || undefined,
          page: p,
          limit,
        },
      });
      if (res.data) {
        setRecollectionsList(res.data.data || []);
        setRecollectionsTotal(res.data.total || 0);
        if (res.data.summary) {
          setRecollectionsSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load container recollections:', err);
      setRecollectionsList([]);
    } finally {
      setLoadingRecollections(false);
    }
  }, [recollectionWarehouseId, recollectionStatus, recollectionSearch, recollectionDate, recollectionPage]);

  // Fetch Pending Delivery Runs for Intake
  const fetchPendingRuns = useCallback(async (whId = '') => {
    try {
      const res = await api.get<any>('/admin/package/recollections/runs-pending', {
        params: {
          warehouse_id: whId || undefined,
        },
      });
      if (res.data?.data) {
        setPendingRuns(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load pending runs:', err);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
    fetchMasterContainers();
    fetchDashboardSummary();
    loadBalances();
    fetchRecollections();
  }, [fetchDashboardSummary, fetchMasterContainers, fetchWarehouses, loadBalances, fetchRecollections]);

  const onSearchBalances = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); loadBalances(v, 1); }, 400);
  };

  // Open Add Container Modal
  const openAddContainerModal = () => {
    setEditingContainer(null);
    setContainerId(`CONT-${Math.floor(1000 + Math.random() * 9000)}`);
    setContainerName('');
    const initialQuantities: Record<string, number> = {};
    for (const w of warehousesList) {
      const wId = w.warehouse_id || w.id;
      initialQuantities[wId] = 0;
    }
    setWarehouseQuantities(initialQuantities);
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
    const initialQuantities: Record<string, number> = {};
    for (const w of warehousesList) {
      const wId = w.warehouse_id || w.id;
      const found = (container.warehouses || []).find((sw: any) => sw.warehouse_id === wId);
      initialQuantities[wId] = found ? Number(found.quantity || 0) : 0;
    }
    setWarehouseQuantities(initialQuantities);
    setIsReturnable(container.is_returnable ?? true);
    setStatus(container.status || 'active');
    setContainerFormError('');
    setIsContainerModalOpen(true);
  };

  // Handle Save Container (Add / Edit)
  const handleSaveContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setContainerFormError('');
    if (!containerName.trim()) {
      setContainerFormError('Container Type name is required');
      return;
    }

    const warehouse_quantities = Object.entries(warehouseQuantities).map(([wId, q]) => ({
      warehouse_id: wId,
      quantity: Math.max(0, Number(q) || 0),
    }));
    const totalAllocated = warehouse_quantities.reduce((acc, curr) => acc + curr.quantity, 0);

    setSavingContainer(true);
    try {
      if (editingContainer) {
        await api.put(`/admin/catalog/containers/${editingContainer.id || editingContainer.container_id}`, {
          name: containerName,
          warehouse_quantities,
          quantity: totalAllocated,
          is_returnable: isReturnable,
          status,
        });
        showToast('Container Type updated successfully!', true);
      } else {
        await api.post('/admin/catalog/containers', {
          container_id: containerId,
          name: containerName,
          warehouse_quantities,
          quantity: totalAllocated,
          is_returnable: isReturnable,
          status,
        });
        showToast('Container Type created successfully!', true);
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
      const res = await api.post<any>('/admin/package/adjust', {
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

  // Recollection Handlers
  const onSearchRecollections = (v: string) => {
    setRecollectionSearch(v);
    if (recSearchRef.current) clearTimeout(recSearchRef.current);
    recSearchRef.current = setTimeout(() => {
      setRecollectionPage(1);
      fetchRecollections(1);
    }, 400);
  };

  const openVerifyModal = (rec: any) => {
    setVerifyingRecollection(rec);
    const defaultAccepted = rec.submitted_quantity > 0 ? rec.submitted_quantity : (rec.collected_quantity || 0);
    setVerifyAcceptedQty(String(defaultAccepted));
    setVerifyDamagedQty(String(rec.damaged_quantity || 0));
    setVerifyLostQty(String(rec.lost_quantity || 0));
    setVerifyNotes(rec.submission_notes || '');
  };

  const handleConfirmVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingRecollection) return;
    setSubmittingVerify(true);
    try {
      const res = await api.post<any>('/admin/package/recollections/verify', {
        id: verifyingRecollection.id,
        submitted_quantity: Number(verifyAcceptedQty),
        damaged_quantity: Number(verifyDamagedQty) || 0,
        lost_quantity: Number(verifyLostQty) || 0,
        notes: verifyNotes || undefined,
      });
      showToast(res.data?.message || 'Recollection verified and warehouse stock updated!', true);
      setVerifyingRecollection(null);
      fetchRecollections();
      fetchMasterContainers();
      fetchDashboardSummary();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to verify recollection', false);
    } finally {
      setSubmittingVerify(false);
    }
  };

  const openDirectModal = () => {
    setDirectWarehouseId(warehousesList.length > 0 ? (warehousesList[0].warehouse_id || warehousesList[0].id) : '');
    setDirectContainerId(containersMaster.length > 0 ? containersMaster[0].container_id : '');
    setDirectQuantity('10');
    setDirectDamagedQuantity('0');
    setDirectLostQuantity('0');
    setDirectRunId('');
    setDirectPartnerId('');
    setDirectCustomerId('');
    setDirectNotes('');
    setDirectFormError('');
    fetchPendingRuns(warehousesList.length > 0 ? (warehousesList[0].warehouse_id || warehousesList[0].id) : '');
    setIsDirectModalOpen(true);
  };

  const handleSaveDirectRecollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectFormError('');
    if (!directContainerId) {
      setDirectFormError('Please select a container type');
      return;
    }
    if (!directQuantity || Number(directQuantity) <= 0) {
      setDirectFormError('Please enter a valid received quantity');
      return;
    }
    setSubmittingDirect(true);
    try {
      const res = await api.post<any>('/admin/package/recollections/direct', {
        warehouse_id: directWarehouseId || undefined,
        container_id: directContainerId,
        delivery_partner_id: directPartnerId || undefined,
        run_id: directRunId || undefined,
        customer_id: directCustomerId || undefined,
        quantity: Number(directQuantity),
        damaged_quantity: Number(directDamagedQuantity) || 0,
        lost_quantity: Number(directLostQuantity) || 0,
        notes: directNotes || undefined,
      });
      showToast(res.data?.message || 'Direct intake recorded and inventory restocked!', true);
      setIsDirectModalOpen(false);
      fetchRecollections();
      fetchMasterContainers();
      fetchDashboardSummary();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to record direct container recollection';
      setDirectFormError(msg);
      showToast(msg, false);
    } finally {
      setSubmittingDirect(false);
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
  const totalRecollectionPages = Math.ceil(recollectionsTotal / limit);

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

  const renderRecollectionKpiCards = () => {
    const totalRecs = recollectionsSummary?.total_records ?? 0;
    const pendingVer = recollectionsSummary?.pending_verification ?? 0;
    const closedVer = recollectionsSummary?.closed_count ?? 0;
    const totalAccepted = recollectionsSummary?.total_accepted_units ?? 0;
    const totalDamaged = recollectionsSummary?.total_damaged_units ?? 0;
    const totalLost = recollectionsSummary?.total_lost_units ?? 0;
    const discrepancies = recollectionsSummary?.discrepancy_count ?? 0;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Recollections Logged</p>
          <p className="text-xl font-black text-slate-900">{totalRecs}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Intake batches</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Awaiting Verification</p>
          <p className="text-xl font-black text-amber-800 flex items-center gap-1.5">
            {pendingVer}
            {pendingVer > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
          </p>
          <p className="text-[10px] text-amber-600 mt-0.5">Submitted by riders</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
          <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">Verified & Restocked</p>
          <p className="text-xl font-black text-emerald-800">{closedVer}</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">+{totalAccepted} Units Restocked</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-100 bg-rose-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider mb-1">Damaged on Return</p>
          <p className="text-xl font-black text-rose-700">{totalDamaged}</p>
          <p className="text-[10px] text-rose-600/70 mt-0.5">Broken bottles / crates</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider mb-1">Lost / Missing</p>
          <p className="text-xl font-black text-purple-700">{totalLost}</p>
          <p className="text-[10px] text-purple-600/70 mt-0.5">Unaccounted units</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider mb-1">Discrepancies</p>
          <p className="text-xl font-black text-indigo-700">{discrepancies}</p>
          <p className="text-[10px] text-indigo-600/70 mt-0.5">Mismatched counts</p>
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
        ) : activeMainTab === 'balances' ? (
          <button
            type="button"
            onClick={() => loadBalances()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-deep-green text-sm font-bold rounded-xl shadow-sm hover:border-fresh-green transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loadingBalances ? 'animate-spin' : ''} /> Refresh Balances
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openDirectModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <Plus size={16} /> Direct Intake
            </button>
            <button
              type="button"
              onClick={() => fetchRecollections()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-deep-green text-sm font-bold rounded-xl shadow-sm hover:border-fresh-green transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={loadingRecollections ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        )}
      </div>

      {/* Main 3-Tab Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 rounded-t-2xl overflow-x-auto">
        <button
          onClick={() => setActiveMainTab('containers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === 'containers'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Box size={16} /> Containers
        </button>

        <button
          onClick={() => setActiveMainTab('balances')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === 'balances'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Container size={16} /> Container Balances
        </button>

        <button
          onClick={() => setActiveMainTab('recollections')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeMainTab === 'recollections'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <RotateCcw size={16} /> Warehouse Recollection
          {(recollectionsSummary?.pending_verification || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {recollectionsSummary.pending_verification}
            </span>
          )}
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
                    <th className="px-4 py-3.5">Container Type Name</th>
                    <th className="px-4 py-3.5 text-center">Total Stock</th>
                    <th className="px-4 py-3.5">Warehouse Allocation</th>
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
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-xs rounded-lg shadow-2xs">
                          <Box size={13} className="text-emerald-600" />
                          {Number(item.quantity || 0).toLocaleString()} units
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                          {Array.isArray(item.warehouses) && item.warehouses.length > 0 ? (
                            item.warehouses.map((wh: any) => (
                              <span
                                key={wh.warehouse_id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                  wh.quantity > 0
                                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                                    : 'bg-gray-50 border-gray-100 text-gray-400'
                                }`}
                              >
                                <Building size={11} className={wh.quantity > 0 ? 'text-emerald-600' : 'text-gray-300'} />
                                <span>{wh.warehouse_name || wh.warehouse_code || wh.warehouse_id}:</span>
                                <strong className={wh.quantity > 0 ? 'text-slate-900 font-black' : 'text-gray-400'}>
                                  {wh.quantity}
                                </strong>
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">No warehouse stock</span>
                          )}
                        </div>
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          title="Edit Container Type"
                        >
                          <Edit2 size={13} /> Edit
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
      {/* TAB 3: WAREHOUSE CONTAINER RECOLLECTIONS TAB */}
      {/* ========================================================================= */}
      {activeMainTab === 'recollections' && (
        <div className="space-y-4">
          {/* Recollection KPI Cards */}
          {renderRecollectionKpiCards()}

          {/* Controls & Filter Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative max-w-sm w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Run ID, Partner, Container..."
                  value={recollectionSearch}
                  onChange={(e) => onSearchRecollections(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                />
                {recollectionSearch && (
                  <button
                    type="button"
                    onClick={() => { setRecollectionSearch(''); setRecollectionPage(1); fetchRecollections(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filters & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Warehouse Dropdown */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                  <Building size={14} className="text-gray-400 shrink-0" />
                  <select
                    value={recollectionWarehouseId}
                    onChange={(e) => {
                      setRecollectionWarehouseId(e.target.value);
                      setRecollectionPage(1);
                    }}
                    className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Warehouses</option>
                    {warehousesList.map((w: any) => (
                      <option key={w.id || w.warehouse_id} value={w.warehouse_id || w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Picker Filter */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={recollectionDate}
                    onChange={(e) => {
                      setRecollectionDate(e.target.value);
                      setRecollectionPage(1);
                    }}
                    className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
                  />
                  {recollectionDate && (
                    <button
                      onClick={() => { setRecollectionDate(''); setRecollectionPage(1); }}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Direct Intake Action */}
                <button
                  type="button"
                  onClick={openDirectModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Log Direct Intake
                </button>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 overflow-x-auto">
              {[
                { id: 'all', label: 'All Records', count: recollectionsSummary?.total_records },
                { id: 'submitted', label: 'Awaiting Verification', count: recollectionsSummary?.pending_verification, badgeColor: 'bg-amber-500 text-white' },
                { id: 'closed', label: 'Verified & Restocked', count: recollectionsSummary?.closed_count, badgeColor: 'bg-emerald-600 text-white' },
                { id: 'discrepancy', label: 'Discrepancies', count: recollectionsSummary?.discrepancy_count, badgeColor: 'bg-rose-500 text-white' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setRecollectionStatus(st.id);
                    setRecollectionPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    recollectionStatus === st.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {st.label}
                  {st.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${st.badgeColor || (recollectionStatus === st.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700')}`}>
                      {st.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Recollections Data Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Run / Batch ID</th>
                    <th className="px-4 py-3.5">Warehouse</th>
                    <th className="px-4 py-3.5">Delivery Partner / Source</th>
                    <th className="px-4 py-3.5">Container Type</th>
                    <th className="px-4 py-3.5 text-center">Collected</th>
                    <th className="px-4 py-3.5 text-center">Accepted</th>
                    <th className="px-4 py-3.5 text-center">Damaged / Lost</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5">Verified By</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {loadingRecollections ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : recollectionsList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <RotateCcw size={36} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-slate-600 text-sm">No container recollection records found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          When delivery partners complete their runs or submit returns, they will appear here for hub verification.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    recollectionsList.map((row) => {
                      const isPending = row.status === 'submitted' || row.status === 'pending';
                      const isDiscrepancy = row.status === 'discrepancy';
                      const isClosed = row.status === 'closed';

                      return (
                        <tr key={row.id} className={`hover:bg-slate-50/60 transition-colors ${isPending ? 'bg-amber-50/20' : ''}`}>
                          <td className="px-4 py-3.5 align-middle">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] w-fit">
                                {row.run_id}
                              </span>
                              {row.run_date && (
                                <span className="text-[10px] text-slate-500">
                                  {new Date(row.run_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  {row.delivery_slot ? ` · ${row.delivery_slot}` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 font-semibold align-middle">
                            {row.warehouse_name}
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            <div className="font-bold text-slate-900">{row.delivery_partner_name}</div>
                            {row.delivery_partner_phone && row.delivery_partner_phone !== 'N/A' && (
                              <div className="text-[10px] text-slate-400">{row.delivery_partner_phone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            <div className="font-bold text-slate-800">{row.container_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{row.container_id}</div>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700 align-middle">
                            <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg text-xs font-black">
                              {row.collected_quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold align-middle">
                            <span className="inline-flex px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-black">
                              {row.submitted_quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-[11px] align-middle">
                            {(row.damaged_quantity > 0 || row.lost_quantity > 0) ? (
                              <div className="flex items-center justify-center gap-1.5 font-bold">
                                {row.damaged_quantity > 0 && (
                                  <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                    Dmg: {row.damaged_quantity}
                                  </span>
                                )}
                                {row.lost_quantity > 0 && (
                                  <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                    Lost: {row.lost_quantity}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center align-middle">
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Awaiting Hub Review
                              </span>
                            )}
                            {isClosed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 size={11} className="text-emerald-700" />
                                Verified & Restocked
                              </span>
                            )}
                            {isDiscrepancy && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <ShieldAlert size={11} className="text-rose-700" />
                                Discrepancy ({row.discrepancy_quantity > 0 ? `+${row.discrepancy_quantity}` : row.discrepancy_quantity})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            {row.reviewer_name ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-[11px]">{row.reviewer_name}</span>
                                {row.reviewed_at && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(row.reviewed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Not verified yet</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {(!isClosed || isDiscrepancy) ? (
                                <button
                                  type="button"
                                  onClick={() => openVerifyModal(row)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                                  title="Verify and accept containers into warehouse inventory"
                                >
                                  <CheckCheck size={12} /> Verify & Accept
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setSelectedRecollectionDetail(row)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                                title="View recollection details"
                              >
                                <Eye size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Recollections Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-800">{recollectionsTotal > 0 ? (recollectionPage - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(recollectionPage * limit, recollectionsTotal)}</strong> of <strong className="text-slate-800">{recollectionsTotal}</strong> recollection entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={recollectionPage <= 1 || loadingRecollections}
                  onClick={() => { const p = recollectionPage - 1; setRecollectionPage(p); fetchRecollections(p); }}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  Page {recollectionPage} of {Math.max(1, totalRecollectionPages)}
                </span>
                <button
                  disabled={recollectionPage >= totalRecollectionPages || loadingRecollections}
                  onClick={() => { const p = recollectionPage + 1; setRecollectionPage(p); fetchRecollections(p); }}
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
      {/* MODAL: VERIFY & ACCEPT RECOLLECTION MODAL */}
      {/* ========================================================================= */}
      {verifyingRecollection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmVerify}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Verify Container Intake</h3>
                  <p className="text-xs text-slate-500 font-medium">Run: {verifyingRecollection.run_id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingRecollection(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Run & Container Information Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Delivery Partner:</span>
                <span className="font-bold text-slate-800">{verifyingRecollection.delivery_partner_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Warehouse:</span>
                <span className="font-bold text-slate-800">{verifyingRecollection.warehouse_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Container Type:</span>
                <span className="font-bold text-emerald-800">{verifyingRecollection.container_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-600 font-bold">Collected on Run:</span>
                <span className="font-black text-slate-900 text-sm">{verifyingRecollection.collected_quantity} units</span>
              </div>
            </div>

            {/* Intake Input Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Accepted Good Units (Restock to Warehouse)
                </label>
                <input
                  type="number"
                  min="0"
                  value={verifyAcceptedQty}
                  onChange={(e) => setVerifyAcceptedQty(e.target.value)}
                  className="w-full py-2.5 px-3 bg-emerald-50/40 border border-emerald-300 text-emerald-950 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  ✓ This quantity will be added directly into <strong>{verifyingRecollection.container_name}</strong> warehouse inventory.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
                    Damaged Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={verifyDamagedQty}
                    onChange={(e) => setVerifyDamagedQty(e.target.value)}
                    className="w-full py-2 px-3 bg-rose-50/40 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">
                    Lost Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={verifyLostQty}
                    onChange={(e) => setVerifyLostQty(e.target.value)}
                    className="w-full py-2 px-3 bg-purple-50/40 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Live Discrepancy Preview */}
              {(() => {
                const col = Number(verifyingRecollection.collected_quantity || 0);
                const acc = Number(verifyAcceptedQty || 0);
                const dmg = Number(verifyDamagedQty || 0);
                const lst = Number(verifyLostQty || 0);
                const disc = col - (acc + dmg + lst);
                return (
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-bold ${
                    disc === 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <span>Discrepancy / Unaccounted:</span>
                    <span>{disc === 0 ? '0 (Balanced)' : `${disc > 0 ? `-${disc} Missing` : `+${Math.abs(disc)} Extra`}`}</span>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hub Verification Notes
                </label>
                <input
                  type="text"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="e.g. Verified and returned to crate storage"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVerifyingRecollection(null)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingVerify}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingVerify ? 'Verifying...' : 'Confirm & Restock Warehouse'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DIRECT WAREHOUSE CONTAINER INTAKE */}
      {/* ========================================================================= */}
      {isDirectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDirectRecollection}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ArrowDownToLine size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Direct Warehouse Intake</h3>
                  <p className="text-xs text-slate-500 font-medium">Record returned containers directly at hub</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {directFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {directFormError}
              </div>
            )}

            <div className="space-y-3">
              {/* Warehouse Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Warehouse
                </label>
                <select
                  value={directWarehouseId}
                  onChange={(e) => {
                    setDirectWarehouseId(e.target.value);
                    fetchPendingRuns(e.target.value);
                  }}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {warehousesList.map((w: any) => (
                    <option key={w.id || w.warehouse_id} value={w.warehouse_id || w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Container Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Container Type
                </label>
                <select
                  value={directContainerId}
                  onChange={(e) => setDirectContainerId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  required
                >
                  <option value="">-- Select Container Type --</option>
                  {containersMaster.map((c: any) => (
                    <option key={c.container_id || c.id} value={c.container_id}>
                      {c.name} ({c.container_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Recollected Good Quantity (Units to Restock)
                </label>
                <input
                  type="number"
                  min="1"
                  value={directQuantity}
                  onChange={(e) => setDirectQuantity(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full py-2.5 px-3 bg-emerald-50/40 border border-emerald-300 text-emerald-950 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Optional Damaged / Lost */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Damaged (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={directDamagedQuantity}
                    onChange={(e) => setDirectDamagedQuantity(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Lost (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={directLostQuantity}
                    onChange={(e) => setDirectLostQuantity(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Optional Run Select */}
              {pendingRuns.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Link to Delivery Run (Optional)
                  </label>
                  <select
                    value={directRunId}
                    onChange={(e) => {
                      setDirectRunId(e.target.value);
                      const selectedRun = pendingRuns.find(r => r.run_id === e.target.value);
                      if (selectedRun?.delivery_partner_id) {
                        setDirectPartnerId(selectedRun.delivery_partner_id);
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="">-- Direct Counter / Unlinked Intake --</option>
                    {pendingRuns.map((r: any) => (
                      <option key={r.run_id} value={r.run_id}>
                        {r.run_id} ({r.delivery_partner_name} · {r.delivery_slot})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer ID (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Customer ID (Optional — will credit customer balance)
                </label>
                <input
                  type="text"
                  value={directCustomerId}
                  onChange={(e) => setDirectCustomerId(e.target.value)}
                  placeholder="e.g. CUST-1048 or customer phone"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Intake Notes
                </label>
                <input
                  type="text"
                  value={directNotes}
                  onChange={(e) => setDirectNotes(e.target.value)}
                  placeholder="e.g. Returned by customer directly at hub counter"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDirect}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingDirect ? 'Recording...' : 'Accept & Restock Inventory'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECOLLECTION DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedRecollectionDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Recollection Batch Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Batch #{selectedRecollectionDetail.id} · {selectedRecollectionDetail.run_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecollectionDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Warehouse:</span>
                <span className="font-bold text-slate-900">{selectedRecollectionDetail.warehouse_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Delivery Partner:</span>
                <span className="font-bold text-slate-900">{selectedRecollectionDetail.delivery_partner_name} ({selectedRecollectionDetail.delivery_partner_phone || 'N/A'})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Container Type:</span>
                <span className="font-bold text-emerald-800">{selectedRecollectionDetail.container_name} ({selectedRecollectionDetail.container_id})</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Collected</p>
                <p className="text-lg font-black text-slate-800">{selectedRecollectionDetail.collected_quantity}</p>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 text-center shadow-2xs">
                <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">Accepted</p>
                <p className="text-lg font-black text-emerald-800">{selectedRecollectionDetail.submitted_quantity}</p>
              </div>
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200 text-center shadow-2xs">
                <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider mb-1">Damaged / Lost</p>
                <p className="text-lg font-black text-rose-800">{Number(selectedRecollectionDetail.damaged_quantity || 0) + Number(selectedRecollectionDetail.lost_quantity || 0)}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Current Status:</span>
                <span className="font-bold uppercase tracking-wider text-slate-800">{selectedRecollectionDetail.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Reviewed By:</span>
                <span className="font-bold text-slate-800">{selectedRecollectionDetail.reviewer_name || 'Pending Review'}</span>
              </div>
              {selectedRecollectionDetail.submission_notes && (
                <div className="pt-1.5 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold block mb-0.5">Notes:</span>
                  <span className="text-slate-800 italic">{selectedRecollectionDetail.submission_notes}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedRecollectionDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                Close
              </button>
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

            {/* Warehouse Stock Allocation Section */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building size={14} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Warehouse Stock Allocation
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md">
                  Total: {Object.values(warehouseQuantities).reduce((s: number, q) => s + (Number(q) || 0), 0)} Units
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Set container stock quantity available for each warehouse:
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {warehousesList.map((w: any) => {
                  const wId = w.warehouse_id || w.id;
                  const currentQty = warehouseQuantities[wId] ?? 0;
                  return (
                    <div
                      key={wId}
                      className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {w.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {w.code ? `Code: ${w.code} · ` : ''}{w.warehouse_id || w.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0"
                          value={currentQty}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWarehouseQuantities((prev) => ({
                              ...prev,
                              [wId]: val,
                            }));
                          }}
                          placeholder="0"
                          className="w-24 py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-bold text-right focus:outline-none focus:border-emerald-600"
                        />
                        <span className="text-[11px] text-slate-500 font-semibold">units</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

