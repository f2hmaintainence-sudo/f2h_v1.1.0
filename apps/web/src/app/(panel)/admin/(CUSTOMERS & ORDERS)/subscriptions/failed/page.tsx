'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  FileText,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  TrendingUp,
  Users,
  PackageCheck,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

  // Dispatch Summary State
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Order Generation State
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  // Fetch branches
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await fetch(`${API_URL}/aadmin/zone/branches-list`, {
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

  // Fetch dispatch summary
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const q = new URLSearchParams({
        date: selectedDate,
        slot: selectedSlot,
      });
      if (selectedBranch) {
        q.set('branchId', selectedBranch);
      }

      const res = await fetch(`${API_URL}/api/orders/dispatch/pre-summary?${q.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch pre-dispatch summary');
      }
      const data = await res.json();
      setDispatchItems(getDispatchItems(data));
    } catch (e: any) {
      setSummaryError(e.message || 'An error occurred while loading summary');
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedDate, selectedSlot, selectedBranch]);

  // Load summary on filters change
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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
      const res = await fetch(`${API_URL}/api/orders/dispatch/generate`, {
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
      fetchSummary(); // Refresh dispatch summary to reflect any status changes (e.g. non-generated orders remaining)
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
    window.open(`${API_URL}/api/orders/dispatch/export-pdf?${q.toString()}`, '_blank');
  };

  // Metrics calculation
  const totalQuantity = dispatchItems.reduce((acc, item) => acc + Number(item.total_quantity || 0), 0);
  const totalSubs = dispatchItems.reduce((acc, item) => acc + Number(item.subscription_count || 0), 0);
  const totalUniqueProducts = dispatchItems.length;

  return (
    <div className="space-y-6 p-4 md:p-6 font-sans bg-[#f9f6ef] min-h-screen">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-deep-green tracking-tight">
            Order Generation & Dispatch Summary
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manually trigger subscription order generation and view branch-wise stock requirements.
          </p>
        </div>
      </div>

      {/* Grid: Controls & Summary metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Play size={18} className="text-fresh-green" />
            <h2 className="text-lg font-bold text-deep-green">Manual Order Generation Controls</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                <Calendar size={13} className="text-gray-400" />
                Target Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-fresh-green bg-white transition-colors"
              />
            </div>

            {/* Slot Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                <Clock size={13} className="text-gray-400" />
                Delivery Slot
              </label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as 'morning' | 'evening')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-fresh-green bg-white transition-colors"
              >
                <option value="morning">Morning Slot</option>
                <option value="evening">Evening Slot</option>
              </select>
            </div>

            {/* Branch Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                <Building2 size={13} className="text-gray-400" />
                Branch Selection
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-fresh-green bg-white transition-colors"
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
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-deep-green to-[#1b5d3a] px-4 py-3 text-sm font-bold text-white hover:from-green-800 hover:to-green-900 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Orders...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Trigger Order Generation
                </>
              )}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={loadingSummary || dispatchItems.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <Download size={18} className="text-deep-green" />
              Export PDF Report
            </button>
          </div>
        </div>

        {/* Real-time Summary Card / Metrics */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-deep-green">Summary Metrics</h2>
            <TrendingUp size={18} className="text-deep-green" />
          </div>

          <div className="grid grid-cols-3 gap-2 my-auto py-4">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Total Qty</span>
              <div className="text-xl font-black text-emerald-800 mt-1">{totalQuantity.toFixed(1)}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Products</span>
              <div className="text-xl font-black text-blue-800 mt-1">{totalUniqueProducts}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Active Subs</span>
              <div className="text-xl font-black text-amber-800 mt-1">{totalSubs}</div>
            </div>
          </div>

          <div className="text-xs text-gray-400 text-center">
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
              <span className="text-gray-500">Target Date:</span> {generationResult.targetDate}
            </div>
            <div>
              <span className="text-gray-500">Orders Created:</span> {generationResult.recordsInserted}
            </div>
            <div>
              <span className="text-gray-500">Duration:</span> {generationResult.durationMs}ms
            </div>
            <div>
              <span className="text-gray-500">Status:</span> <span className="capitalize font-bold">{generationResult.status}</span>
            </div>
          </div>

          {generationResult.errors && generationResult.errors.length > 0 && (
            <div className="border-t border-gray-200/50 pt-2.5">
              <div className="text-xs font-bold uppercase text-gray-500 mb-1">Errors Logged:</div>
              <ul className="list-disc list-inside text-xs space-y-1 text-red-700">
                {generationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Dispatch Summary Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-black text-deep-green flex items-center gap-2">
              <FileText size={18} className="text-fresh-green" />
              Dispatch Stock Requirements Summary
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Shows required quantities per variant branch-wise for {selectedDate} ({selectedSlot === 'morning' ? 'Morning' : 'Evening'}).
            </p>
          </div>
        </div>

        {loadingSummary ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <Loader2 size={36} className="animate-spin text-fresh-green" />
            <p className="text-sm font-semibold">Loading stock requirements...</p>
          </div>
        ) : summaryError ? (
          <div className="flex flex-col items-center justify-center py-16 text-rose-600 gap-2">
            <AlertCircle size={36} />
            <p className="text-sm font-semibold">{summaryError}</p>
          </div>
        ) : dispatchItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <PackageCheck size={48} className="text-gray-300 mb-3" />
            <p className="text-sm font-semibold">No stock requirements found for selected options</p>
            <p className="text-xs text-gray-400 mt-1">All orders may have been generated, or no schedules exist.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-500">
              <thead className="bg-gray-50/80 text-[11px] font-bold uppercase text-gray-700 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Branch ID</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Variant Name</th>
                  <th className="px-6 py-4">Variant ID</th>
                  <th className="px-6 py-4 text-right">Subscriptions</th>
                  <th className="px-6 py-4 text-right">Total Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {dispatchItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700">
                        {item.branch_id || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-bold">{item.product_name || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.variant_name || '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{item.product_variant_id}</td>
                    <td className="px-6 py-4 text-right text-gray-700 font-semibold">
                      {Number(item.subscription_count).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-700 font-bold">
                      {Number(item.total_quantity).toFixed(1)} Unit(s)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
