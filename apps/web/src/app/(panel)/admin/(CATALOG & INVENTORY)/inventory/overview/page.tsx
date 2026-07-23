'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  IndianRupee,
  Home,
  ChevronRight,
  Archive,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';
import { api } from '@/services/api.client';

interface Stats {
  total_variants: number;
  out_of_stock: number;
  low_stock: number;
  total_stock_value: number;
  in_stock: number;
}

export default function InventoryOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [tableKey, setTableKey] = useState(0);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const endpoint = `/admin/inventory/stats${selectedWarehouse ? `?warehouse_id=${selectedWarehouse}` : ''}`;
      const res = await api.get<any>(endpoint);
      if (res.data?.status) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch inventory stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    api.get<any>('/admin/warehouses/active/list')
      .then(res => {
        if (res.data?.data) {
          setWarehouses(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedWarehouse]);

  const refreshData = useCallback(() => {
    setTableKey(prev => prev + 1);
    fetchStats();
  }, [selectedWarehouse]);

  const statCards = [
    {
      title: 'Total Variants',
      value: stats?.total_variants || 0,
      icon: Package,
      gradient: 'from-blue-500/10 to-indigo-500/5 text-blue-600 border-blue-100',
      iconBg: 'bg-blue-100 text-blue-700'
    },
    {
      title: 'In Stock',
      value: stats?.in_stock || 0,
      icon: CheckCircle2,
      gradient: 'from-emerald-500/10 to-teal-500/5 text-emerald-600 border-emerald-100',
      iconBg: 'bg-emerald-100 text-emerald-700'
    },
    {
      title: 'Low Stock',
      value: stats?.low_stock || 0,
      icon: AlertTriangle,
      gradient: 'from-amber-500/10 to-yellow-500/5 text-amber-600 border-amber-100',
      iconBg: 'bg-amber-100 text-amber-700'
    },
    {
      title: 'Out of Stock',
      value: stats?.out_of_stock || 0,
      icon: TrendingUp,
      gradient: 'from-rose-500/10 to-red-500/5 text-rose-600 border-rose-100',
      iconBg: 'bg-rose-100 text-rose-700'
    },
    {
      title: 'Total Value',
      value: `₹${Number(stats?.total_stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: IndianRupee,
      gradient: 'from-violet-500/10 to-purple-500/5 text-violet-600 border-violet-100',
      iconBg: 'bg-violet-100 text-violet-700'
    }
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 font-sans bg-[#f8fafc] min-h-screen">
      {/* Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Inventory</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-slate-800">Stock Overview</span>
        </nav>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-emerald-500" size={24} />
            Stock Overview
          </h1>
          <p className="text-xs text-slate-400">Real-time summary of your inventory levels, values, and alerts.</p>
        </div>
      </div>

      {/* Warehouse Filter Tabs */}
      {warehouses.length > 0 && (
        <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit shadow-sm">
          <button
            onClick={() => setSelectedWarehouse("")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${selectedWarehouse === "" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
          >
            All Warehouses
          </button>
          {warehouses.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWarehouse(w.warehouse_id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${selectedWarehouse === w.warehouse_id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className={`bg-gradient-to-br ${card.gradient} p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md hover:scale-[1.02] flex flex-col justify-between h-32`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">{card.title}</span>
              <div className={`p-2 rounded-xl ${card.iconBg}`}>
                <card.icon size={16} />
              </div>
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black tracking-tight mt-2">
                {loadingStats ? (
                  <div className="h-8 w-20 bg-slate-900/10 animate-pulse rounded" />
                ) : (
                  card.value
                )}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Archive size={18} className="text-emerald-500" />
            Current Stock Inventory
          </h2>
          <button
            onClick={refreshData}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            Refresh Data
          </button>
        </div>
        <SkeletonTable
          key={tableKey + (selectedWarehouse ? `-${selectedWarehouse}` : '')}
          apiEndpoint={selectedWarehouse ? `/admin/inventory/table?warehouse_id=${selectedWarehouse}` : `/admin/inventory/table`}
          initialPageSize={10}
        />
      </div>
    </div>
  );
}
