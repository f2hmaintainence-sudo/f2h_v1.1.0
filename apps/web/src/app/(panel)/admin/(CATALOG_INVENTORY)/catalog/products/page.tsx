"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Home, Package, Tag, Plus, FolderTree } from "lucide-react";
import TableComponents from "@/components/Table Generator/TableComponents";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"products" | "variants" | "categories">("products");

  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent("table:add"));
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in duration-300">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">
          {activeTab === "products"
            ? "Products"
            : activeTab === "variants"
              ? "Product Variants"
              : "Categories"}
        </span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            {activeTab === "products" ? (
              <Package size={24} />
            ) : activeTab === "variants" ? (
              <Tag size={24} />
            ) : (
              <FolderTree size={24} />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === "products"
                ? "Products Management"
                : activeTab === "variants"
                  ? "Product Variants Management"
                  : "Categories Management"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === "products"
                ? "Manage master product listings, descriptions, categories, and media."
                : activeTab === "variants"
                  ? "Manage product sizes, units, pricing, stock levels, and SKUs."
                  : "Manage store categories, display orders, and catalog hierarchy."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus size={16} />
          {activeTab === "products"
            ? "Add Product"
            : activeTab === "variants"
              ? "Add Variant"
              : "Add Category"}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "categories"
              ? "bg-[#16a34a] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
        >
          <FolderTree size={15} />
          Categories
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "products"
              ? "bg-[#16a34a] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
        >
          <Package size={15} />
          Products Catalog
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("variants")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "variants"
              ? "bg-[#16a34a] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
        >
          <Tag size={15} />
          Product Variants
        </button>


      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-2 md:p-4">
        {activeTab === "products" ? (
          <TableComponents
            key="products-table"
            title="Products"
            apiBase="/admin/catalog/product"
            identifierKey="id"
            actionTypes={["view", "edit", "delete"]}
          />
        ) : activeTab === "variants" ? (
          <TableComponents
            key="variants-table"
            title="Product Variants"
            apiBase="/admin/catalog/variants"
            identifierKey="id"
            actionTypes={["view", "edit", "delete"]}
          />
        ) : (
          <TableComponents
            key="categories-table"
            title="Categories"
            apiBase="/admin/catalog/categories"
            identifierKey="id"
            actionTypes={["view", "edit", "delete"]}
          />
        )}
      </div>
    </div>
  );
}