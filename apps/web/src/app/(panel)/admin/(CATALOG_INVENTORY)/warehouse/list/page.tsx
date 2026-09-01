"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Home,
  Warehouse as WarehouseIcon,
  ChevronLeft,
  Plus,
  PackageSearch,
  Sparkles,
  Check,
  Building2,
  Box,
} from "lucide-react";
import { api as apiClient } from "@/services/api.client";
import WarehouseSummaryCards from "@/components/warehouse/WarehouseSummaryCards";
import WarehouseToolbar from "@/components/warehouse/WarehouseToolbar";
import WarehouseCard, { WarehouseItem } from "@/components/warehouse/WarehouseCard";
import WarehouseListView from "@/components/warehouse/WarehouseListView";
import WarehouseModal from "@/components/warehouse/WarehouseModal";
import TableComponents from "@/components/Table Generator/TableComponents";

const API = "/admin/warehouses";

export default function WarehouseListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchIdParam = searchParams.get("branch_id") || "";
  const createParam = searchParams.get("create") === "true";

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Toolbar & Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at_desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);

  // Dedicated Warehouse Modal with MapPicker
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
  const [pendingMapWarehouse, setPendingMapWarehouse] = useState<WarehouseItem | null>(null);
  const [initialBranchId, setInitialBranchId] = useState<string>(branchIdParam);
  const [createdWarehouseForNextStep, setCreatedWarehouseForNextStep] = useState<{ id?: string | number; name: string; code?: string } | null>(null);

  // Auto-open create modal if create=true is in query
  useEffect(() => {
    if (createParam) {
      setModalMode("create");
      setSelectedWarehouse(null);
      if (branchIdParam) setInitialBranchId(branchIdParam);
      setModalOpen(true);
    }
  }, [createParam, branchIdParam]);

  // Listen for default edit form close to show map pin form next
  useEffect(() => {
    const handleEditClosed = () => {
      if (pendingMapWarehouse) {
        const wh = pendingMapWarehouse;
        setPendingMapWarehouse(null);
        setSelectedWarehouse(wh);
        setModalMode("edit");
        setModalOpen(true);
      }
    };

    window.addEventListener("table:edit:closed", handleEditClosed);
    return () => {
      window.removeEventListener("table:edit:closed", handleEditClosed);
    };
  }, [pendingMapWarehouse]);

  // Fetch warehouses table data from backend API
  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get<any>(`${API}/table?limit=100`);
      if (res.error) {
        setError(res.error);
        setWarehouses([]);
      } else {
        const rows = res.data?.data || res.data?.rows || res.data || [];
        setWarehouses(Array.isArray(rows) ? rows : []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load warehouse data");
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
    const handleRefresh = () => fetchWarehouses();
    window.addEventListener("table:refresh", handleRefresh);
    return () => {
      window.removeEventListener("table:refresh", handleRefresh);
    };
  }, [fetchWarehouses]);

  // Extract unique cities dynamically from fetched warehouses
  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    warehouses.forEach((w) => {
      if (w.city && w.city.trim()) {
        cities.add(w.city.trim());
      }
    });
    return Array.from(cities).sort();
  }, [warehouses]);

  // Calculate Summary Statistics
  const summary = useMemo(() => {
    const total = warehouses.length;
    let active = 0;
    let inactive = 0;
    let productsStored = 0;

    warehouses.forEach((w) => {
      const rawActive = String(w.is_active ?? "").toLowerCase();
      const isAct =
        w.is_active === true ||
        w.is_active === 1 ||
        rawActive === "1" ||
        rawActive === "true" ||
        rawActive === "t" ||
        rawActive === "active" ||
        rawActive.includes("badge-success") ||
        (rawActive.includes("active") && !rawActive.includes("inactive"));

      if (isAct) active++;
      else inactive++;

      productsStored += w.products_count ?? 0;
    });

    return {
      total,
      active,
      inactive,
      productsStored,
    };
  }, [warehouses]);

  // Filter & Sort warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses
      .filter((w) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = w.name?.toLowerCase().includes(q);
          const matchCode = w.code?.toLowerCase().includes(q);
          const matchBranch = w.branch_name?.toLowerCase().includes(q);
          const matchCity = w.city?.toLowerCase().includes(q);
          const matchManager = w.manager_name?.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchBranch && !matchCity && !matchManager) {
            return false;
          }
        }

        // Type Filter
        if (typeFilter !== "all") {
          const rawType = (w.warehouse_type || "").toLowerCase();
          if (typeFilter === "cold_storage" && !rawType.includes("cold")) return false;
          if (typeFilter === "dry_storage" && !rawType.includes("dry")) return false;
          if (
            typeFilter === "distribution_center" &&
            !rawType.includes("distribution") &&
            !rawType.includes("dc")
          )
            return false;
          if (typeFilter === "processing_unit" && !rawType.includes("processing")) return false;
          if (typeFilter === "temperature_controlled" && !rawType.includes("temp")) return false;
          if (typeFilter === "refrigerated" && !rawType.includes("refrig")) return false;
          if (typeFilter === "general" && rawType.includes("cold") && rawType.includes("dry")) return false;
        }

        // City Filter
        if (cityFilter !== "all") {
          if ((w.city || "").toLowerCase() !== cityFilter.toLowerCase()) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter !== "all") {
          const rawActive = String(w.is_active ?? "").toLowerCase();
          const isAct =
            w.is_active === true ||
            w.is_active === 1 ||
            rawActive === "1" ||
            rawActive === "true" ||
            rawActive === "t" ||
            rawActive === "active" ||
            rawActive.includes("badge-success") ||
            (rawActive.includes("active") && !rawActive.includes("inactive"));

          const isMaint = w.status === "maintenance";

          if (statusFilter === "active" && !isAct) return false;
          if (statusFilter === "inactive" && (isAct || isMaint)) return false;
          if (statusFilter === "maintenance" && !isMaint) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        if (sortBy === "name_desc") return b.name.localeCompare(a.name);
        if (sortBy === "code_asc") return (a.code || "").localeCompare(b.code || "");
        if (sortBy === "capacity_desc") {
          const capA = Number(a.capacity || 0);
          const capB = Number(b.capacity || 0);
          return capB - capA;
        }
        // created_at_desc
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [warehouses, searchQuery, typeFilter, cityFilter, statusFilter, sortBy]);

  // Paginated List
  const totalPages = Math.max(1, Math.ceil(filteredWarehouses.length / pageSize));
  const paginatedWarehouses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWarehouses.slice(start, start + pageSize);
  }, [filteredWarehouses, currentPage, pageSize]);

  // Handle Page Reset when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, cityFilter, statusFilter, sortBy]);

  // Action Triggers for Add/Edit/View
  const handleAddWarehouse = () => {
    setSelectedWarehouse(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleViewWarehouse = (warehouse: WarehouseItem) => {
    window.dispatchEvent(
      new CustomEvent("table:action", {
        detail: { type: "view", row: warehouse },
      })
    );
  };

  const handleEditWarehouse = (warehouse: WarehouseItem) => {
    // Show default edit form first; once closed, the new map pin form will show next
    setPendingMapWarehouse(warehouse);
    window.dispatchEvent(
      new CustomEvent("table:action", {
        detail: {
          type: "edit",
          id: String(warehouse.id || warehouse.warehouse_id),
          row: warehouse,
        },
      })
    );
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setCityFilter("all");
    setStatusFilter("all");
    setSortBy("created_at_desc");
  };

  return (
    <div className="space-y-4 p-2 md:p-4 font-sans min-h-screen bg-slate-50/50">
      {/* Breadcrumbs matching products page */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Inventory</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">Warehouse</span>
        </nav>

      {/* SUMMARY SECTION (6 METRIC CARDS) */}
      <WarehouseSummaryCards summary={summary} isLoading={loading} />

      {/* TOOLBAR (SEARCH, FILTERS, VIEW TOGGLE) */}
      <WarehouseToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddClick={handleAddWarehouse}
        cityOptions={cityOptions}
        totalResults={filteredWarehouses.length}
        onResetFilters={handleResetFilters}
      />

      {/* MAIN CONTENT AREA */}
      {loading ? (
        /* Loading Skeleton Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-pulse"
            >
              <div className="h-6 bg-slate-100 rounded-lg w-3/4" />
              <div className="h-16 bg-slate-100 rounded-xl" />
              <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center space-y-3">
          <p className="font-semibold text-sm">{error}</p>
          <button
            type="button"
            onClick={fetchWarehouses}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-rose-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredWarehouses.length === 0 ? (
        /* EMPTY STATE */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 md:p-16 text-center max-w-xl mx-auto space-y-4"
        >
          <div className="w-20 h-20 bg-emerald-50 text-[#16a34a] rounded-3xl flex items-center justify-center mx-auto border border-emerald-100/80 shadow-inner">
            <PackageSearch className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              No Warehouses Found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              We couldn&apos;t find any warehouse matching your current search or filter criteria. Try resetting filters or register a new facility.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={handleAddWarehouse}
              className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Add Warehouse</span>
            </button>
          </div>
        </motion.div>
      ) : viewMode === "grid" ? (
        /* RESPONSIVE GRID LAYOUT (3 Desktop, 2 Tablet, 1 Mobile) */
        <AnimatePresence mode="wait">
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {paginatedWarehouses.map((warehouse) => (
              <WarehouseCard
                key={warehouse.id}
                warehouse={warehouse}
                onView={handleViewWarehouse}
                onEdit={handleEditWarehouse}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      ) : (
        /* RESPONSIVE LIST VIEW */
        <AnimatePresence mode="wait">
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WarehouseListView
              warehouses={paginatedWarehouses}
              onView={handleViewWarehouse}
              onEdit={handleEditWarehouse}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* MODERN PAGINATION */}
      {filteredWarehouses.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span>Showing per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                    ? "bg-[#16a34a] text-white shadow-sm shadow-emerald-600/20"
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

      {/* DEDICATED WAREHOUSE MODAL WITH GOOGLE MAP PIN PICKER */}
      <WarehouseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(savedData) => {
          fetchWarehouses();
          if (modalMode === "create" && savedData) {
            setCreatedWarehouseForNextStep({
              id: savedData.id || savedData.warehouse_id,
              name: savedData.name || "New Warehouse",
              code: savedData.code,
            });
          }
        }}
        mode={modalMode}
        warehouse={selectedWarehouse}
        initialBranchId={initialBranchId}
      />

      {/* Stage 2 -> Stage 3 Lifecycle Guided Modal */}
      {createdWarehouseForNextStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
              <WarehouseIcon size={32} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 text-emerald-800 text-xs font-bold mb-2">
                <Check size={12} /> Stage 2 Complete: Warehouse Configured
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                "{createdWarehouseForNextStep.name}" is Ready!
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                To prepare for deliveries and customer dispatch, you need to <strong>Update &amp; Allocate Storage Containers / Crates</strong> to this warehouse hub.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="font-semibold text-emerald-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                Next Step: Update Containers Master
              </div>
              <p className="text-slate-500 pl-7 text-[11px]">
                Assign milk cans, glass bottle crates, and insulated delivery bags to this warehouse.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreatedWarehouseForNextStep(null)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  const whId = createdWarehouseForNextStep.id || createdWarehouseForNextStep.code || "";
                  setCreatedWarehouseForNextStep(null);
                  router.push(`/admin/packages/dashboard?warehouse_id=${whId}`);
                }}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Update Containers <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMS & DRAWERS (VIEW, EDIT, DELETE) */}
      <TableComponents
        title="Warehouse"
        apiBase={API}
        actionTypes={["view", "edit", "delete"]}
        modalsOnly={true}
      />
    </div>
  );
}