"use client";

import React from "react";
import { Building2, Snowflake, Factory } from "lucide-react";

interface Warehouse {
  id: string | number;
  warehouse_id: string;
  name: string;
  warehouse_type?: string;
}

interface WarehouseSelectorProps {
  warehouses: Warehouse[];
  selectedWarehouse: string;
  onSelectWarehouse: (warehouseId: string) => void;
}

export default function WarehouseSelector({
  warehouses,
  selectedWarehouse,
  onSelectWarehouse,
}: WarehouseSelectorProps) {
  const getWarehouseIcon = (name: string, type?: string) => {
    const lower = (name + " " + (type || "")).toLowerCase();
    if (lower.includes("cold") || lower.includes("chilled") || lower.includes("frozen")) {
      return <Snowflake className="w-3.5 h-3.5 shrink-0" />;
    }
    if (lower.includes("processing") || lower.includes("factory")) {
      return <Factory className="w-3.5 h-3.5 shrink-0" />;
    }
    return <Building2 className="w-3.5 h-3.5 shrink-0" />;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onSelectWarehouse("")}
        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
          selectedWarehouse === ""
            ? "bg-[#16a34a] text-white shadow-xs"
            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
        }`}
      >
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span>All Warehouses</span>
      </button>

      {warehouses.map((w) => {
        const isSelected = selectedWarehouse === w.warehouse_id;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onSelectWarehouse(w.warehouse_id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              isSelected
                ? "bg-[#16a34a] text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            {getWarehouseIcon(w.name, w.warehouse_type)}
            <span>{w.name}</span>
          </button>
        );
      })}
    </div>
  );
}
