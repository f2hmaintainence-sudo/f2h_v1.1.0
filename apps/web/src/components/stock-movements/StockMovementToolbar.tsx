"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Search,
  LayoutGrid,
  List,
  GitCommitHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Warehouse as WarehouseIcon,
  ChevronDown,
} from "lucide-react";

interface WarehouseOption {
  id: string | number;
  warehouse_id: string;
  name: string;
}

interface StockMovementToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  movementTypeFilter: string;
  setMovementTypeFilter: (val: string) => void;
  directionFilter: string;
  setDirectionFilter: (val: string) => void;
  selectedWarehouse: string;
  setSelectedWarehouse: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  viewMode: "grid" | "timeline" | "list";
  setViewMode: (mode: "grid" | "timeline" | "list") => void;
  warehouses: WarehouseOption[];
  totalResults: number;
}

// Show up to this many warehouse pills inline; the rest go in a dropdown
const MAX_INLINE_WAREHOUSES = 4;

export default function StockMovementToolbar({
  searchQuery,
  setSearchQuery,
  movementTypeFilter,
  setMovementTypeFilter,
  directionFilter,
  setDirectionFilter,
  selectedWarehouse,
  setSelectedWarehouse,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  warehouses,
  totalResults,
}: StockMovementToolbarProps) {
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    movementTypeFilter !== "all" ||
    directionFilter !== "all" ||
    selectedWarehouse !== "";

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const clearFilters = () => {
    setSearchQuery("");
    setMovementTypeFilter("all");
    setDirectionFilter("all");
    setSelectedWarehouse("");
    setSortBy("newest");
  };

  const inlineWarehouses = warehouses.slice(0, MAX_INLINE_WAREHOUSES);
  const overflowWarehouses = warehouses.slice(MAX_INLINE_WAREHOUSES);
  const hasOverflow = overflowWarehouses.length > 0;

  // The selected warehouse name (for the overflow dropdown label)
  const selectedInOverflow = overflowWarehouses.find(
    (w) => w.warehouse_id === selectedWarehouse
  );

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-3 md:p-4 shadow-xs space-y-3">
      {/* Top Bar: Search + View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Movement ID, Product, Variant, Batch..."
            className="w-full pl-10 pr-9 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/30 focus:border-[#2E7D32] transition-all font-medium placeholder:text-slate-400 text-slate-900"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View Switcher Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "timeline"
              ? "bg-white text-[#2E7D32] shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
              }`}
            title="Timeline Audit Trail"
          >
            <GitCommitHorizontal size={14} />
            <span className="hidden sm:inline">Timeline</span>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "grid"
              ? "bg-white text-[#2E7D32] shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
              }`}
            title="Grid Card View"
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "list"
              ? "bg-white text-[#2E7D32] shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
              }`}
            title="Table List View"
          >
            <List size={14} />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Warehouse Filter Row — scalable pills + overflow dropdown */}
      {warehouses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* All Warehouses pill */}
          <button
            onClick={() => setSelectedWarehouse("")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border ${selectedWarehouse === ""
              ? "bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs"
              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
          >
            All Warehouses
          </button>

          {/* Inline pills — up to MAX_INLINE_WAREHOUSES */}
          {inlineWarehouses.map((w) => (
            <button
              key={w.warehouse_id || w.id}
              onClick={() => setSelectedWarehouse(w.warehouse_id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border flex items-center gap-1.5 ${selectedWarehouse === w.warehouse_id
                ? "bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 hover:text-slate-900"
                }`}
            >
              <WarehouseIcon size={11} className="opacity-80" />
              <span>{w.name}</span>
            </button>
          ))}

          {/* Overflow dropdown — "+N more" */}
          {hasOverflow && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border flex items-center gap-1.5 ${selectedInOverflow
                  ? "bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs"
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
              >
                <WarehouseIcon size={11} className="opacity-80" />
                <span>
                  {selectedInOverflow
                    ? selectedInOverflow.name
                    : `+${overflowWarehouses.length} more`}
                </span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[180px] py-1 overflow-hidden">
                  {overflowWarehouses.map((w) => (
                    <button
                      key={w.warehouse_id || w.id}
                      onClick={() => {
                        setSelectedWarehouse(w.warehouse_id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${selectedWarehouse === w.warehouse_id
                        ? "bg-[#E8F5E9] text-[#2E7D32]"
                        : "text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      <WarehouseIcon size={12} className="shrink-0 opacity-70" />
                      <span className="truncate">{w.name}</span>
                      {selectedWarehouse === w.warehouse_id && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2E7D32] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Movement Direction Filter */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs">
            <button
              onClick={() => setDirectionFilter("all")}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${directionFilter === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              All Directions
            </button>
            <button
              onClick={() => setDirectionFilter("in")}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all flex items-center gap-1 ${directionFilter === "in"
                ? "bg-[#2E7D32] text-white shadow-xs"
                : "text-[#2E7D32] hover:bg-emerald-50"
                }`}
            >
              <ArrowDownLeft size={12} />
              <span>Stock IN</span>
            </button>
            <button
              onClick={() => setDirectionFilter("out")}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all flex items-center gap-1 ${directionFilter === "out"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-700 hover:bg-amber-50"
                }`}
            >
              <ArrowUpRight size={12} />
              <span>Stock OUT</span>
            </button>
          </div>

          {/* Movement Type Select */}
          <select
            value={movementTypeFilter}
            onChange={(e) => setMovementTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 text-slate-700"
          >
            <option value="all">All Movement Types</option>
            <option value="stock_in">Stock In</option>
            <option value="stock_out">Stock Out</option>
            <option value="transfer_in">Transfer In</option>
            <option value="transfer_out">Transfer Out</option>
            <option value="damage">Damage</option>
            <option value="expiry">Expiry</option>
            <option value="return">Return</option>
            <option value="adjustment">Adjustment</option>
          </select>

          {/* Sort By Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 text-slate-700"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="qty_desc">Highest Quantity</option>
            <option value="qty_asc">Lowest Quantity</option>
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-800">{totalResults}</span> movements
        </div>
      </div>
    </div>
  );
}
