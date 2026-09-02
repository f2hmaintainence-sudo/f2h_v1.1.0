"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Home,
  Package,
  Tag,
  Plus,
  FolderTree,
  Warehouse as WarehouseIcon,
  Sparkles,
  ArrowRight,
  Boxes,
} from "lucide-react";
import TableComponents from "@/components/Table Generator/TableComponents";

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"products" | "variants" | "categories">(
    tabParam === "variants" || tabParam === "categories" ? tabParam : "products"
  );

  useEffect(() => {
    if (tabParam === "variants" || tabParam === "categories" || tabParam === "products") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

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
          className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <Plus size={16} />
          {activeTab === "products"
            ? "Add Product"
            : activeTab === "variants"
              ? "Add Variant"
              : "Add Category"}
        </button>
      </div>

      {/* Lifecycle Guidance Banner for Product & Variant Stocking */}
      {activeTab === "variants" ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 rounded-2xl text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <span>Inventory Lifecycle: Variant ➔ Warehouse Stock</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold uppercase">
                  Stage 2 of 3
                </span>
              </div>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                After defining variants (pack sizes &amp; prices), you must <strong>Inward Initial Stock &amp; Batches</strong> in the branch warehouse so items appear "In Stock" for customer mobile apps.
              </p>
            </div>
          </div>
          <Link
            href="/admin/warehouse/stock-movements"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl transition-all shadow-xs shrink-0 self-start md:self-auto"
          >
            <WarehouseIcon size={14} /> Go to Warehouse Stock Movements <ArrowRight size={14} />
          </Link>
        </div>
      ) : activeTab === "products" ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-gradient-to-r from-slate-50 via-emerald-50/40 to-slate-50 border border-slate-200/80 rounded-2xl text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Package size={18} />
            </div>
            <div>
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <span>Catalog Lifecycle: Master Product ➔ Define Variants</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[10px] font-extrabold uppercase">
                  Stage 1 of 3
                </span>
              </div>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                Master products group your items. Once created, define <strong>Variants</strong> (e.g. 500ml, 1L, 250g) to configure pricing and stock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("variants")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-xs shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Tag size={14} /> Manage Variants <ChevronRight size={14} />
          </button>
        </div>
      ) : null}

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