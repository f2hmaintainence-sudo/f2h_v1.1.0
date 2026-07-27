"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Warehouse as WarehouseIcon,
  Tag,
  Clock,
  User,
  Eye,
  Edit2,
} from "lucide-react";
import { StockMovementItem } from "./StockMovementSummaryCards";

interface StockMovementCardProps {
  movement: StockMovementItem;
  onView?: (movement: StockMovementItem) => void;
  onEdit?: (movement: StockMovementItem) => void;
}

export default function StockMovementCard({
  movement,
  onView,
  onEdit,
}: StockMovementCardProps) {
  const dir = String(movement.direction || "").toUpperCase();
  const isIngress =
    dir === "1" ||
    dir === "IN" ||
    dir.includes("SUCCESS") ||
    dir.includes("IN");

  const qty = Number(movement.quantity || 0);
  const qtyBefore = Number(movement.quantity_before || 0);
  const qtyAfter = Number(movement.quantity_after || 0);

  const formattedDate = React.useMemo(() => {
    if (!movement.created_at) return "N/A";
    try {
      const d = new Date(movement.created_at);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(movement.created_at);
    }
  }, [movement.created_at]);

  const movementLabel = React.useMemo(() => {
    const raw = (movement.movement_type || "").toLowerCase();
    const map: Record<string, string> = {
      stock_in: "Stock In",
      stock_out: "Stock Out",
      transfer_in: "Transfer In",
      transfer_out: "Transfer Out",
      damage: "Damaged Stock",
      expiry: "Expired Stock",
      return: "Customer Return",
      adjustment: "Stock Adjustment",
    };
    return map[raw] || movement.movement_type || (isIngress ? "Stock In" : "Stock Out");
  }, [movement.movement_type, isIngress]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="group relative bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md hover:border-[#2E7D32]/30 transition-all duration-300 flex flex-col justify-between"
    >
      {/* Top Section: Direction Badge + Movement ID */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                isIngress
                  ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                  : "bg-amber-50 text-amber-600 border border-amber-100"
              }`}
            >
              {isIngress ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-md ${
                    isIngress
                      ? "bg-[#2E7D32] text-white"
                      : "bg-amber-600 text-white"
                  }`}
                >
                  {isIngress ? "IN" : "OUT"}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {movementLabel}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {movement.movement_id || `#${movement.id}`}
              </p>
            </div>
          </div>

          {/* Delta Quantity Pill */}
          <div className="text-right">
            <div
              className={`inline-flex items-center gap-0.5 text-base font-black tracking-tight ${
                isIngress
                  ? "text-[#2E7D32]"
                  : "text-amber-700"
              }`}
            >
              <span>{isIngress ? "+" : "-"}</span>
              <span>{Math.abs(qty)}</span>
            </div>
            <p className="text-[10px] font-semibold text-slate-400">
              Quantity
            </p>
          </div>
        </div>

        {/* Product & Variant info */}
        <div className="py-3 space-y-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-[#2E7D32] transition-colors">
              {movement.product_name || "Unassigned Product"}
            </h4>
            {movement.variant_name && (
              <span className="inline-block mt-0.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                {movement.variant_name}
              </span>
            )}
          </div>

          {/* Warehouse & Batch Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {movement.warehouse_name && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-lg border border-[#C8E6C9]">
                <WarehouseIcon size={11} />
                <span>{movement.warehouse_name}</span>
              </span>
            )}
            {movement.batch_id && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200/50">
                <Tag size={11} />
                <span>Batch: {movement.batch_id}</span>
              </span>
            )}
          </div>

          {/* Before ➔ After Stock Tracker */}
          {(qtyBefore > 0 || qtyAfter > 0) && (
            <div className="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Stock Shift:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-500 font-semibold">{qtyBefore}</span>
                <span className="text-slate-300">➔</span>
                <span className="font-extrabold text-[#2E7D32]">
                  {qtyAfter}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Metadata + Actions */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            <span>{formattedDate}</span>
          </span>
          {movement.created_by && (
            <span className="hidden sm:flex items-center gap-1 border-l border-slate-200 pl-2">
              <User size={12} />
              <span>By #{movement.created_by}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onView && (
            <button
              onClick={() => onView(movement)}
              className="p-1.5 text-slate-500 hover:text-[#2E7D32] hover:bg-[#E8F5E9] rounded-lg transition-all"
              title="View Details"
            >
              <Eye size={14} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(movement)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Edit Movement"
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
