// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Offers & Banners management page
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import { ChevronRight, Home, Plus, Tag } from "lucide-react";
import Link from "next/link";
import TableComponents from "@/components/Table Generator/TableComponents";

export default function OffersPage() {
  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent("table:add"));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-300">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Offers</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <Tag size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Offers &amp; Banners Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage promotional offer banners, discounts, and mobile app campaign highlights.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus size={16} />
          Add Offer
        </button>
      </div>

      {/* Offers Datatable */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-2 md:p-4">
        <TableComponents
          title="Offers & Banners"
          apiBase="/admin/catalog/offers"
          identifierKey="id"
          actionTypes={["view", "edit", "delete"]}
        />
      </div>
    </div>
  );
}
