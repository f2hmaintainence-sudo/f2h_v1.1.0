"use client";

import React from "react";
import { Plus, ArrowLeftRight, Truck, Download, Upload } from "lucide-react";

interface QuickActionsProps {
  onAddStock?: () => void;
  onTransfer?: () => void;
  onDispatch?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export default function QuickActions({
  onAddStock,
  onTransfer,
  onDispatch,
  onImport,
  onExport,
}: QuickActionsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={onAddStock}
        className="h-9 px-4 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 shrink-0"
      >
        <Plus size={15} />
        <span>+ Add Stock</span>
      </button>

      <button
        type="button"
        onClick={onTransfer}
        className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <ArrowLeftRight size={14} className="text-slate-500" />
        <span>Transfer</span>
      </button>

      <button
        type="button"
        onClick={onDispatch}
        className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <Truck size={14} className="text-slate-500" />
        <span>Dispatch</span>
      </button>

      <button
        type="button"
        onClick={onImport}
        className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <Download size={14} className="text-slate-500" />
        <span>Import</span>
      </button>

      <button
        type="button"
        onClick={onExport}
        className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <Upload size={14} className="text-slate-500" />
        <span>Export</span>
      </button>
    </div>
  );
}
