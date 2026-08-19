"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Building,
  User,
  Phone,
  Eye,
  Edit3,
  HardDrive,
  Thermometer,
} from "lucide-react";
import { WarehouseItem } from "./WarehouseCard";

interface WarehouseListViewProps {
  warehouses: WarehouseItem[];
  onView: (warehouse: WarehouseItem) => void;
  onEdit: (warehouse: WarehouseItem) => void;
}

export default function WarehouseListView({
  warehouses,
  onView,
  onEdit,
}: WarehouseListViewProps) {
  const handleAction = (type: "view" | "edit", warehouse: WarehouseItem) => {
    if (type === "view") {
      onView(warehouse);
    } else {
      onEdit(warehouse);
    }
    window.dispatchEvent(
      new CustomEvent("table:action", {
        detail: { type, id: String(warehouse.id), row: warehouse },
      })
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
      {warehouses.map((warehouse, idx) => {
        const rawActive = String(warehouse.is_active ?? "").toLowerCase();
        const isActive =
          warehouse.is_active === true ||
          warehouse.is_active === 1 ||
          rawActive === "1" ||
          rawActive === "true" ||
          rawActive === "t" ||
          rawActive === "active" ||
          rawActive.includes("badge-success") ||
          (rawActive.includes("active") && !rawActive.includes("inactive"));

        const isMaintenance = warehouse.status === "maintenance";

        const statusBadge = isMaintenance
          ? { label: "Maintenance", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" }
          : isActive
          ? { label: "Active", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" }
          : { label: "Inactive", bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" };

        const utilization = warehouse.utilization_percent ?? 0;
        const productsStored = warehouse.products_count ?? 0;

        const formattedCapacity = warehouse.capacity
          ? `${Number(warehouse.capacity).toLocaleString()} ${warehouse.capacity_unit || "ltr"}`
          : "N/A";

        const formattedTemp = warehouse.temperature_type
          ? warehouse.temperature_type.charAt(0).toUpperCase() + warehouse.temperature_type.slice(1)
          : "Standard";

        return (
          <motion.div
            key={warehouse.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: idx * 0.02 }}
            className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
          >
            {/* Main Info (Left Column) */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#16a34a] transition-colors">
                  {warehouse.name}
                </h4>
                {warehouse.code && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono font-medium text-slate-600">
                    {warehouse.code}
                  </span>
                )}
                {warehouse.branch_name && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                    Branch: {warehouse.branch_name}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                  {statusBadge.label}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {warehouse.city || "Kuppam"}, {warehouse.state || "AP"}
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {warehouse.warehouse_type || "Cold Storage"}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {warehouse.manager_name || "Manager"}
                </span>
                {warehouse.manager_phone && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {warehouse.manager_phone}
                  </span>
                )}
              </div>
            </div>

            {/* Metrics & Storage (Middle Column) */}
            <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
              {/* Capacity */}
              <div className="text-left">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-purple-700 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-purple-600" />
                  Capacity
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {formattedCapacity}
                </span>
              </div>

              {/* Temperature */}
              <div className="text-left hidden sm:block">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-cyan-700 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-cyan-600" />
                  Temp
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {formattedTemp}
                </span>
              </div>

              {/* Products */}
              <div className="text-left hidden sm:block">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Products
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {productsStored}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-28 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-600">
                  <span>Used</span>
                  <span className="font-semibold">{utilization}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${utilization}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons (View & Edit) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAction("view", warehouse)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("edit", warehouse)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  title="Edit Warehouse"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
