"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Warehouse, RefreshCw, Home, ChevronRight, Package,
  AlertTriangle, CheckCircle2, TrendingDown, Filter
} from "lucide-react";
import Link from "next/link";
import SkeletonTable from "@/components/Table Generator/SkeletonTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface StockStats {
  total_variants: number;
  out_of_stock: number;
  low_stock: number;
  in_stock: number;
  total_stock_value: number;
  total_available: number;
  total_reserved: number;
  total_dispatched: number;
}

export default function WarehouseStockPage() {
  const [stats, setStats] = useState<StockStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [tableKey, setTableKey] = useState(0);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/inventory/stats`, { credentials: "include" });
      const result = await res.json();
      if (result.status) setStats(result.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const refreshData = useCallback(() => {
    setTableKey((prev) => prev + 1);
    fetchStats();
  }, []);

  const statCards = [
    { title: "Available", value: stats?.total_available?.toLocaleString("en-IN") ?? "0", icon: Package, textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
    { title: "Reserved", value: stats?.total_reserved?.toLocaleString("en-IN") ?? "0", icon: AlertTriangle, textColor: "text-amber-600", bgColor: "bg-amber-50" },
    { title: "Dispatched", value: stats?.total_dispatched?.toLocaleString("en-IN") ?? "0", icon: TrendingDown, textColor: "text-blue-600", bgColor: "bg-blue-50" },
    { title: "In Stock", value: stats?.in_stock ?? 0, icon: CheckCircle2, textColor: "text-green-600", bgColor: "bg-green-50" },
    { title: "Out of Stock", value: stats?.out_of_stock ?? 0, icon: AlertTriangle, textColor: "text-rose-600", bgColor: "bg-rose-50" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <Home size={14} /> Dashboard
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Inventory</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Warehouse Stock</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Warehouse size={24} className="text-emerald-500" /> Warehouse Stock
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time warehouse-wise stock levels with available, reserved, and dispatched quantities.
          </p>
        </div>
        <button onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-xl ${card.bgColor} ${card.textColor} group-hover:scale-110 transition-transform`}>
                <card.icon size={18} />
              </div>
            </div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{card.title}</p>
            <h3 className="text-lg font-bold text-gray-800 mt-0.5">
              {loadingStats ? <div className="h-6 w-16 bg-gray-100 animate-pulse rounded" /> : card.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Warehouse Stock Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Filter size={16} className="text-emerald-500" />
            Stock by Warehouse & Product
          </h2>
        </div>
        <SkeletonTable
          key={tableKey}
          apiEndpoint="/admin/inventory/warehouse/table"
          initialPageSize={10}
        />
      </div>
    </div>
  );
}
