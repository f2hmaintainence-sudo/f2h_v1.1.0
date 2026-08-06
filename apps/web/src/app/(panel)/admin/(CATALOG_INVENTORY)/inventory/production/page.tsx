"use client";

import { useState, useCallback } from "react";
import { ArrowDownUp, RefreshCw, Home, ChevronRight, Filter } from "lucide-react";
import Link from "next/link";
import SkeletonTable from "@/components/Table Generator/SkeletonTable";

const movementTypes = [
  "", "purchase", "production", "stock_transfer", "dispatch",
  "delivery_return", "customer_return", "stock_adjustment", "damage", "expiry",
];

export default function StockMovementsPage() {
  const [tableKey, setTableKey] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [dirFilter, setDirFilter] = useState("");

  const refreshData = useCallback(() => {
    setTableKey((prev) => prev + 1);
  }, []);

  const queryParams = new URLSearchParams();
  if (typeFilter) queryParams.set("movement_type", typeFilter);
  if (dirFilter) queryParams.set("direction", dirFilter);
  const endpoint = `/admin/inventory/stock-movements/table${queryParams.toString() ? `?${queryParams}` : ""}`;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Inventory</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Stock Movements</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ArrowDownUp size={24} className="text-indigo-500" /> Stock Movements
          </h1>
          <p className="text-xs text-slate-400 mt-1">Complete audit trail of all stock IN and OUT movements.</p>
        </div>
        <button onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Direction Filter */}
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {[{ val: "", label: "All" }, { val: "1", label: "↓ IN" }, { val: "-1", label: "↑ OUT" }].map((d) => (
            <button key={d.val} onClick={() => { setDirFilter(d.val); setTableKey((p) => p + 1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${dirFilter === d.val
                ? d.val === "1" ? "bg-emerald-600 text-white" : d.val === "-1" ? "bg-rose-600 text-white" : "bg-indigo-600 text-white"
                : "text-slate-500 hover:bg-slate-50"
                }`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {movementTypes.map((t) => (
            <button key={t} onClick={() => { setTypeFilter(t); setTableKey((p) => p + 1); }}
              className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-md capitalize ${typeFilter === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
                }`}>
              {t ? t.replace(/_/g, " ") : "All Types"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
          <Filter size={16} className="text-indigo-500" />
          <h2 className="font-bold text-gray-800">Movement History</h2>
        </div>
        <SkeletonTable key={tableKey} apiEndpoint={endpoint} initialPageSize={15} />
      </div>
    </div>
  );
}
