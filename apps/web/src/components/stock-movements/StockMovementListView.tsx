"use client";

import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Warehouse as WarehouseIcon,
  Eye,
  Edit2,
  PackageSearch,
} from "lucide-react";
import { StockMovementItem } from "./StockMovementSummaryCards";

interface StockMovementListViewProps {
  movements: StockMovementItem[];
  loading?: boolean;
  onView?: (id: string | number) => void;
  onEdit?: (id: string | number) => void;
}

export default function StockMovementListView({
  movements,
  loading = false,
  onView,
  onEdit,
}: StockMovementListViewProps) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 animate-pulse space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
          <PackageSearch size={36} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          No Stock Movements
        </h3>
        <p className="text-xs text-slate-500 max-w-md">
          No entries matched your search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4">Movement ID</th>
              <th className="py-3.5 px-4">Direction</th>
              <th className="py-3.5 px-4">Type</th>
              <th className="py-3.5 px-4">Warehouse</th>
              <th className="py-3.5 px-4">Product / Variant</th>
              <th className="py-3.5 px-4">Batch ID</th>
              <th className="py-3.5 px-4 text-right">Quantity</th>
              <th className="py-3.5 px-4">Timestamp</th>
              <th className="py-3.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {movements.map((m) => {
              const dir = String(m.direction || "").toUpperCase();
              const isIngress =
                dir === "1" ||
                dir === "IN" ||
                dir.includes("SUCCESS") ||
                dir.includes("IN");

              const qty = Number(m.quantity || 0);

              const formattedDate = m.created_at
                ? new Date(m.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "N/A";

              return (
                <tr
                  key={m.id || m.movement_id}
                  className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {m.movement_id || `#${m.id}`}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase ${
                        isIngress
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isIngress ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                      <span>{isIngress ? "IN" : "OUT"}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold">
                    {m.movement_type || (isIngress ? "Stock In" : "Stock Out")}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <WarehouseIcon size={12} />
                      <span>{m.warehouse_name || "—"}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {m.product_name || "—"}
                      </span>
                      {m.variant_name && (
                        <span className="text-[11px] text-slate-500">
                          {m.variant_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {m.batch_id ? `Batch: ${m.batch_id}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-black tracking-tight text-sm">
                    <span
                      className={
                        isIngress ? "text-emerald-700" : "text-amber-700"
                      }
                    >
                      {isIngress ? "+" : "-"}
                      {Math.abs(qty)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                    {formattedDate}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {onView && (
                        <button
                          onClick={() => onView(m.id)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(m.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
