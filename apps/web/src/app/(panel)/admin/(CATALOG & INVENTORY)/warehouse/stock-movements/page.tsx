"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Home,
  Plus,
  ArrowRightLeft,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { api as apiClient } from "@/services/api.client";
import TableComponents from "@/components/Table Generator/TableComponents";
import StockMovementSummaryCards, {
  StockMovementItem,
} from "@/components/stock-movements/StockMovementSummaryCards";
import StockMovementToolbar from "@/components/stock-movements/StockMovementToolbar";
import StockMovementCardsView from "@/components/stock-movements/StockMovementCardsView";
import StockMovementTimelineView from "@/components/stock-movements/StockMovementTimelineView";

const API = "/admin/warehouses/stock-movements";

export default function WarehouseStockPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "timeline" | "list">("timeline");

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);

  // Fetch active warehouses
  useEffect(() => {
    apiClient
      .get<any>("/admin/warehouses/active/list")
      .then((res) => {
        if (res.data?.data) {
          setWarehouses(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch stock movements data for cards & timeline
  const fetchMovements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url = `${API}/table?limit=500`;
      if (selectedWarehouse) {
        url += `&warehouse_id=${selectedWarehouse}`;
      }
      const res = await apiClient.get<any>(url);
      if (res.error) {
        setError(res.error);
        setMovements([]);
      } else {
        const rows = res.data?.data || res.data?.rows || res.data || [];
        setMovements(Array.isArray(rows) ? rows : []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load stock movements data");
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    fetchMovements();
    const handleRefresh = () => fetchMovements();
    window.addEventListener("table:refresh", handleRefresh);
    return () => {
      window.removeEventListener("table:refresh", handleRefresh);
    };
  }, [fetchMovements]);

  // Reset to page 1 when filters or view mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, directionFilter, movementTypeFilter, sortBy, viewMode, selectedWarehouse]);

  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent("table:add"));
  };

  const handleView = (movement: StockMovementItem) => {
    window.dispatchEvent(
      new CustomEvent("table:action", {
        detail: { type: "view", id: String(movement.id), row: movement },
      })
    );
  };

  const handleEdit = (movement: StockMovementItem) => {
    window.dispatchEvent(
      new CustomEvent("table:action", {
        detail: { type: "edit", id: String(movement.id), row: movement },
      })
    );
  };

  // Filter & Sort logic for Grid and Timeline views
  const filteredMovements = useMemo(() => {
    return movements
      .filter((m) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = String(m.movement_id || m.id || "").toLowerCase().includes(q);
          const matchProduct = (m.product_name || "").toLowerCase().includes(q);
          const matchVariant = (m.variant_name || "").toLowerCase().includes(q);
          const matchBatch = (m.batch_id || "").toLowerCase().includes(q);
          const matchWh = (m.warehouse_name || "").toLowerCase().includes(q);
          if (!matchId && !matchProduct && !matchVariant && !matchBatch && !matchWh) {
            return false;
          }
        }
        if (directionFilter !== "all") {
          const dir = String(m.direction || "").toUpperCase();
          const isIngress =
            dir === "1" || dir === "IN" || dir.includes("SUCCESS") || dir.includes("IN");
          if (directionFilter === "in" && !isIngress) return false;
          if (directionFilter === "out" && isIngress) return false;
        }
        if (movementTypeFilter !== "all") {
          const mType = (m.movement_type || "").toLowerCase();
          if (mType !== movementTypeFilter.toLowerCase()) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "qty_desc") return Number(b.quantity || 0) - Number(a.quantity || 0);
        if (sortBy === "qty_asc") return Number(a.quantity || 0) - Number(b.quantity || 0);
        if (sortBy === "oldest")
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [movements, searchQuery, directionFilter, movementTypeFilter, sortBy]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, currentPage, pageSize]);

  return (
    <div className="space-y-4 p-2 md:p-4 font-sans min-h-screen bg-slate-50/50">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
        >
          <Home size={14} />
          <span>Dashboard</span>
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Inventory &amp; Warehouse</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-deep-green">Stock In / Out</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#E8F5E9] text-[#2E7D32] rounded-xl border border-[#C8E6C9]">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Stock In / Out Hub
              <Sparkles size={16} className="text-[#2E7D32]" />
            </h1>
            <p className="text-xs text-slate-500">
              Track, audit, and log inventory movements, transfers, and stock ingress/egress.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-md shadow-[#2E7D32]/20 transition-all hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Add Stock Movement</span>
        </button>
      </div>

      {/* Summary Cards */}
      <StockMovementSummaryCards movements={movements} loading={loading} />

      {/* Interactive Toolbar */}
      <StockMovementToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        movementTypeFilter={movementTypeFilter}
        setMovementTypeFilter={setMovementTypeFilter}
        directionFilter={directionFilter}
        setDirectionFilter={setDirectionFilter}
        selectedWarehouse={selectedWarehouse}
        setSelectedWarehouse={setSelectedWarehouse}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        warehouses={warehouses}
        totalResults={filteredMovements.length}
      />

      {/* Grid Card View */}
      {viewMode === "grid" && (
        <StockMovementCardsView
          movements={paginatedMovements}
          loading={loading}
          onView={handleView}
          onEdit={handleEdit}
          onResetFilters={() => {
            setSearchQuery("");
            setMovementTypeFilter("all");
            setDirectionFilter("all");
            setSelectedWarehouse("");
          }}
        />
      )}

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <StockMovementTimelineView
          movements={paginatedMovements}
          loading={loading}
          onView={handleView}
          onEdit={handleEdit}
        />
      )}

      {/* PAGINATION — same as Warehouse page */}
      {(viewMode === "grid" || viewMode === "timeline") && filteredMovements.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span>Showing per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20"
            >
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  currentPage === page
                    ? "bg-[#2E7D32] text-white shadow-sm shadow-[#2E7D32]/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table List View using existing TableComponents */}
      <div className={viewMode === "list" ? "block" : "hidden"}>
        <TableComponents
          title=""
          endpoints={{
            table: selectedWarehouse
              ? `${API}/table?warehouse_id=${selectedWarehouse}`
              : `${API}/table`,
            showAdd: `${API}/showAdd`,
            saveAdd: `${API}/saveAdd`,
            showEdit: (id: string) => `${API}/${id}/showEdit`,
            saveEdit: (id: string) => `${API}/${id}/saveEdit`,
            view: (id: string) => `${API}/${id}/view`,
          }}
          identifierKey="id"
          enableCardView={false}
          actionTypes={["view", "edit"]}
        />
      </div>

      {/* Modal handler instance when non-list view is active */}
      {viewMode !== "list" && (
        <TableComponents
          title=""
          endpoints={{
            table: selectedWarehouse
              ? `${API}/table?warehouse_id=${selectedWarehouse}`
              : `${API}/table`,
            showAdd: `${API}/showAdd`,
            saveAdd: `${API}/saveAdd`,
            showEdit: (id: string) => `${API}/${id}/showEdit`,
            saveEdit: (id: string) => `${API}/${id}/saveEdit`,
            view: (id: string) => `${API}/${id}/view`,
          }}
          identifierKey="id"
          modalsOnly={true}
        />
      )}
    </div>
  );
}
