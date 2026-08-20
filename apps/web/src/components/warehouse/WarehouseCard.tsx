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
} from "lucide-react";
import WarehouseStats from "./WarehouseStats";

export interface WarehouseItem {
  id: string | number;
  warehouse_id?: string;
  name: string;
  code?: string;
  branch_id?: string;
  branch_name?: string;
  warehouse_type?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  is_active?: boolean | string | number;
  status?: "active" | "inactive" | "maintenance" | string;
  created_at?: string;
  capacity?: number | string;
  capacity_unit?: string;
  temperature_type?: string;
  notes?: string;
  utilization_percent?: number;
  products_count?: number;
  stock_in_today?: number;
  stock_out_today?: number;
}

interface WarehouseCardProps {
  warehouse: WarehouseItem;
  onView: (warehouse: WarehouseItem) => void;
  onEdit: (warehouse: WarehouseItem) => void;
  onDelete?: (warehouse: WarehouseItem) => void;
}

export default function WarehouseCard({
  warehouse,
  onView,
  onEdit,
}: WarehouseCardProps) {
  // Active Status Detection
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
    ? {
        label: "Maintenance",
        bg: "bg-amber-50 text-amber-700 border-amber-200/80",
        dot: "bg-amber-500",
      }
    : isActive
    ? {
        label: "Active",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        dot: "bg-emerald-500 animate-pulse",
      }
    : {
        label: "Inactive",
        bg: "bg-rose-50 text-rose-700 border-rose-200/80",
        dot: "bg-rose-500",
      };

  const rawType = (warehouse.warehouse_type || "general").toLowerCase();

  const typeConfig = (() => {
    if (rawType.includes("cold")) {
      return { label: "Cold Storage", bg: "bg-blue-50 text-blue-700 border-blue-200/80", isCold: true };
    }
    if (rawType.includes("dry")) {
      return { label: "Dry Storage", bg: "bg-orange-50 text-orange-700 border-orange-200/80", isCold: false };
    }
    if (rawType.includes("distribution") || rawType.includes("dc")) {
      return { label: "Distribution Center", bg: "bg-purple-50 text-purple-700 border-purple-200/80", isCold: false };
    }
    if (rawType.includes("processing") || rawType.includes("unit")) {
      return { label: "Processing Unit", bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80", isCold: false };
    }
    if (rawType.includes("temp")) {
      return { label: "Temp. Controlled", bg: "bg-cyan-50 text-cyan-700 border-cyan-200/80", isCold: true };
    }
    if (rawType.includes("refrig")) {
      return { label: "Refrigerated", bg: "bg-sky-50 text-sky-700 border-sky-200/80", isCold: true };
    }
    return { label: "General Storage", bg: "bg-slate-100 text-slate-700 border-slate-200/80", isCold: false };
  })();

  const utilization = warehouse.utilization_percent ?? 0;

  const progressColor =
    utilization > 85
      ? "bg-gradient-to-r from-rose-500 to-red-600"
      : utilization > 65
      ? "bg-gradient-to-r from-amber-500 to-orange-500"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";

  const handleAction = (type: "view" | "edit") => {
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
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className="group relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-500/40 transition-all duration-200 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Accent Stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

      {/* Card Body */}
      <div className="p-4 space-y-3">
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-[#16a34a] transition-colors truncate">
              {warehouse.name}
            </h3>
            {warehouse.code && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600 shrink-0">
                {warehouse.code}
              </span>
            )}
            {warehouse.branch_name && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-[10px] font-bold text-indigo-700 shrink-0">
                Branch: {warehouse.branch_name}
              </span>
            )}
          </div>

          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.bg} shrink-0`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
            <span>{statusBadge.label}</span>
          </div>
        </div>

        {/* LOCATION & MANAGER DETAILS */}
        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/90 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-slate-600">
            <span className="flex items-center gap-1 truncate font-medium text-slate-700">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              {warehouse.city || "Kuppam"}, {warehouse.state || "AP"}
            </span>

            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${typeConfig.bg} shrink-0`}
            >
              {typeConfig.label}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-1">
            <span className="flex items-center gap-1 truncate text-slate-700 font-medium">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              {warehouse.manager_name || "Manager"}
            </span>
            <span className="font-mono text-slate-600">
              {warehouse.manager_phone || "+91 9876543210"}
            </span>
          </div>
        </div>

        {/* STORAGE UTILIZATION BAR */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-500">Storage Utilization</span>
            <span className="font-extrabold text-slate-800">{utilization}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${utilization}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full ${progressColor}`}
            />
          </div>
        </div>

        {/* CAPACITY & TEMP ONLY */}
        <WarehouseStats
          capacity={warehouse.capacity}
          capacityUnit={warehouse.capacity_unit}
          temperature={warehouse.temperature_type}
          isColdStorage={typeConfig.isCold}
        />
      </div>

      {/* FOOTER ACTIONS (VIEW & EDIT ONLY) */}
      <div className="px-4 py-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-start gap-2">
        <button
          type="button"
          onClick={() => handleAction("view")}
          className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200/90 transition-all flex items-center gap-1.5 shadow-xs"
          title="View Details"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>View</span>
        </button>

        <button
          type="button"
          onClick={() => handleAction("edit")}
          className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-bold rounded-lg border border-slate-200/90 hover:border-emerald-300 transition-all flex items-center gap-1.5 shadow-xs"
          title="Edit Warehouse"
        >
          <Edit3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-600" />
          <span>Edit</span>
        </button>
      </div>
    </motion.div>
  );
}
