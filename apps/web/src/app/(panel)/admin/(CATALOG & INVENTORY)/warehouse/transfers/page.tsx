"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  ArrowLeftRight, RefreshCw, Home, ChevronRight, Plus,
  CheckCircle2, Clock, Truck, Package, XCircle
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-slate-50 text-slate-600 border-slate-200", label: "Pending" },
  approved: { color: "bg-sky-50 text-sky-600 border-sky-200", label: "Approved" },
  dispatched: { color: "bg-blue-50 text-blue-600 border-blue-200", label: "Dispatched" },
  partially_received: { color: "bg-amber-50 text-amber-600 border-amber-200", label: "Partial" },
  completed: { color: "bg-emerald-50 text-emerald-600 border-emerald-200", label: "Completed" },
  cancelled: { color: "bg-rose-50 text-rose-600 border-rose-200", label: "Cancelled" },
};

export default function StockTransfersDashboardPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  useEffect(() => {
    api.get<any>('/admin/warehouses/active/list')
      .then(res => {
        if (res.data?.data) setWarehouses(res.data.data);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (selectedWarehouse) params.set("warehouse_id", selectedWarehouse);
      const queryStr = params.toString() ? `?${params.toString()}` : "";

      const [summaryRes, transfersRes] = await Promise.all([
        api.get<any>("/admin/inventory/dashboard/transfer-status"),
        api.get<any>(`/warehouse/transfer/table${queryStr}`),
      ]);
      if (summaryRes.data?.status) setSummary(summaryRes.data.data || []);
      if (transfersRes.data?.data) setTransfers(transfersRes.data.data);
    } catch { } finally { setLoading(false); }
  }, [statusFilter, selectedWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post<any>(`/warehouse/transfer/${id}/${action}`);
      showSuccessToast(`Transfer ${action} successful`);
      fetchData();
    } catch { alert(`Failed to ${action} transfer`); }
  };

  const getNextAction = (status: string): { action: string; label: string } | null => {
    const flow: Record<string, { action: string; label: string }> = {
      pending: { action: "approve", label: "Approve" },
      approved: { action: "dispatch", label: "Dispatch" },
      dispatched: { action: "receive", label: "Receive" },
    };
    return flow[status] || null;
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Warehouse</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Stock Transfers</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ArrowLeftRight size={24} className="text-teal-500" /> Stock Transfers
          </h1>
          <p className="text-xs text-slate-400 mt-1">Warehouse-to-warehouse transfers with full stock movement tracking.</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const item = summary.find((s: any) => s.status === key);
          return (
            <button key={key} onClick={() => { setStatusFilter(statusFilter === key ? "" : key); }}
              className={`p-4 rounded-2xl border text-left transition-all ${statusFilter === key ? "ring-2 ring-teal-400 shadow-md" : ""} ${cfg.color}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{cfg.label}</p>
              <h3 className="text-2xl font-black mt-1">{item?.count ?? 0}</h3>
              <p className="text-[10px] opacity-60 mt-0.5">{Number(item?.total_qty ?? 0).toLocaleString("en-IN")} qty</p>
            </button>
          );
        })}
      </div>

      {/* Filters (Warehouse & Status) */}
      <div className="flex flex-wrap gap-3 items-center">
        {warehouses.length > 0 && (
          <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
            <button
              onClick={() => setSelectedWarehouse("")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${selectedWarehouse === "" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              All Warehouses
            </button>
            {warehouses.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWarehouse(w.warehouse_id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${selectedWarehouse === w.warehouse_id ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          {["", ...Object.keys(statusConfig)].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${statusFilter === s ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {s ? s.replace(/_/g, " ") : "All Statuses"}
            </button>
          ))}
        </div>
      </div>

      {/* Transfers List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <ArrowLeftRight size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No transfers found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Transfer ID</th>
                  <th className="px-4 py-3 text-left">From → To</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-center">Quantity</th>
                  <th className="px-4 py-3 text-center">Dispatched</th>
                  <th className="px-4 py-3 text-center">Received</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t: any) => {
                  const sc = statusConfig[t.transfer_status] || statusConfig.pending;
                  const nextAction = getNextAction(t.transfer_status);
                  return (
                    <tr key={t.id || t.transfer_id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{t.transfer_id}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">{t.from_warehouse_name || "—"}</p>
                        <p className="text-[10px] text-slate-400">→ {t.to_warehouse_name || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{t.product_name || t.variant_name || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{Number(t.quantity || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">{Number(t.quantity_dispatched || 0)}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">{Number(t.quantity_received || 0)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {nextAction && (
                          <button onClick={() => handleAction(t.id, nextAction.action)}
                            className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg text-[10px] font-bold hover:bg-teal-100 border border-teal-200 transition-all">
                            {nextAction.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50/50 border-t text-xs text-slate-400">
            {transfers.length} transfers shown
          </div>
        </div>
      )}
    </div>
  );
}
