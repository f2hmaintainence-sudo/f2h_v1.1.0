"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Archive, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InventoryItem {
  id: string | number;
  product_name: string;
  variant_name: string;
  sku: string;
  available_quantity: number | string;
  unit_type?: string;
  warehouse_name?: string;
}

interface StockInOutSummaryProps {
  items: InventoryItem[];
  isLoading?: boolean;
}

export default function StockInOutSummary({ items = [], isLoading = false }: StockInOutSummaryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWarehouseTab, setActiveWarehouseTab] = useState<string>("");

  const warehousesList = useMemo(() => {
    const list = new Set<string>();
    items.forEach((item) => {
      if (item.warehouse_name) {
        list.add(item.warehouse_name);
      }
    });
    return Array.from(list).sort();
  }, [items]);

  // Keep active tab in sync with the warehouses list
  useEffect(() => {
    if (warehousesList.length > 0) {
      if (!activeWarehouseTab || !warehousesList.includes(activeWarehouseTab)) {
        setActiveWarehouseTab(warehousesList[0]);
      }
    } else {
      setActiveWarehouseTab("");
    }
  }, [warehousesList, activeWarehouseTab]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeWarehouseTab) {
      list = items.filter((item) => item.warehouse_name === activeWarehouseTab);
    }
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.product_name.toLowerCase().includes(query) ||
        item.variant_name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
    );
  }, [items, activeWarehouseTab, searchQuery]);

  const maxQty = useMemo(() => {
    if (filteredItems.length === 0) return 1;
    return Math.max(...filteredItems.map((item) => Math.max(Number(item.available_quantity) || 0, 1)));
  }, [filteredItems]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 min-h-[340px] h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Archive className="w-4 h-4 text-emerald-600" />
            Current Stock Levels
          </h3>
          <p className="text-xs text-slate-500 font-medium">Available quantities of all products</p>
        </div>
        <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
          {filteredItems.length} Product{filteredItems.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Warehouse Tabs */}
      {warehousesList.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100/80 rounded-xl shrink-0">
          {warehousesList.map((wh) => {
            const isActive = wh === activeWarehouseTab;
            const count = items.filter((i) => i.warehouse_name === wh).length;
            return (
              <button
                key={wh}
                type="button"
                onClick={() => setActiveWarehouseTab(wh)}
                className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all truncate text-center ${
                  isActive
                    ? "bg-white text-emerald-700 shadow-xs border border-emerald-100 animate-fade-in"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {wh} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search Input */}
      <div className="relative shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-slate-400" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products..."
          className="block w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
        />
      </div>

      {/* Products list with scroll */}
      <div className="flex-1 overflow-y-auto max-h-[190px] pr-1 scrollbar-thin">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-10" />
                </div>
                <div className="h-2 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-slate-400">
            <Archive className="w-8 h-8 opacity-30" />
            <span className="text-xs font-medium">No products found</span>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => {
                const qty = Number(item.available_quantity) || 0;
                const percentage = (qty / maxQty) * 100;
                const displayName = item.product_name 
                  ? `${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ""}`
                  : item.variant_name || "Unknown Product";
                const warehouseName = item.warehouse_name || "";

                return (
                  <motion.div
                    key={item.id || `${displayName}-${warehouseName}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
                    className="space-y-1"
                  >
                    <div className="flex justify-between items-start text-xs gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-slate-700 truncate" title={displayName}>
                          {displayName}
                        </span>
                        {warehouseName && (
                          <span className="text-[10px] text-slate-400 font-medium truncate">
                            {warehouseName}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 shrink-0 mt-0.5">
                        {qty.toLocaleString()} {item.unit_type || ""}
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
