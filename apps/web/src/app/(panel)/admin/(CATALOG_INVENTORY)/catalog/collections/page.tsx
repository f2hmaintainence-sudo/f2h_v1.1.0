"use client";

// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Mobile-First Daily Vendor Collections & Milk Procurement)
// Description : Field-optimized mobile-first daily procurement & milk collection UI
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Home,
  ChevronRight,
  ChevronLeft,
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
  Share2,
  PlusCircle,
  ChevronDown,
  UserCheck
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

  // Filters & State
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Vendors list for dropdowns
  const [registeredVendors, setRegisteredVendors] = useState<VendorOption[]>([]);

  // Modals & Sliders
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<VendorCollectionRecord | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<VendorCollectionRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form State for Recording Collection (Mobile-optimized with numeric inputs)
  const [formData, setFormData] = useState({
    collection_date: todayStr,
    shift: "MORNING" as "MORNING" | "EVENING" | "AFTERNOON" | "GENERAL",
    vendor_id: "",
    vendor_name: "",
    collector_name: "Collection Officer",
    collector_phone: "+91 98765 00001",
    product_name: "Fresh Cow Milk",
    category: "Dairy & Milk",
    quantity: "",
    unit: "Liters",
    rate_per_unit: "42.00",
    fat_percentage: "4.5",
    snf_percentage: "8.5",
    clr_reading: "28.5",
    temperature: "4.0",
    quality_grade: "Grade A",
    container_can_no: "CAN-01",
    payment_status: "PENDING" as "PENDING" | "PAID" | "PARTIAL",
    payment_mode: "CASH" as "CASH" | "UPI" | "BANK_TRANSFER" | "CREDIT",
    notes: ""
  });

  // Date Navigation Helpers (Previous Day, Next Day, Today)
  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === todayStr;

  // Fetch Collections
  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append("date", selectedDate);
      if (selectedShift && selectedShift !== "ALL") params.append("shift", selectedShift);
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
  }, [selectedDate, selectedShift, searchQuery]);

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
      const defaultProduct =
        found.products_supplied?.[0]?.name ||
        (found.category.toLowerCase().includes("dairy") ? "Fresh Cow Milk" : "Farm Produce");
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
  const handleAddCollectionSubmit = async (e: React.FormEvent, addAnother = false) => {
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
      showErrorToast("Please enter a valid quantity in Liters/Kg");
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
          `✓ Recorded: ${payload.quantity} ${payload.unit} (${payload.vendor_name})`
        );
        fetchCollections();

        if (addAnother) {
          // Prepare next entry for same collector
          setFormData((prev) => ({
            ...prev,
            quantity: "",
            notes: "",
            container_can_no: `CAN-${String(Math.floor(Math.random() * 20) + 1).padStart(2, "0")}`
          }));
        } else {
          setIsAddModalOpen(false);
          setFormData((prev) => ({
            ...prev,
            quantity: "",
            notes: ""
          }));
        }
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
        showSuccessToast(`Payment marked as ${nextStatus}`);
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
      const res = await fetch(
        `/api/v1/vendors/collections/${collectionToDelete.collection_id || collectionToDelete.id}`,
        {
          method: "DELETE"
        }
      );
      const data = await res.json();

      if (data.success) {
        showSuccessToast("Collection slip removed");
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

  // WhatsApp Share Slip text builder
  const getWhatsAppSlipUrl = (c: VendorCollectionRecord, vendorPhone?: string) => {
    const text = encodeURIComponent(
      `*F2H FRESH - MILK PROCUREMENT RECEIPT*\n` +
      `------------------------------------\n` +
      `Date: ${c.collection_date} (${c.shift})\n` +
      `Slip No: ${c.collection_id}\n` +
      `Vendor: ${c.vendor_name}\n` +
      `Product: ${c.product_name}\n` +
      `Quantity: ${c.quantity} ${c.unit}\n` +
      `Rate: Rs ${c.rate_per_unit}/${c.unit === 'Liters' ? 'L' : 'Kg'}\n` +
      `Total Amount: Rs ${c.total_amount}\n` +
      (c.fat_percentage ? `Fat %: ${c.fat_percentage}%\n` : '') +
      (c.snf_percentage ? `SNF %: ${c.snf_percentage}%\n` : '') +
      (c.container_can_no ? `Container: ${c.container_can_no}\n` : '') +
      `Payment: ${c.payment_status}\n` +
      `Collector: ${c.collector_name}\n` +
      `------------------------------------\n` +
      `Thank you for supplying pure fresh milk to F2H!`
    );
    const cleanPhone = (vendorPhone || "").replace(/[^0-9]/g, "");
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6 pb-24 md:pb-8 animate-in fade-in duration-200">
      {/* Breadcrumbs - Hidden on small mobile to save vertical screen real estate */}
      <nav className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Daily Collections</span>
      </nav>

      {/* Mobile Top Header & Date Day Picker */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-xs space-y-3">
        {/* Title Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100 shrink-0">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                Daily Milk &amp; Produce Intake
              </h1>
              <p className="text-[11px] text-slate-500">
                {collections.length} slips recorded • {summary.totalQuantity} L total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchCollections}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
              <span className="hidden sm:inline sm:ml-1">Refresh</span>
            </button>

            {/* Desktop Add Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#16a34a] hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={15} />
              <span>Record Collection</span>
            </button>
          </div>
        </div>

        {/* Date Selector Row with Quick < Today > Nav Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
            <button
              onClick={() => navigateDay(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none cursor-pointer px-1 text-center"
            />
            <button
              onClick={() => navigateDay(1)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              Jump to Today
            </button>
          )}

          {/* Shift Filter Switcher for Mobile & Desktop */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setSelectedShift("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${
                selectedShift === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedShift("MORNING")}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all ${
                selectedShift === "MORNING" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-800"
              }`}
            >
              <Sun size={12} /> AM
            </button>
            <button
              onClick={() => setSelectedShift("EVENING")}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all ${
                selectedShift === "EVENING" ? "bg-indigo-600 text-white shadow-2xs" : "text-indigo-800"
              }`}
            >
              <Moon size={12} /> PM
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-Friendly KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Liters */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Droplet size={18} />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Total Milk Volume</p>
            <p className="text-base sm:text-lg font-extrabold text-slate-900">
              {summary.totalQuantity} <span className="text-xs font-normal text-slate-500">L</span>
            </p>
          </div>
        </div>

        {/* Shift Split */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sun size={18} />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">AM / PM Split</p>
            <p className="text-xs sm:text-sm font-bold text-slate-900">
              <span className="text-amber-700">{summary.morningQuantity}L</span> /{" "}
              <span className="text-indigo-700">{summary.eveningQuantity}L</span>
            </p>
          </div>
        </div>

        {/* Quality Index */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Gauge size={18} />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Avg Fat / SNF</p>
            <p className="text-xs sm:text-sm font-bold text-slate-900">
              {summary.avgFat ? `${summary.avgFat}%` : "--"} / {summary.avgSnf ? `${summary.avgSnf}%` : "--"}
            </p>
          </div>
        </div>

        {/* Procurement Value */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <IndianRupee size={18} />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Total Payout</p>
            <p className="text-base sm:text-lg font-extrabold text-slate-900">
              ₹{summary.totalAmount.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Layout Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendor, CAN, collector..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-1.5 rounded-lg text-xs transition-all ${
              viewMode === "cards" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
            }`}
            title="Mobile Cards View"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg text-xs transition-all ${
              viewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
            }`}
            title="Table View"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Main Collection Entries View */}
      {loading ? (
        <div className="bg-white rounded-2xl md:rounded-3xl p-8 border border-slate-100 shadow-xs text-center space-y-3">
          <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading collection slips...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-white rounded-2xl md:rounded-3xl p-8 border border-slate-100 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
            <ClipboardCheck size={26} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">No Collections Logged</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No milk intake recorded for {selectedDate}. Tap below to log your first collection.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-[#16a34a] text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 inline-flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={15} /> Record Collection
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* MOBILE CARDS VIEW (Primary & Default) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map((item) => {
            const vendorMatch = registeredVendors.find((v) => v.vendor_id === item.vendor_id);
            const vendorPhone = vendorMatch?.phone || item.collector_phone || "";

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xs hover:border-emerald-200 transition-all p-4 flex flex-col justify-between space-y-3.5"
              >
                <div className="space-y-2.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.shift === "MORNING" ? (
                        <div
                          className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0"
                          title="Morning AM Shift"
                        >
                          <Sun size={16} />
                        </div>
                      ) : item.shift === "EVENING" ? (
                        <div
                          className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0"
                          title="Evening PM Shift"
                        >
                          <Moon size={16} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0">
                          <Clock size={16} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{item.vendor_name}</h3>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.collection_id} • {item.shift}
                        </p>
                      </div>
                    </div>

                    {/* Quick Payment Pill */}
                    <button
                      onClick={() => handleTogglePayment(item)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        item.payment_status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                      title="Tap to toggle payment status"
                    >
                      {item.payment_status}
                    </button>
                  </div>

                  {/* Quantity & Payout Highlight Banner */}
                  <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Volume</span>
                      <p className="text-lg font-black text-slate-900">
                        {item.quantity} <span className="text-xs font-semibold text-slate-600">{item.unit}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">@ ₹{item.rate_per_unit}/{item.unit === "Liters" ? "L" : "Kg"}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Total Value</span>
                      <p className="text-lg font-black text-emerald-700">₹{item.total_amount.toLocaleString("en-IN")}</p>
                      <span className="text-[10px] text-slate-400 font-sans">{item.product_name}</span>
                    </div>
                  </div>

                  {/* Quality Badges: Fat, SNF, CAN */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.fat_percentage && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        Fat: {item.fat_percentage}%
                      </span>
                    )}
                    {item.snf_percentage && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                        SNF: {item.snf_percentage}%
                      </span>
                    )}
                    {item.container_can_no && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                        {item.container_can_no}
                      </span>
                    )}
                    {item.clr_reading && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700">
                        CLR: {item.clr_reading}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Quick Action Bar (Mobile Field Optimized) */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {/* Direct Call to Vendor */}
                    {vendorPhone && (
                      <a
                        href={`tel:${vendorPhone}`}
                        className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Call Vendor"
                      >
                        <PhoneCall size={14} />
                      </a>
                    )}

                    {/* WhatsApp Share Receipt */}
                    <a
                      href={getWhatsAppSlipUrl(item, vendorPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Share Receipt on WhatsApp"
                    >
                      <MessageSquare size={14} />
                    </a>

                    {/* Delete Entry */}
                    <button
                      onClick={() => setCollectionToDelete(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Slip"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* View Details Slip */}
                  <button
                    onClick={() => setSelectedCollection(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <Eye size={13} /> Slip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Desktop / Tablet) */
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Shift &amp; Slip</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Volume &amp; Rate</th>
                  <th className="py-3 px-4">Fat / SNF</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {collections.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {item.shift === "MORNING" ? (
                          <Sun size={15} className="text-amber-600" />
                        ) : (
                          <Moon size={15} className="text-indigo-600" />
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{item.shift}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.collection_id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{item.vendor_name}</p>
                      <p className="text-[11px] text-slate-500">{item.collector_name}</p>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">
                        {item.quantity} {item.unit}
                      </p>
                      <p className="text-[10px] text-slate-400">@ ₹{item.rate_per_unit}/{item.unit === "Liters" ? "L" : "Kg"}</p>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {item.fat_percentage && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                            {item.fat_percentage}% Fat
                          </span>
                        )}
                        {item.snf_percentage && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px]">
                            {item.snf_percentage}% SNF
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{item.total_amount.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleTogglePayment(item)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.payment_status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {item.payment_status}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedCollection(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setCollectionToDelete(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
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
      )}

      {/* ========================================================================= */}
      {/* MOBILE STICKY FLOATING ACTION BUTTON (+ RECORD INTAKE) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-4 right-4 sm:hidden z-30">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#16a34a] text-white font-extrabold text-sm shadow-xl shadow-emerald-700/40 active:scale-95 transition-all"
        >
          <Plus size={18} />
          <span>Record Milk</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* RECORD NEW COLLECTION MODAL (MOBILE BOTTOM SHEET & DESKTOP DIALOG) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center font-bold shrink-0">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Record Vendor Milk Intake</h2>
                  <p className="text-[11px] text-slate-500">Quick field entry form</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={(e) => handleAddCollectionSubmit(e, false)}
              className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1"
            >
              {/* Shift & Date Quick Bar */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.collection_date}
                    onChange={(e) => setFormData({ ...formData, collection_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Shift</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shift: "MORNING" })}
                      className={`py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        formData.shift === "MORNING" ? "bg-amber-500 text-white shadow-2xs" : "text-slate-700"
                      }`}
                    >
                      <Sun size={12} /> AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shift: "EVENING" })}
                      className={`py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        formData.shift === "EVENING" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-700"
                      }`}
                    >
                      <Moon size={12} /> PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Vendor Selector (Large Touch Friendly) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>
                    Vendor / Farmer <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Registered Producers</span>
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => handleVendorSelect(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  {registeredVendors.length > 0 ? (
                    registeredVendors.map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.business_name} ({v.contact_person})
                      </option>
                    ))
                  ) : (
                    <option value="">No vendors found</option>
                  )}
                </select>
              </div>

              {/* Quantity, Rate & Live Total Banner */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Quantity (Liters) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g. 50.0"
                    className="w-full px-3.5 py-2.5 bg-emerald-50/40 border border-emerald-300 rounded-xl text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none"
                  />
                  {/* Quick Quantity Presets for One-Touch Mobile Entry */}
                  <div className="flex gap-1 pt-0.5">
                    {["20", "30", "50", "100"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData({ ...formData, quantity: preset })}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold"
                      >
                        +{preset}L
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Rate per Liter (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    inputMode="decimal"
                    value={formData.rate_per_unit}
                    onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
                    placeholder="42.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                  {/* Quick Rate Presets */}
                  <div className="flex gap-1 pt-0.5">
                    {["40", "42", "45", "50"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({ ...formData, rate_per_unit: r })}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold"
                      >
                        ₹{r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Amount Banner */}
              {Number(formData.quantity) > 0 && (
                <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950">Payout Amount:</span>
                  <span className="text-lg font-black text-emerald-900">
                    ₹{(Number(formData.quantity) * (Number(formData.rate_per_unit) || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Milk Quality Test Section (Fat, SNF, CLR, Can) */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Gauge size={14} className="text-emerald-600" /> Milk Quality Testing
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700">Lab &amp; Lactometer</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-700">Fat %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      inputMode="decimal"
                      value={formData.fat_percentage}
                      onChange={(e) => setFormData({ ...formData, fat_percentage: e.target.value })}
                      placeholder="4.5"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-center"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-700">SNF %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      inputMode="decimal"
                      value={formData.snf_percentage}
                      onChange={(e) => setFormData({ ...formData, snf_percentage: e.target.value })}
                      placeholder="8.5"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-center"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-700">CLR Reading</label>
                    <input
                      type="number"
                      step="0.5"
                      inputMode="decimal"
                      value={formData.clr_reading}
                      onChange={(e) => setFormData({ ...formData, clr_reading: e.target.value })}
                      placeholder="28.5"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-center"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-700">Can No.</label>
                    <input
                      type="text"
                      value={formData.container_can_no}
                      onChange={(e) => setFormData({ ...formData, container_can_no: e.target.value })}
                      placeholder="CAN-01"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Collector Name & Payment Status */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Collector Person</label>
                  <input
                    type="text"
                    required
                    value={formData.collector_name}
                    onChange={(e) => setFormData({ ...formData, collector_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Payment Status</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none font-semibold"
                  >
                    <option value="PENDING">Pending (Weekly)</option>
                    <option value="PAID">Paid Instant</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Remarks (Optional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Morning yield, chilled"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={addLoading}
                    onClick={(e) => handleAddCollectionSubmit(e, true)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                  >
                    <PlusCircle size={14} /> Next Vendor
                  </button>

                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16a34a] hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {addLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Save Intake</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COLLECTION DETAIL MODAL / RECEIPT VIEW */}
      {/* ========================================================================= */}
      {selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Collection Receipt</h2>
                  <p className="text-[10px] text-slate-500 font-mono">{selectedCollection.collection_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCollection(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Slip Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 font-mono text-xs">
                <div className="text-center pb-2 border-b border-dashed border-slate-300">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 uppercase">F2H Fresh Dairy &amp; Produce</h3>
                  <p className="text-[10px] text-slate-500 font-sans">Field Intake Receipt</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-sans">Date:</span>
                    <strong className="text-slate-800">
                      {selectedCollection.collection_date} ({selectedCollection.shift})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">Container:</span>
                    <strong className="text-slate-800">{selectedCollection.container_can_no || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">Vendor:</span>
                    <strong className="text-slate-800">{selectedCollection.vendor_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">Collector:</span>
                    <strong className="text-slate-800">{selectedCollection.collector_name}</strong>
                  </div>
                </div>

                {/* Quality Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-sans text-slate-600">Product:</span>
                    <span className="font-bold text-slate-900">{selectedCollection.product_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-sans text-slate-600">Volume:</span>
                    <span className="font-bold text-slate-900">
                      {selectedCollection.quantity} {selectedCollection.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-sans text-slate-600">Rate:</span>
                    <span className="font-bold text-slate-900">₹{selectedCollection.rate_per_unit}/{selectedCollection.unit === 'Liters' ? 'L' : 'Kg'}</span>
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
                      <span className="font-sans text-slate-600">CLR Reading:</span>
                      <span className="font-bold text-blue-700">{selectedCollection.clr_reading}</span>
                    </div>
                  )}
                </div>

                {/* Total Payout */}
                <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-300 text-sm">
                  <span className="font-bold text-slate-800 uppercase">Payout:</span>
                  <span className="font-bold text-base text-emerald-800">
                    ₹{selectedCollection.total_amount.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="text-center pt-1 text-[10px] text-slate-400 font-sans">
                  Status: <strong className="text-slate-700">{selectedCollection.payment_status}</strong> (Mode:{" "}
                  {selectedCollection.payment_mode || "CASH"})
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex items-center justify-between gap-2">
              <a
                href={getWhatsAppSlipUrl(selectedCollection)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <MessageSquare size={14} /> WhatsApp Slip
              </a>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleTogglePayment(selectedCollection)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    selectedCollection.payment_status === "PAID"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {selectedCollection.payment_status === "PAID" ? "Mark Pending" : "Mark Paid"}
                </button>

                <button
                  onClick={() => setSelectedCollection(null)}
                  className="px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {collectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Remove Collection Slip?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Remove slip <span className="font-mono font-semibold">{collectionToDelete.collection_id}</span> for{" "}
                <span className="font-semibold">{collectionToDelete.vendor_name}</span>?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setCollectionToDelete(null)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCollection}
                disabled={deleteLoading}
                className="px-3.5 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 flex items-center gap-1.5 disabled:opacity-50"
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
