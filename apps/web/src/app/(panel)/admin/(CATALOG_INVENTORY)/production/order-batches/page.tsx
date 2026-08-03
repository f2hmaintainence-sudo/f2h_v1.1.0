"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/services/api.client";
import {
  Factory, RefreshCw, Home, ChevronRight, Zap, Search,
  CheckCircle2, Clock, Package, AlertTriangle, X, Plus,
  Download, FileSpreadsheet, FileText, Edit3, ArrowRight,
  Calendar, Filter, Loader2
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

// ── Status Configuration ──
const statusConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  pending: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Pending", icon: Clock },
  processing: { color: "text-blue-700", bg: "bg-blue-50 border-blue-200", label: "Processing", icon: Loader2 },
  prepared: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Prepared", icon: CheckCircle2 },
};

const statusFlow: Record<string, { next: string; label: string }> = {
  pending: { next: "processing", label: "Start Processing" },
  processing: { next: "prepared", label: "Mark Prepared" },
};

interface DashboardSummary {
  today: number; tomorrow: number; past_due: number;
  pending: number; processing: number; prepared: number;
}

interface Batch {
  batch_id: string; branch_id: string; production_date: string; slot: string;
  product_id: string; status: string; total_quantity: number; prepared_quantity: number;
  remaining_quantity: number; total_orders: number; unit: string; notes: string;
  product_name: string; branch_name: string; created_at: string; updated_at: string;
}

export default function OrderBatchesPage() {
  // State
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [dateFilter, setDateFilter] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Data for dropdowns
  const [branches, setBranches] = useState<any[]>([]);
  const [batchProducts, setBatchProducts] = useState<any[]>([]);

  // Modals
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [editPreparedQty, setEditPreparedQty] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ branch_id: "", product_id: "", production_date: "", slot: "morning", total_quantity: "", unit: "pcs", notes: "" });
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({ dateOption: "today", customDate: "", slot: "", branch_id: "" });
  const [saving, setSaving] = useState(false);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch Summary ──
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<any>("/admin/production/order-batches/summary");
      if (res.data?.status) setSummary(res.data.data);
    } catch { }
  }, []);

  // ── Fetch Batches ──
  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter && dateFilter !== "custom") params.set("date_filter", dateFilter);
      if (dateFilter === "custom" && customDate) params.set("date", customDate);
      if (statusFilter) params.set("status", statusFilter);
      if (slotFilter) params.set("slot", slotFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await api.get<any>(`/admin/production/order-batches/table?${params}`);
      if (res.data?.status) {
        setBatches(res.data.data || []);
        setTotal(res.data.total || 0);
      }
    } catch { } finally { setLoading(false); }
  }, [dateFilter, customDate, statusFilter, slotFilter, branchFilter, searchQuery, page]);

  // ── Initial Loads ──
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => {
    api.get<any>("/admin/dashboard/branch-performance?days=1").then(res => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => { });
    api.get<any>("/admin/production/order-batches/products").then(res => {
      if (res.data?.data) setBatchProducts(res.data.data);
    }).catch(() => { });
  }, []);

  // ── Search debounce ──
  const handleSearchChange = (val: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(val);
      setPage(1);
    }, 400);
  };

  // ── Generate Batches ──
  const generateBatches = async () => {
    if (generateForm.dateOption === "custom" && !generateForm.customDate) {
      alert("Please select a custom date");
      return;
    }
    setGenerating(true);
    try {
      const body: any = {
        date: generateForm.dateOption === "custom" ? generateForm.customDate : generateForm.dateOption,
      };
      if (generateForm.branch_id) body.branch_id = generateForm.branch_id;
      if (generateForm.slot) body.slot = generateForm.slot;

      const res = await api.post<any>("/admin/production/order-batches/generate", body);
      if (res.data?.status) {
        showSuccessToast(res.data.message || "Batches generated");
        setShowGenerateModal(false);
        fetchBatches();
        fetchSummary();
      }
    } catch { alert("Failed to generate batches"); }
    finally { setGenerating(false); }
  };

  // ── Update Status ──
  const updateStatus = async (batchId: string, status: string) => {
    try {
      const res = await api.post<any>(`/admin/production/order-batches/${batchId}/status`, { status });
      if (res.data?.status) {
        showSuccessToast(`Batch updated to ${status}`);
        fetchBatches();
        fetchSummary();
      }
    } catch { alert("Failed to update status"); }
  };

  // ── Save Edit ──
  const saveEdit = async () => {
    if (!editBatch) return;
    setSaving(true);
    try {
      const res = await api.post<any>(`/admin/production/order-batches/${editBatch.batch_id}/quantity`, {
        prepared_quantity: parseFloat(editPreparedQty) || 0,
        notes: editNotes,
      });
      if (res.data?.status) {
        showSuccessToast("Batch updated");
        setEditBatch(null);
        fetchBatches();
        fetchSummary();
      }
    } catch { alert("Failed to update"); }
    finally { setSaving(false); }
  };

  // ── Create Manual Batch ──
  const createManual = async () => {
    setSaving(true);
    try {
      const res = await api.post<any>("/admin/production/order-batches/manual", {
        ...manualForm,
        total_quantity: parseFloat(manualForm.total_quantity) || 0,
      });
      if (res.data?.status) {
        showSuccessToast(res.data.message || "Manual batch created");
        setShowManualModal(false);
        setManualForm({ branch_id: "", product_id: "", production_date: "", slot: "morning", total_quantity: "", unit: "pcs", notes: "" });
        fetchBatches();
        fetchSummary();
      } else {
        alert(res.data?.message || "Failed to create");
      }
    } catch { alert("Failed to create manual batch"); }
    finally { setSaving(false); }
  };

  // ── Export ──
  const exportData = (format: "csv" | "pdf") => {
    if (batches.length === 0) return;
    if (format === "csv") {
      const headers = ["Batch ID", "Product", "Branch", "Date", "Slot", "Total Qty", "Prepared Qty", "Status", "Notes"];
      const rows = batches.map(b => [
        b.batch_id, b.product_name, b.branch_name, b.production_date, b.slot,
        b.total_quantity, b.prepared_quantity, b.status, b.notes || ""
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `order-batches-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      const rows = batches.map(b =>
        `<tr><td>${b.batch_id}</td><td>${b.product_name}</td><td>${b.branch_name}</td><td>${b.production_date}</td><td>${b.slot}</td><td>${b.total_quantity}</td><td>${b.prepared_quantity}</td><td>${b.status}</td></tr>`
      ).join("");
      printWindow.document.write(`<html><head><title>Order Batches</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:bold}</style></head><body><h2>Order Batches Report</h2><table><thead><tr><th>Batch ID</th><th>Product</th><th>Branch</th><th>Date</th><th>Slot</th><th>Total</th><th>Prepared</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const totalPages = Math.ceil(total / limit);
  const progressPct = (b: Batch) => b.total_quantity > 0 ? Math.min(100, Math.round((Number(b.prepared_quantity) / Number(b.total_quantity)) * 100)) : 0;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Production</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Order Batches</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Factory size={24} className="text-orange-500" /> Order Batches
          </h1>
          <p className="text-xs text-slate-400 mt-1">Production preparation dashboard — auto-generated from confirmed orders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 text-slate-700">
            <Plus size={14} /> Manual Preparation
          </button>
          <button onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-all shadow-sm">
            <Zap size={14} /> Generate Batches
          </button>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => exportData("csv")} title="Export Excel/CSV"
              className="p-2 hover:bg-slate-50 text-slate-500"><FileSpreadsheet size={16} /></button>
            <button onClick={() => exportData("pdf")} title="Export PDF"
              className="p-2 hover:bg-slate-50 text-slate-500"><FileText size={16} /></button>
          </div>
          <button onClick={() => { fetchBatches(); fetchSummary(); }}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Dashboard Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Today", value: summary.today, color: "bg-sky-50 border-sky-200 text-sky-700", icon: Calendar },
            { label: "Tomorrow", value: summary.tomorrow, color: "bg-indigo-50 border-indigo-200 text-indigo-700", icon: Calendar },
            { label: "Past Due", value: summary.past_due, color: "bg-rose-50 border-rose-200 text-rose-700", icon: AlertTriangle },
            { label: "Pending", value: summary.pending, color: "bg-amber-50 border-amber-200 text-amber-700", icon: Clock },
            { label: "Processing", value: summary.processing, color: "bg-blue-50 border-blue-200 text-blue-700", icon: Loader2 },
            { label: "Prepared", value: summary.prepared, color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircle2 },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className={`${c.color} rounded-xl p-4 border`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className="opacity-60" />
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{c.label}</span>
                </div>
                <p className="text-2xl font-black">{c.value ?? 0}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5">
            {["today", "tomorrow", "past", "custom"].map(d => (
              <button key={d} onClick={() => { setDateFilter(d); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${dateFilter === d ? "bg-orange-600 text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}>
                {d === "past" ? "Past Due" : d}
              </button>
            ))}
          </div>
          {dateFilter === "custom" && (
            <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          )}

          {/* Branch */}
          {branches.length > 0 && (
            <select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white">
              <option value="">All Branches</option>
              {branches.map((b: any) => (
                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
              ))}
            </select>
          )}

          {/* Slot */}
          <select value={slotFilter} onChange={(e) => { setSlotFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white">
            <option value="">All Slots</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>

          {/* Status */}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="prepared">Prepared</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search product..."
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm placeholder:text-slate-300" />
          </div>
        </div>
      </div>

      {/* Batch Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-orange-100 border-t-orange-500 rounded-full animate-spin" /></div>
      ) : batches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Factory size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No order batches found</p>
          <p className="text-xs text-slate-300 mt-1">Click &quot;Generate Batches&quot; to create from confirmed orders</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b bg-slate-50/80">
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-center">Date</th>
                  <th className="px-4 py-3 text-center">Slot</th>
                  <th className="px-4 py-3 text-center">Total Qty</th>
                  <th className="px-4 py-3 text-center">Prepared</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => {
                  const sc = statusConfig[batch.status] || statusConfig.pending;
                  const nextAction = statusFlow[batch.status];
                  const pct = progressPct(batch);
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={batch.batch_id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{batch.product_name || "—"}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-mono">{batch.batch_id}</span>
                          {Number(batch.total_orders || 0) > 0 && (
                            <>
                              <span>•</span>
                              <span>{batch.total_orders} {batch.total_orders === 1 ? 'order' : 'orders'}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{batch.branch_name || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {batch.production_date ? new Date(batch.production_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">{batch.slot}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">
                        {Number(batch.total_quantity).toLocaleString("en-IN")} <span className="text-[10px] font-semibold text-slate-400 uppercase">{batch.unit || 'pcs'}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">
                        {Number(batch.prepared_quantity).toLocaleString("en-IN")} <span className="text-[10px] font-semibold text-slate-400 uppercase">{batch.unit || 'pcs'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.color}`}>
                          <StatusIcon size={10} /> {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditBatch(batch); setEditPreparedQty(String(batch.prepared_quantity)); setEditNotes(batch.notes || ""); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Edit">
                            <Edit3 size={14} />
                          </button>
                          {nextAction && (
                            <button onClick={() => updateStatus(batch.batch_id, nextAction.next)}
                              className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-[10px] font-bold hover:bg-orange-100 border border-orange-200 transition-all whitespace-nowrap">
                              {nextAction.label}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${p === page ? "bg-orange-600 text-white" : "border border-slate-200 hover:bg-slate-50"}`}>
                      {p}
                    </button>
                  );
                })}
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Edit Batch</h3>
              <button onClick={() => setEditBatch(null)} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-bold text-slate-700">{editBatch.product_name}</p>
                <p className="text-[10px] text-slate-400">{editBatch.branch_name} · {editBatch.slot} · {editBatch.production_date}</p>
                <p className="text-[10px] text-slate-400 mt-1">Total: {editBatch.total_quantity} · Current Prepared: {editBatch.prepared_quantity}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Prepared Quantity</label>
                <input type="number" value={editPreparedQty} onChange={(e) => setEditPreparedQty(e.target.value)}
                  min="0" max={editBatch.total_quantity} step="0.001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" placeholder="Add production notes..." />
              </div>

              {/* Status Transition */}
              <div className="flex gap-2">
                {["pending", "processing", "prepared"].map(s => {
                  const sc = statusConfig[s];
                  return (
                    <button key={s} onClick={() => { updateStatus(editBatch.batch_id, s); setEditBatch(null); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${editBatch.status === s ? `${sc.bg} ${sc.color} ring-2 ring-offset-1 ring-orange-300` : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"}`}>
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditBatch(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Preparation Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus size={16} className="text-orange-500" /> Manual Preparation
              </h3>
              <button onClick={() => setShowManualModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Branch *</label>
                <select value={manualForm.branch_id}
                  onChange={(e) => setManualForm({ ...manualForm, branch_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  <option value="">Select Branch</option>
                  {branches.map((b: any) => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Product *</label>
                <select value={manualForm.product_id}
                  onChange={(e) => setManualForm({ ...manualForm, product_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  <option value="">Select Product</option>
                  {batchProducts.map((p: any) => (
                    <option key={p.product_id} value={p.product_id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Production Date *</label>
                  <input type="date" value={manualForm.production_date}
                    onChange={(e) => setManualForm({ ...manualForm, production_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Slot</label>
                  <select value={manualForm.slot}
                    onChange={(e) => setManualForm({ ...manualForm, slot: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Total Quantity *</label>
                  <input type="number" value={manualForm.total_quantity}
                    onChange={(e) => setManualForm({ ...manualForm, total_quantity: e.target.value })}
                    min="0" step="0.001" placeholder="0"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Unit</label>
                  <select value={manualForm.unit}
                    onChange={(e) => setManualForm({ ...manualForm, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                    <option value="pcs">PCS</option>
                    <option value="kg">KG</option>
                    <option value="L">L</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <textarea value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" placeholder="Optional notes..." />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowManualModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={createManual} disabled={saving || !manualForm.branch_id || !manualForm.product_id || !manualForm.production_date || !manualForm.total_quantity}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {saving ? "Creating..." : "Create Batch"}
              </button>
            </div>
          </div>
        </div>
)}
      {/* Generate Batches Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Zap size={16} className="text-orange-500" /> Generate Production Batches
              </h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Production Date *</label>
                <select value={generateForm.dateOption}
                  onChange={(e) => setGenerateForm({ ...generateForm, dateOption: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>

              {generateForm.dateOption === "custom" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Custom Date *</label>
                  <input type="date" value={generateForm.customDate}
                    onChange={(e) => setGenerateForm({ ...generateForm, customDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
                <select value={generateForm.branch_id}
                  onChange={(e) => setGenerateForm({ ...generateForm, branch_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  <option value="">All Branches</option>
                  {branches.map((b: any) => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Delivery Slot</label>
                <select value={generateForm.slot}
                  onChange={(e) => setGenerateForm({ ...generateForm, slot: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  <option value="">All Slots</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={generateBatches} disabled={generating}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1">
                {generating ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
