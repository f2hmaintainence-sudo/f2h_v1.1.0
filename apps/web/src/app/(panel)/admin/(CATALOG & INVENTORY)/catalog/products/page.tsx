"use client";

import { useState } from "react";
import { ChevronRight, Home, Plus, Package, Box, Layers, Tag } from "lucide-react";
import Link from "next/link";
import TableComponents from "@/components/Table Generator/TableComponents";

type CatalogTab = "categories" | "products" | "variants";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<CatalogTab>("categories");

  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent("table:add"));
  };

  const getTabInfo = () => {
    switch (activeTab) {
      case "products":
        return {
          title: "Products",
          apiBase: "/admin/catalog/product",
          addLabel: "Add Product",
          desc: "Manage main product listings, master descriptions, and media.",
        };
      case "variants":
        return {
          title: "Product Variants",
          apiBase: "/admin/catalog/variants",
          addLabel: "Add Variant",
          desc: "Configure SKU weights, packaging sizes, prices, and unit attributes.",
        };
      case "categories":
      default:
        return {
          title: "Categories",
          apiBase: "/admin/catalog/categories",
          addLabel: "Add Category",
          desc: "Manage product categories, taxonomies, and store groupings.",
        };
    }
  };

  const tabInfo = getTabInfo();

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
        <span className="font-semibold text-slate-800">Products</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Products &amp; Catalog Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">{tabInfo.desc}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus size={16} />
          {tabInfo.addLabel}
        </button>
      </div>

      {/* Sleek F2H Navigation Tabs: Categories, Products, Product Variants */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === "categories"
              ? "bg-[#16a34a] text-white shadow-sm shadow-emerald-600/20"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
            }`}
        >
          <Box size={15} />
          Categories
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === "products"
              ? "bg-[#16a34a] text-white shadow-sm shadow-emerald-600/20"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
            }`}
        >
          <Package size={15} />
          Products
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("variants")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === "variants"
              ? "bg-[#16a34a] text-white shadow-sm shadow-emerald-600/20"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
            }`}
        >
          <Layers size={15} />
          Product Variants
        </button>
      </div>

      {/* Dynamic Active Tab Content */}
      <div key={activeTab} className="bg-white rounded-3xl border border-slate-100 shadow-xs p-2 md:p-4">
        <TableComponents
          title={tabInfo.title}
          apiBase={tabInfo.apiBase}
          identifierKey="id"
          actionTypes={["view", "edit", "delete"]}
        />
      </div>
    </div>
  );
}