"use client";

// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Daily Vendor Collections & Milk Procurement)
// Description : Daily collection management for milk & produce procurement
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Home,
  ChevronRight,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  Eye,
  X,
  Package,
  Layers,
  Award,
  ShieldCheck,
  LayoutGrid,
  List,
  AlertCircle,
  FileText,
  BadgeCheck,
  Sparkles,
  PhoneCall,
  MessageSquare,
  Building2,
  Check,
  Sun,
  Moon,
  Droplet,
  IndianRupee,
  Scale,
  Gauge,
  Thermometer,
  Printer,
  ChevronDown
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

interface VendorCollectionRecord {
  id: number;
  collection_id: string;
  collection_date: string;
  shift: "MORNING" | "EVENING" | "AFTERNOON" | "GENERAL";
  vendor_id: string;
  vendor_name: string;
  collector_name: string;
  collector_phone?: string | null;
  product_id?: string | null;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  rate_per_unit: number;
  total_amount: number;

  // Milk quality attributes
  fat_percentage?: number | null;
  snf_percentage?: number | null;
  clr_reading?: number | null;
  temperature?: number | null;
  acidity?: number | null;
  quality_grade?: string | null;
  container_can_no?: string | null;

  payment_status: "PENDING" | "PAID" | "PARTIAL";
  payment_mode?: "CASH" | "UPI" | "BANK_TRANSFER" | "CREDIT" | null;
  payment_reference?: string | null;
  notes?: string | null;
  status: "RECORDED" | "VERIFIED" | "REJECTED" | "CANCELLED";
  created_at: string;
}

interface VendorOption {
  vendor_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  category: string;
  products_supplied?: { name: string; category?: string }[];
}

interface CollectionSummary {
  totalQuantity: number;
  morningQuantity: number;
  eveningQuantity: number;
  totalAmount: number;
  avgFat: number;
  avgSnf: number;
  totalCollections: number;
  activeVendorsCount: number;
}

export default function DailyCollectionsPage() {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [collections, setCollections] = useState<VendorCollectionRecord[]>([]);
  const [summary, setSummary] = useState<CollectionSummary>({
    totalQuantity: 0,
    morningQuantity: 0,
    eveningQuantity: 0,
    totalAmount: 0,
    avgFat: 0,
    avgSnf: 0,
    totalCollections: 0,
    activeVendorsCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Vendors list for dropdowns
  const [registeredVendors, setRegisteredVendors] = useState<VendorOption[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<VendorCollectionRecord | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<VendorCollectionRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form State for Recording Collection
  const [formData, setFormData] = useState({
    collection_date: todayStr,
    shift: "MORNING" as "MORNING" | "EVENING" | "AFTERNOON" | "GENERAL",
    vendor_id: "",
    vendor_name: "",
    collector_name: "Procurement Officer",
    collector_phone: "+91 98765 00001",
    product_name: "Fresh Cow Milk",
    category: "Dairy & Milk",
    quantity: "" as string | number,
    unit: "Liters",
    rate_per_unit: "42.00" as string | number,
    fat_percentage: "4.5" as string | number,
    snf_percentage: "8.5" as string | number,
    clr_reading: "28.5" as string | number,
    temperature: "4.0" as string | number,
    quality_grade: "Grade A",
    container_can_no: "CAN-01",
    payment_status: "PENDING" as "PENDING" | "PAID" | "PARTIAL",
    payment_mode: "CASH" as "CASH" | "UPI" | "BANK_TRANSFER" | "CREDIT",
    notes: ""
  });

  // Fetch Collections
  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append("date", selectedDate);
      if (selectedShift && selectedShift !== "ALL") params.append("shift", selectedShift);
      if (selectedVendorFilter && selectedVendorFilter !== "ALL") params.append("vendorId", selectedVendorFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/v1/vendors/collections?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        setCollections(data.data);
        if (data.summary) setSummary(data.summary);
      } else {
        setCollections([]);
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load collection records");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedShift, selectedVendorFilter, searchQuery]);

  // Fetch Registered Vendors for dropdown
  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/vendors/public", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRegisteredVendors(data.data);
        if (data.data.length > 0 && !formData.vendor_id) {
          setFormData((prev) => ({
            ...prev,
            vendor_id: data.data[0].vendor_id,
            vendor_name: data.data[0].business_name,
            product_name: data.data[0].products_supplied?.[0]?.name || "Fresh Cow Milk"
          }));
        }
      }
    } catch {
      // ignore
    }
  }, [formData.vendor_id]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Handle Vendor Selection Change in Form
  const handleVendorSelect = (vendorId: string) => {
    const found = registeredVendors.find((v) => v.vendor_id === vendorId);
    if (found) {
      const defaultProduct = found.products_supplied?.[0]?.name || (found.category.includes("Dairy") ? "Fresh Cow Milk" : "Farm Produce");
      setFormData((prev) => ({
        ...prev,
        vendor_id: found.vendor_id,
        vendor_name: found.business_name,
        category: found.category || "Dairy & Milk",
        product_name: defaultProduct
      }));
    }
  };

  // Submit new collection
  const handleAddCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id || !formData.vendor_name) {
      showErrorToast("Please select a vendor");
      return;
    }
    if (!formData.collector_name.trim()) {
      showErrorToast("Collector person name is required");
      return;
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      showErrorToast("Please enter a valid quantity");
      return;
    }

    setAddLoading(true);
    try {
      const payload = {
        ...formData,
        quantity: Number(formData.quantity),
        rate_per_unit: Number(formData.rate_per_unit) || 0,
        fat_percentage: formData.fat_percentage ? Number(formData.fat_percentage) : null,
        snf_percentage: formData.snf_percentage ? Number(formData.snf_percentage) : null,
        clr_reading: formData.clr_reading ? Number(formData.clr_reading) : null,
        temperature: formData.temperature ? Number(formData.temperature) : null
      };

      const res = await fetch("/api/v1/vendors/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showSuccessToast(
          `Collection recorded: ${payload.quantity} ${payload.unit} from ${payload.vendor_name}`
        );
        setIsAddModalOpen(false);
        // Reset quantity & notes for next quick entry
        setFormData((prev) => ({
          ...prev,
          quantity: "",
          notes: "",
          container_can_no: `CAN-${String(Math.floor(Math.random() * 20) + 1).padStart(2, "0")}`
        }));
        fetchCollections();
      } else {
        showErrorToast(data.message || "Failed to record collection");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Error saving collection record");
    } finally {
      setAddLoading(false);
    }
  };

  // Toggle Payment Status
  const handleTogglePayment = async (collection: VendorCollectionRecord) => {
    try {
      const nextStatus = collection.payment_status === "PAID" ? "PENDING" : "PAID";
      const res = await fetch(`/api/v1/vendors/collections/${collection.collection_id || collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: nextStatus })
      });
      const data = await res.json();

      if (data.success) {
        showSuccessToast(`Payment status updated to ${nextStatus}`);
        setCollections((prev) =>
          prev.map((c) => (c.id === collection.id ? { ...c, payment_status: nextStatus } : c))
        );
        if (selectedCollection && selectedCollection.id === collection.id) {
          setSelectedCollection({ ...selectedCollection, payment_status: nextStatus });
        }
      } else {
        showErrorToast(data.message || "Failed to update payment status");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Error updating payment status");
    }
  };

  // Delete Collection
  const handleDeleteCollection = async () => {
    if (!collectionToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/vendors/collections/${collectionToDelete.collection_id || collectionToDelete.id}`, {
        method: "DELETE"
      });
      const data = await res.json();

      if (data.success) {
        showSuccessToast("Collection record removed");
        setCollections((prev) => prev.filter((c) => c.id !== collectionToDelete.id));
        if (selectedCollection && selectedCollection.id === collectionToDelete.id) {
          setSelectedCollection(null);
        }
        setCollectionToDelete(null);
        fetchCollections();
      } else {
        showErrorToast(data.message || "Failed to delete collection record");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Error deleting record");
    } finally {
      setDeleteLoading(false);
    }
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
        <span className="font-semibold text-slate-800">Daily Collections</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Daily Vendor Collections</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-800">
                Procurement
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Track daily milk &amp; farm produce collection with Fat %, SNF %, quantities, and payments
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar size={13} className="text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchCollections}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-xs"
            title="Refresh collections"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#16a34a] hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={15} />
            <span>Record Collection</span>
          </button>
        </div>
      </div>

      {/* KPI Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4">
        {/* Total Quantity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Droplet size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Volume</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">
              {summary.totalQuantity} <span className="text-xs font-normal text-slate-500">Liters</span>
            </p>
          </div>
        </div>

        {/* Shift Distribution */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sun size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Morn / Eve Split</p>
            <p className="text-sm md:text-base font-bold text-slate-900">
              <span className="text-amber-700">{summary.morningQuantity}L</span> /{" "}
              <span className="text-indigo-700">{summary.eveningQuantity}L</span>
            </p>
          </div>
        </div>

        {/* Avg Fat & SNF */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Gauge size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Quality Index</p>
            <p className="text-sm md:text-base font-bold text-slate-900">
              Fat: <span className="text-emerald-700">{summary.avgFat ? `${summary.avgFat}%` : "--"}</span> • SNF:{" "}
              <span className="text-blue-700">{summary.avgSnf ? `${summary.avgSnf}%` : "--"}</span>
            </p>
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <IndianRupee size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Procurement Value</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">₹{summary.totalAmount.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Shifts, Search, View Mode */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        {/* Shift Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <button
            onClick={() => setSelectedShift("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedShift === "ALL" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Shifts
          </button>
          <button
            onClick={() => setSelectedShift("MORNING")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedShift === "MORNING"
                ? "bg-amber-600 text-white shadow-xs font-semibold"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <Sun size={12} /> Morning
          </button>
          <button
            onClick={() => setSelectedShift("EVENING")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedShift === "EVENING"
                ? "bg-indigo-600 text-white shadow-xs font-semibold"
                : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
            }`}
          >
            <Moon size={12} /> Evening
          </button>
        </div>

        {/* Search, Vendor Selector & View Switcher */}
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor, collector, CAN..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
              }`}
              title="Table View"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xs text-center space-y-3">
          <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading collection entries...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
            <ClipboardCheck size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No Collections Recorded For This Selection</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || selectedShift !== "ALL"
                ? "Try clearing filters to see other collection entries."
                : `No collections logged for date ${selectedDate}. Click "Record Collection" to enter milk or produce intake.`}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            {(searchQuery || selectedShift !== "ALL") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedShift("ALL");
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#16a34a] text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} /> Record Collection
            </button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date / Shift</th>
                  <th className="py-3.5 px-4">Vendor &amp; Collector</th>
                  <th className="py-3.5 px-4">Product &amp; Volume</th>
                  <th className="py-3.5 px-4">Quality (Fat / SNF)</th>
                  <th className="py-3.5 px-4">Amount &amp; Payment</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {collections.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Date / Shift */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {item.shift === "MORNING" ? (
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs" title="Morning Shift">
                            <Sun size={14} />
                          </div>
                        ) : item.shift === "EVENING" ? (
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs" title="Evening Shift">
                            <Moon size={14} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                            <Clock size={14} />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{item.collection_date}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.collection_id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Vendor & Collector */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{item.vendor_name}</p>
                      <p className="text-[11px] text-slate-500">
                        Collector: <span className="font-semibold text-slate-700">{item.collector_name}</span>
                      </p>
                    </td>

                    {/* Product & Volume */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">
                          {item.quantity} {item.unit}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.product_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">@ ₹{item.rate_per_unit}/{item.unit === "Liters" ? "L" : "Kg"}</p>
                    </td>

                    {/* Quality (Fat / SNF) */}
                    <td className="py-3.5 px-4">
                      {item.fat_percentage || item.snf_percentage ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.fat_percentage && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                              Fat {item.fat_percentage}%
                            </span>
                          )}
                          {item.snf_percentage && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                              SNF {item.snf_percentage}%
                            </span>
                          )}
                          {item.container_can_no && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-600">
                              {item.container_can_no}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Standard / Not tested</span>
                      )}
                    </td>

                    {/* Amount & Payment Status */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">₹{item.total_amount.toLocaleString("en-IN")}</p>
                      <button
                        onClick={() => handleTogglePayment(item)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 transition-all ${
                          item.payment_status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100"
                        }`}
                        title="Click to toggle payment status"
                      >
                        {item.payment_status === "PAID" ? (
                          <>
                            <Check size={10} /> Paid
                          </>
                        ) : (
                          <>
                            <Clock size={10} /> Pending
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedCollection(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="View Details & Receipt"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setCollectionToDelete(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {item.shift === "MORNING" ? (
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                        <Sun size={18} />
                      </div>
                    ) : item.shift === "EVENING" ? (
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                        <Moon size={18} />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                        <Clock size={18} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{item.vendor_name}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">{item.collection_id} • {item.collection_date}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      item.payment_status === "PAID"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {item.payment_status}
                  </span>
                </div>

                {/* Volume & Rate Row */}
                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Quantity</span>
                    <p className="font-bold text-base text-slate-900">
                      {item.quantity} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Amount</span>
                    <p className="font-bold text-base text-emerald-700">₹{item.total_amount.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                {/* Quality Metrics */}
                {(item.fat_percentage || item.snf_percentage || item.container_can_no) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {item.fat_percentage && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                        Fat: {item.fat_percentage}%
                      </span>
                    )}
                    {item.snf_percentage && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-100">
                        SNF: {item.snf_percentage}%
                      </span>
                    )}
                    {item.container_can_no && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono bg-slate-100 text-slate-700">
                        {item.container_can_no}
                      </span>
                    )}
                  </div>
                )}

                {/* Collector Agent */}
                <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                  <span>Collector: <strong className="text-slate-800">{item.collector_name}</strong></span>
                  <span className="text-[11px] text-slate-400">{item.product_name}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTogglePayment(item)}
                  className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
                >
                  {item.payment_status === "PAID" ? "Mark Pending" : "Mark Paid"}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedCollection(item)}
                    className="p-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-medium flex items-center gap-1 px-2.5"
                  >
                    <Eye size={13} /> Details
                  </button>
                  <button
                    onClick={() => setCollectionToDelete(item)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD NEW COLLECTION MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Record Daily Vendor Collection</h2>
                  <p className="text-xs text-slate-500">Log vendor milk intake, test results, and procurement quantities</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCollectionSubmit} className="p-5 md:p-6 space-y-5">
              {/* Date, Shift, & Collector Agent */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Collection Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.collection_date}
                    onChange={(e) => setFormData({ ...formData, collection_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Collection Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="MORNING">Morning Shift (AM)</option>
                    <option value="EVENING">Evening Shift (PM)</option>
                    <option value="GENERAL">General / Afternoon</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Collector Person Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.collector_name}
                    onChange={(e) => setFormData({ ...formData, collector_name: e.target.value })}
                    placeholder="e.g. Ramesh / Agent 01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Vendor Selection & Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Select Vendor / Producer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    {registeredVendors.length > 0 ? (
                      registeredVendors.map((v) => (
                        <option key={v.vendor_id} value={v.vendor_id}>
                          {v.business_name} ({v.contact_person})
                        </option>
                      ))
                    ) : (
                      <option value="">No vendors found (Register a vendor first)</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Product Collected <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="e.g. Fresh Cow Milk / Buffalo Milk"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quantity, Unit & Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Quantity Collected <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g. 50.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Unit of Measure</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Liters">Liters (L)</option>
                    <option value="Kg">Kilograms (Kg)</option>
                    <option value="Units">Units / Crates</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Rate per Unit (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.rate_per_unit}
                    onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
                    placeholder="e.g. 42.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Calculation Preview Banner */}
              {Number(formData.quantity) > 0 && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-900">Calculated Payout Amount:</span>
                  <span className="text-base font-bold text-emerald-800">
                    ₹{(Number(formData.quantity) * (Number(formData.rate_per_unit) || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Milk Quality Test Section */}
              <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Milk Quality &amp; Lab Test Details
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Fat Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      value={formData.fat_percentage}
                      onChange={(e) => setFormData({ ...formData, fat_percentage: e.target.value })}
                      placeholder="e.g. 4.5"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">SNF (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      value={formData.snf_percentage}
                      onChange={(e) => setFormData({ ...formData, snf_percentage: e.target.value })}
                      placeholder="e.g. 8.5"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">CLR / Lactometer</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.clr_reading}
                      onChange={(e) => setFormData({ ...formData, clr_reading: e.target.value })}
                      placeholder="e.g. 28.5"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Container / Can No</label>
                    <input
                      type="text"
                      value={formData.container_can_no}
                      onChange={(e) => setFormData({ ...formData, container_can_no: e.target.value })}
                      placeholder="e.g. CAN-04"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Quality Grade</label>
                    <select
                      value={formData.quality_grade}
                      onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Grade A">Grade A (Optimal Quality)</option>
                      <option value="Grade B">Grade B (Standard)</option>
                      <option value="Premium">Premium Raw Milk</option>
                      <option value="Under Review">Under Lab Review</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      placeholder="e.g. 4.0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Status & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Payment Status</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="PENDING">Pending (Weekly Settlement)</option>
                    <option value="PAID">Paid on Collection (Instant)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Payment Mode</label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI Transfer</option>
                    <option value="BANK_TRANSFER">Bank NEFT/IMPS</option>
                    <option value="CREDIT">Vendor Credit Balance</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Collection Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Fresh farm morning yield, chilled to 4°C, tested in lab"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#16a34a] hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {addLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>Save Collection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COLLECTION DETAIL MODAL / RECEIPT VIEW */}
      {/* ========================================================================= */}
      {selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Collection Slip / Receipt</h2>
                  <p className="text-xs text-slate-500 font-mono">{selectedCollection.collection_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCollection(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-5">
              {/* Slip Card */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 font-mono text-xs">
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h3 className="font-bold text-sm text-slate-900 uppercase">F2H Fresh Dairy &amp; Produce</h3>
                  <p className="text-[11px] text-slate-500 font-sans">Vendor Procurement Intake Receipt</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-sans">Date &amp; Shift:</span>
                    <strong className="text-slate-800">
                      {selectedCollection.collection_date} ({selectedCollection.shift})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">Container / Can:</span>
                    <strong className="text-slate-800">{selectedCollection.container_can_no || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">Vendor Name:</span>
                    <strong className="text-slate-800">{selectedCollection.vendor_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">Collector:</span>
                    <strong className="text-slate-800">{selectedCollection.collector_name}</strong>
                  </div>
                </div>

                {/* Quality Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-sans text-slate-600">Product:</span>
                    <span className="font-bold text-slate-900">{selectedCollection.product_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-sans text-slate-600">Quantity:</span>
                    <span className="font-bold text-slate-900">
                      {selectedCollection.quantity} {selectedCollection.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-sans text-slate-600">Rate per Unit:</span>
                    <span className="font-bold text-slate-900">₹{selectedCollection.rate_per_unit}</span>
                  </div>

                  {selectedCollection.fat_percentage && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                      <span className="font-sans text-slate-600">Fat % / SNF %:</span>
                      <span className="font-bold text-emerald-700">
                        {selectedCollection.fat_percentage}% / {selectedCollection.snf_percentage || "--"}%
                      </span>
                    </div>
                  )}

                  {selectedCollection.clr_reading && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-sans text-slate-600">CLR / Lactometer:</span>
                      <span className="font-bold text-blue-700">{selectedCollection.clr_reading}</span>
                    </div>
                  )}
                </div>

                {/* Total Payout */}
                <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-300 text-sm">
                  <span className="font-bold text-slate-800 uppercase">Total Amount:</span>
                  <span className="font-bold text-base text-emerald-800">
                    ₹{selectedCollection.total_amount.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-400 font-sans">
                  Status: <strong className="text-slate-700">{selectedCollection.payment_status}</strong> (Mode:{" "}
                  {selectedCollection.payment_mode || "CASH"})
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex items-center justify-between">
              <button
                onClick={() => handleTogglePayment(selectedCollection)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  selectedCollection.payment_status === "PAID"
                    ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {selectedCollection.payment_status === "PAID" ? "Mark Pending" : "Mark as Paid"}
              </button>

              <button
                onClick={() => setSelectedCollection(null)}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {collectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Remove Collection Entry?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove collection slip{" "}
                <span className="font-mono font-semibold text-slate-800">{collectionToDelete.collection_id}</span> for{" "}
                <span className="font-semibold text-slate-800">{collectionToDelete.vendor_name}</span>?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setCollectionToDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCollection}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleteLoading && <RefreshCw size={13} className="animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
