"use client";

import React from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
} from "lucide-react";

interface WarehouseToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onAddClick: () => void;
  cityOptions: string[];
  totalResults: number;
  onResetFilters: () => void;
}

export default function WarehouseToolbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  cityFilter,
  onCityFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onAddClick,
  cityOptions,
  totalResults,
  onResetFilters,
}: WarehouseToolbarProps) {
  const hasActiveFilters =
    searchQuery !== "" ||
    typeFilter !== "all" ||
    cityFilter !== "all" ||
    statusFilter !== "all" ||
    sortBy !== "created_at_desc";

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
      {/* Top Main Toolbar Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Inputs Group */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none flex-1">
          {/* Search Box */}
          <div className="relative min-w-[180px] max-w-[240px] flex-1 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search warehouse..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Type Filter */}
          <div className="relative shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-7"
            >
              <option value="all">All Types</option>
              <option value="cold_storage">Cold Storage</option>
              <option value="dry_storage">Dry Storage</option>
              <option value="distribution_center">Distribution Center</option>
              <option value="processing_unit">Processing Unit</option>
              <option value="temperature_controlled">Temp. Controlled</option>
              <option value="refrigerated">Refrigerated</option>
              <option value="general">General</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* City Filter */}
          <div className="relative shrink-0">
            <select
              value={cityFilter}
              onChange={(e) => onCityFilterChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-7"
            >
              <option value="all">All Cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-7"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-7"
            >
              <option value="created_at_desc">Newest First</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="code_asc">Code (Asc)</option>
              <option value="capacity_desc">Highest Capacity</option>
            </select>
            <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "grid"
                  ? "bg-white text-[#16a34a] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === "list"
                  ? "bg-white text-[#16a34a] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Add Warehouse Button */}
          <button
            type="button"
            onClick={onAddClick}
            className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Warehouse</span>
          </button>
        </div>
      </div>

      {/* Bottom Counter Row with Reset Button */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 font-medium border-t border-slate-100/80">
        <span>
          Showing <strong className="text-slate-900 font-bold">{totalResults}</strong>{" "}
          warehouses
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shrink-0 border border-slate-200/80"
            title="Reset all filters"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}
