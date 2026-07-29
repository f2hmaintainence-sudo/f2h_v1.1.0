'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  Search,
  CheckCircle,
  PauseCircle,
  XCircle,
  LayoutDashboard,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-config';
import { api } from '@/services/api.client';
import SubscriptionDetailDrawer from '../components/SubscriptionDetailDrawer';

const API_URL = typeof window !== 'undefined' ? getApiBaseUrl() : 'http://localhost:5001/api/v1';

interface Branch {
  branch_id: string;
  branch_name: string;
}

interface DispatchItem {
  branch_id: string;
  product_variant_id: string;
  variant_name: string;
  product_name: string;
  total_quantity: string;
  subscription_count: string;
}

interface GenerationResult {
  success: boolean;
  targetDate: string;
  recordsInserted: number;
  recordsUpdated: number;
  durationMs: number;
  status: 'success' | 'skipped' | 'failed';
  errors: string[];
}

function getDispatchItems(payload: unknown): DispatchItem[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const maybeItems = (payload as { items?: unknown; data?: unknown }).items;
    if (Array.isArray(maybeItems)) return maybeItems;

    const maybeData = (payload as { data?: unknown }).data;
    if (Array.isArray(maybeData)) return maybeData;
    if (maybeData && typeof maybeData === 'object') return getDispatchItems(maybeData);
  }
  return [];
}

export default function GenerateOrdersPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<'morning' | 'evening'>('morning');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Dispatch Summary State (for top summary metrics)
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);

  // Order Generation State
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  // Subscriptions Table State
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // Pagination State (10 records per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Summary counts
  const [subSummary, setSubSummary] = useState<{ total: number; active: number; paused: number; expired: number; cancelled: number }>({
    total: 0,
    active: 0,
    paused: 0,
    expired: 0,
    cancelled: 0,
  });

  // Fetch branches
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await fetch(`${API_URL}/admin/zone/branches-list`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.status && Array.isArray(json.data)) {
            setBranches(json.data);
          }
        }
      } catch (e) {
        console.error('Failed to load branches', e);
      }
    }
    fetchBranches();
  }, []);

  // Fetch pre-summary metrics
  const fetchSummary = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        date: selectedDate,
        slot: selectedSlot,
      });
      if (selectedBranch) {
        q.set('branchId', selectedBranch);
      }

      const res = await fetch(`${API_URL}/admin/orders/dispatch/pre-summary?${q.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDispatchItems(getDispatchItems(data));
      }
    } catch (e) {
      console.error('Failed to load pre-summary metrics', e);
    }
  }, [selectedDate, selectedSlot, selectedBranch]);

  // Fetch subscription summary stats
  const fetchSubStats = useCallback(async () => {
    try {
      const res = await api.get('/subscriptions/subscriptions/summary');
      if (res.data?.status && res.data?.data) {
        setSubSummary(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sub stats', err);
    }
  }, []);

  // Fetch subscriptions list
  const fetchSubscriptions = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const params: any = {
        page: 1,
        limit: 100,
        search: searchQuery,
        targetDate: selectedDate,
      };
      if (statusFilter !== 'all') {
        params['status'] = statusFilter;
        params['filters[0]'] = statusFilter;
      }
      const res = await api.get('/subscriptions/subscriptions/table', { params });
      if (res.data) {
        let list: any[] = [];
        if (Array.isArray(res.data.data?.data)) {
          list = res.data.data.data;
        } else if (Array.isArray(res.data.data)) {
          list = res.data.data;
        } else if (Array.isArray(res.data)) {
          list = res.data;
        }
        setSubscriptionsList(list);
        setCurrentPage(1); // reset to page 1 on new data/filter
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions table', err);
      setSubscriptionsList([]);
    } finally {
      setLoadingSubs(false);
    }
  }, [statusFilter, searchQuery, selectedDate]);

  // Load metrics & tables on filter change
  useEffect(() => {
    fetchSummary();
    fetchSubStats();
    fetchSubscriptions();
  }, [fetchSummary, fetchSubStats, fetchSubscriptions]);

  // Trigger Order Generation
  const handleGenerateOrders = async () => {
    if (
      !confirm(
        `Are you sure you want to generate orders for ${selectedDate} (${selectedSlot === 'morning' ? 'Morning' : 'Evening'}) for ${
          selectedBranch ? `branch: ${selectedBranch}` : 'ALL Branches'
        }?`
      )
    ) {
      return;
    }

    setGenerating(true);
    setGenerationResult(null);
    try {
      const res = await fetch(`${API_URL}/admin/orders/dispatch/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          slot: selectedSlot,
          branchId: selectedBranch || undefined,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Order generation failed');
      }

      const result = await res.json();
      setGenerationResult(result);
      fetchSummary();
      fetchSubStats();
      fetchSubscriptions();
    } catch (e: any) {
      alert(e.message || 'Error occurred during generation');
    } finally {
      setGenerating(false);
    }
  };

  // Download PDF Report
  const handleDownloadPdf = () => {
    const q = new URLSearchParams({
      date: selectedDate,
      slot: selectedSlot,
    });
    if (selectedBranch) {
      q.set('branchId', selectedBranch);
    }
    window.open(`${API_URL}/admin/orders/dispatch/export-pdf?${q.toString()}`, '_blank');
  };

  // Filter subscriptions dynamically by statusFilter, selectedBranch, selectedDate, and searchQuery
  const filteredSubscriptions = subscriptionsList.filter((sub: any) => {
    // Status Filter
    if (statusFilter !== 'all') {
      const subStatus = String(sub.status || '').toLowerCase();
      if (subStatus !== statusFilter.toLowerCase()) return false;
    }

    // Branch Filter
    if (selectedBranch) {
      if (sub.branch_id && sub.branch_id !== selectedBranch) return false;
    }

    // Target Date Filter (Active on Target Date)
    if (selectedDate) {
      const subStart = sub.start_date ? String(sub.start_date).slice(0, 10) : null;
      const subEnd = sub.end_date ? String(sub.end_date).slice(0, 10) : null;

      if (subStart && subStart > selectedDate) return false;
      if (subEnd && subEnd < selectedDate) return false;
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = String(sub.customer_name || sub.full_name || '').toLowerCase();
      const phone = String(sub.phone || sub.mobile || '').toLowerCase();
      const subNum = String(sub.subscription_number || sub.subscription_id || '').toLowerCase();

      if (!name.includes(q) && !phone.includes(q) && !subNum.includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Pagination Math (10 items per page)
  const totalItemsCount = filteredSubscriptions.length;
  const totalPagesCount = Math.ceil(totalItemsCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + pageSize);

  // Dynamic summary counts from list
  const activeCount = subscriptionsList.filter(s => String(s.status).toLowerCase() === 'active').length;
  const pausedCount = subscriptionsList.filter(s => String(s.status).toLowerCase() === 'paused').length;
  const expiredCount = subscriptionsList.filter(s => String(s.status).toLowerCase() === 'expired').length;
  const cancelledCount = subscriptionsList.filter(s => String(s.status).toLowerCase() === 'cancelled').length;

  const displaySummary = {
    total: subSummary.total || subscriptionsList.length,
    active: subSummary.active || activeCount,
    paused: subSummary.paused || pausedCount,
    expired: subSummary.expired || expiredCount,
    cancelled: subSummary.cancelled || cancelledCount,
  };

  // Summary Metrics calculations
  const totalQuantity = dispatchItems.reduce((acc, item) => acc + Number(item.total_quantity || 0), 0);
  const totalSubs = dispatchItems.reduce((acc, item) => acc + Number(item.subscription_count || 0), 0);
  const totalUniqueProducts = dispatchItems.length;

  return (
    <div className="space-y-6 p-2 md:p-4 font-sans min-h-screen">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-emerald-600" />
            Subscriptions Management & Order Generation
          </h1>
          <p className="text-slate-500 mt-1 text-xs font-medium">
            Monitor active customer recurring orders, inspect weekly schedules, and manually trigger daily order dispatches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSummary();
              fetchSubStats();
              fetchSubscriptions();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Data
          </button>
        </div>
      </div>

      {/* Subscription Status Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          onClick={() => setStatusFilter('active')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'active' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Active Subscriptions
            </span>
            <CheckCircle className={`w-4 h-4 ${statusFilter === 'active' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusFilter === 'active' ? 'text-white' : 'text-emerald-700'}`}>
            {displaySummary.active || 0}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('paused')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'paused'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-200'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'paused' ? 'text-amber-100' : 'text-slate-400'}`}>
              Paused / Vacation
            </span>
            <PauseCircle className={`w-4 h-4 ${statusFilter === 'paused' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusFilter === 'paused' ? 'text-white' : 'text-amber-600'}`}>
            {displaySummary.paused || 0}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('expired')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'expired'
              ? 'bg-slate-700 text-white border-slate-700 shadow-md ring-2 ring-slate-200'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'expired' ? 'text-slate-300' : 'text-slate-400'}`}>
              Expired
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'expired' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusFilter === 'expired' ? 'text-white' : 'text-slate-700'}`}>
            {displaySummary.expired || 0}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'cancelled'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-200'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'cancelled' ? 'text-rose-100' : 'text-slate-400'}`}>
              Cancelled
            </span>
            <XCircle className={`w-4 h-4 ${statusFilter === 'cancelled' ? 'text-white' : 'text-rose-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusFilter === 'cancelled' ? 'text-white' : 'text-rose-700'}`}>
            {displaySummary.cancelled || 0}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-300'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
              Total Subscriptions
            </span>
            <LayoutDashboard className={`w-4 h-4 ${statusFilter === 'all' ? 'text-white' : 'text-slate-700'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
            {displaySummary.total || 0}
          </div>
        </button>
      </div>

      {/* Manual Order Generation Controls Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Play size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Manual Order Generation Controls</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                Target Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 bg-white transition-colors"
              />
            </div>

            {/* Slot Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                Delivery Slot
              </label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as 'morning' | 'evening')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 bg-white transition-colors"
              >
                <option value="morning">Morning Slot</option>
                <option value="evening">Evening Slot</option>
              </select>
            </div>

            {/* Branch Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                <Building2 size={13} className="text-slate-400" />
                Branch Selection
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 bg-white transition-colors"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.branch_id} value={b.branch_id}>
                    {b.branch_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleGenerateOrders}
              disabled={generating}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating Orders...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Trigger Order Generation
                </>
              )}
            </button>

            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <Download size={16} className="text-emerald-700" />
              Export PDF Report
            </button>
          </div>
        </div>

        {/* Real-time Summary Card / Metrics */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Summary Metrics</h2>
            <TrendingUp size={18} className="text-emerald-600" />
          </div>

          <div className="grid grid-cols-3 gap-2 my-auto py-4">
            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Total Qty</span>
              <div className="text-lg font-black text-emerald-800 mt-1">{totalQuantity.toFixed(1)}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Products</span>
              <div className="text-lg font-black text-blue-800 mt-1">{totalUniqueProducts}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Active Subs</span>
              <div className="text-lg font-black text-amber-800 mt-1">{totalSubs}</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center font-medium">
            * Reflects quantities of subscriptions not yet processed for this date and slot.
          </div>
        </div>
      </div>

      {/* Generation Results Feedback Panel */}
      {generationResult && (
        <div className={`p-5 rounded-2xl border ${generationResult.success ? 'bg-emerald-50/70 border-emerald-100 text-emerald-900' : 'bg-rose-50/70 border-rose-100 text-rose-900'} space-y-3`}>
          <div className="flex items-center gap-2">
            {generationResult.success ? (
              <CheckCircle2 className="text-emerald-600" size={20} />
            ) : (
              <AlertCircle className="text-rose-600" size={20} />
            )}
            <h3 className="font-bold text-sm">
              Order Generation {generationResult.success ? 'Completed Successfully' : 'Failed'}
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium pt-1">
            <div>
              <span className="text-slate-500">Target Date:</span> {generationResult.targetDate}
            </div>
            <div>
              <span className="text-slate-500">Orders Created:</span> {generationResult.recordsInserted}
            </div>
            <div>
              <span className="text-slate-500">Duration:</span> {generationResult.durationMs}ms
            </div>
            <div>
              <span className="text-slate-500">Status:</span> <span className="capitalize font-bold">{generationResult.status}</span>
            </div>
          </div>

          {generationResult.errors && generationResult.errors.length > 0 && (
            <div className="border-t border-slate-200/50 pt-2.5">
              <div className="text-xs font-bold uppercase text-slate-500 mb-1">Errors Logged:</div>
              <ul className="list-disc list-inside text-xs space-y-1 text-rose-700">
                {generationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Customer Subscriptions Master Ledger */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              Customer Subscriptions Master Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live monitor of customer subscriptions taken via the customer application.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Filter Pill Badge Indicator */}
            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              Filter: <span className="capitalize text-emerald-700 font-extrabold">{statusFilter}</span> ({totalItemsCount})
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Datatable */}
        {loadingSubs ? (
          <div className="py-16 text-center text-xs font-bold text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            Loading customer subscriptions...
          </div>
        ) : paginatedSubscriptions.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No customer subscriptions found matching the filter ({statusFilter})
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-4">Sub ID</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Wallet Balance</th>
                  <th className="py-3 px-4">Start / End Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedSubscriptions.map((row: any) => {
                  // Normalize status string (remove raw HTML tags if any)
                  const rawStatus = String(row.status || 'active').replace(/<[^>]*>?/gm, '').trim().toLowerCase();
                  // Extract raw wallet number if formatted
                  const rawWallet = typeof row.wallet_balance === 'string'
                    ? parseFloat(row.wallet_balance.replace(/[^0-9.-]+/g, '')) || 0
                    : Number(row.wallet_balance || 0);

                  return (
                    <tr key={row.id || row.subscription_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {row.subscription_number || row.subscription_id || `SUB-${row.id}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block text-xs">
                          {row.customer_name || row.customer_id || 'N/A'}
                        </span>
                        <span className="text-[11px] text-slate-400 block font-mono">
                          📞 {row.phone || 'N/A'} | ID: {row.customer_id}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 capitalize font-semibold text-slate-800">
                        {row.schedule_type || 'Daily'}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-semibold text-slate-800">
                        {row.payment_type || 'Prepaid'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className={rawWallet >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          ₹{rawWallet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px]">
                        <span className="block font-semibold text-slate-800">
                          Start: {row.start_date ? String(row.start_date).slice(0, 10) : '—'}
                        </span>
                        <span className="block text-slate-400">
                          End: {row.end_date ? String(row.end_date).slice(0, 10) : 'Ongoing'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                            rawStatus === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : rawStatus === 'paused'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : rawStatus === 'cancelled'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {rawStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedSubId(String(row.subscription_id || row.id))}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls (10 records per page) */}
        {!loadingSubs && totalItemsCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <div>
              Showing <span className="text-slate-900 font-bold">{startIndex + 1}</span> to{' '}
              <span className="text-slate-900 font-bold">{Math.min(startIndex + pageSize, totalItemsCount)}</span> of{' '}
              <span className="text-slate-900 font-bold">{totalItemsCount}</span> entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPagesCount }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                      currentPage === pageNum
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPagesCount))}
                disabled={currentPage === totalPagesCount}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Details Slide-Over Drawer */}
      {selectedSubId && (
        <SubscriptionDetailDrawer
          subscriptionId={selectedSubId}
          onClose={() => setSelectedSubId(null)}
          onRefresh={() => {
            fetchSubStats();
            fetchSubscriptions();
          }}
        />
      )}
    </div>
  );
}
