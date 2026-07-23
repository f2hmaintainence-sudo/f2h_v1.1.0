'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home,
  ChevronRight,
  Archive,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';
import { api } from '@/services/api.client';

import WarehouseSelector from '@/components/inventory/WarehouseSelector';
import InventorySummaryCards from '@/components/inventory/InventorySummaryCards';
import InventoryStatusBanner from '@/components/inventory/InventoryStatusBanner';
import InventoryHealthChart from '@/components/inventory/InventoryHealthChart';
import StockMovementChart from '@/components/inventory/StockMovementChart';
import RecentActivityTimeline from '@/components/inventory/RecentActivityTimeline';
import LowStockCards from '@/components/inventory/LowStockCards';

interface Stats {
  total_variants: number;
  out_of_stock: number;
  low_stock: number;
  total_stock_value: number;
  in_stock: number;
}

interface RawMovement {
  movement_id: string;
  movement_type: string;
  direction: number;
  quantity: number;
  warehouse_name: string;
  product_name: string;
  variant_name: string;
  created_at: string;
}

interface LowStockRaw {
  warehouse_id: string;
  warehouse_name: string;
  product_variant_id: string;
  variant_name: string;
  product_name: string;
  available_quantity: number;
  low_stock_threshold: number;
  is_out_of_stock: boolean;
}

interface MovementPoint {
  day: string;
  stockIn: number;
  stockOut: number;
}

// Build 30-day chart data — always produces Day 1→Day 30 labels.
// Real movement records are bucketed by calendar day and merged in.
function buildChartData(movements: RawMovement[]): MovementPoint[] {
  // Build a map of calendar-day → { in, out } from real records
  const dayMap: Record<string, { stockIn: number; stockOut: number }> = {};
  const now = new Date();

  movements.forEach((m) => {
    const d = new Date(m.created_at);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays < 0 || diffDays > 29) return; // outside 30-day window
    const dayIndex = 29 - diffDays; // 0 = 30 days ago, 29 = today
    const key = String(dayIndex);
    if (!dayMap[key]) dayMap[key] = { stockIn: 0, stockOut: 0 };
    if (m.direction === 1) dayMap[key].stockIn  += Number(m.quantity);
    else                   dayMap[key].stockOut += Number(m.quantity);
  });

  // Generate 30 points; only label Day 1, 5, 10, 15, 20, 25, 30
  const labelSet = new Set([0, 4, 9, 14, 19, 24, 29]);
  return Array.from({ length: 30 }, (_, i) => ({
    day: labelSet.has(i) ? `Day ${i + 1}` : '',
    stockIn:  dayMap[String(i)]?.stockIn  ?? 0,
    stockOut: dayMap[String(i)]?.stockOut ?? 0,
  }));
}


// Map low-stock API rows to LowStockCards format
function mapLowStockItems(rows: LowStockRaw[]) {
  return rows.map((r) => ({
    id: r.product_variant_id,
    productName: r.product_name,
    sku: r.product_variant_id,
    warehouse: r.warehouse_name,
    availableQty: Number(r.available_quantity),
    reorderLevel: Number(r.low_stock_threshold),
    status: (r.is_out_of_stock ? 'critical' : 'low') as 'critical' | 'low',
  }));
}

const POLL_INTERVAL = 30_000; // 30 seconds

export default function InventoryOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [dashboardData, setDashboardData] = useState<{
    recent_movements: RawMovement[];
    low_stock_alerts: LowStockRaw[];
  } | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [tableKey, setTableKey] = useState(0);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch KPI stats ─────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const endpoint = `/admin/inventory/stats${selectedWarehouse ? `?warehouse_id=${selectedWarehouse}` : ''}`;
      const res = await api.get<any>(endpoint);
      if (res.data?.status) setStats(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoadingStats(false);
    }
  }, [selectedWarehouse]);

  // ── Fetch dashboard (charts + activity + low-stock) ─────
  const fetchDashboard = useCallback(async () => {
    try {
      const endpoint = `/admin/inventory/dashboard${selectedWarehouse ? `?warehouse_id=${selectedWarehouse}` : ''}`;
      const res = await api.get<any>(endpoint);
      if (res.data?.status) {
        setDashboardData({
          recent_movements: res.data.data.recent_movements ?? [],
          low_stock_alerts: res.data.data.low_stock_alerts ?? [],
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoadingDashboard(false);
    }
  }, [selectedWarehouse]);

  // ── Load warehouse list once ─────────────────────────────
  useEffect(() => {
    api
      .get<any>('/admin/warehouses/active/list')
      .then((res) => {
        if (res.data?.data) setWarehouses(res.data.data);
      })
      .catch(() => {});
  }, []);

  // ── Re-fetch stats when warehouse changes ────────────────
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Initial dashboard fetch + polling ───────────────────
  useEffect(() => {
    fetchDashboard();
    pollRef.current = setInterval(fetchDashboard, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDashboard]);

  // ── Manual refresh (all data + table) ───────────────────
  const refreshData = useCallback(() => {
    setTableKey((p) => p + 1);
    fetchStats();
    fetchDashboard();
  }, [fetchStats, fetchDashboard]);

  const chartData = buildChartData(dashboardData?.recent_movements ?? []);
  const lowStockItems = mapLowStockItems(dashboardData?.low_stock_alerts ?? []);

  return (
    <div className="space-y-5 p-4 md:p-6 font-sans bg-slate-50/50 min-h-screen">

      {/* 1. Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium" aria-label="Breadcrumb">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} />
          <span>Dashboard</span>
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Stock Overview</span>
      </nav>

      {/* 2. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#16a34a]" />
            Stock Overview
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time summary of your inventory levels, values, and facility stock records.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 self-start md:self-auto"
        >
          <RotateCcw size={14} className="text-slate-500" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* 3. Warehouse Selector */}
      {warehouses.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <WarehouseSelector
            warehouses={warehouses}
            selectedWarehouse={selectedWarehouse}
            onSelectWarehouse={setSelectedWarehouse}
          />
        </div>
      )}

      {/* 4. KPI Summary Cards */}
      <InventorySummaryCards stats={stats} isLoading={loadingStats} />

      {/* 5. Status Banner */}
      <InventoryStatusBanner
        lowStockCount={stats?.low_stock || 0}
        outOfStockCount={stats?.out_of_stock || 0}
      />

      {/* 6. Charts Row — Inventory Health + Stock Movement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InventoryHealthChart
          inStock={stats?.in_stock ?? 0}
          lowStock={stats?.low_stock ?? 0}
          outOfStock={stats?.out_of_stock ?? 0}
        />
        <StockMovementChart data={chartData} isLoading={loadingDashboard} />
      </div>

      {/* 7. Activity + Low Stock Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <RecentActivityTimeline
            movements={dashboardData?.recent_movements}
            isLoading={loadingDashboard}
          />
        </div>
        <div className="lg:col-span-3">
          <LowStockCards
            items={lowStockItems}
            onRestock={() => window.dispatchEvent(new CustomEvent('table:add'))}
          />
        </div>
      </div>

      {/* 8. Current Stock Inventory Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Archive size={16} className="text-[#16a34a]" />
            Current Stock Inventory
          </h2>
          <button
            type="button"
            onClick={refreshData}
            className="text-xs font-bold text-[#16a34a] hover:text-[#15803d] transition-colors flex items-center gap-1"
          >
            <RotateCcw size={12} />
            <span>Refresh Data</span>
          </button>
        </div>
        <SkeletonTable
          key={tableKey + (selectedWarehouse ? `-${selectedWarehouse}` : '')}
          apiEndpoint={
            selectedWarehouse
              ? `/admin/inventory/table?warehouse_id=${selectedWarehouse}`
              : `/admin/inventory/table`
          }
          initialPageSize={10}
        />
      </div>
    </div>
  );
}
