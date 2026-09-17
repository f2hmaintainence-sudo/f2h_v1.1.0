"use client";

// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Admin Registered Vendors & Producers)
// Description : Management section for all registered vendors under Catalog & Inventory
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Home,
  ChevronRight,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  X,
  Package,
  Layers,
  Award,
  ShieldCheck,
  TrendingUp,
  LayoutGrid,
  List,
  AlertCircle,
  FileText,
  BadgeCheck,
  Sparkles,
  PhoneCall,
  MessageSquare,
  Building,
  Check,
  Calendar,
  Star,
  ChevronDown
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

interface SuppliedProduct {
  product_id?: string;
  name: string;
  category?: string;
}

interface VendorRecord {
  id: number;
  vendor_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string | null;
  category: string;
  description?: string | null;
  address?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  gstin?: string | null;
  fssai_license?: string | null;
  supply_capacity?: string | null;
  experience_years?: string | null;
  rating?: number;
  products_supplied?: SuppliedProduct[];
  total_products_supplied?: number;
  is_verified?: boolean;
  is_active?: boolean;
  status?: string;
  image_url?: string | null;
  created_at: string;
}

interface ProductOption {
  product_id: string;
  name: string;
  category: string;
}

const CATEGORY_OPTIONS = [
  "All",
  "Organic Vegetables",
  "Fresh Fruits",
  "Dairy & Milk",
  "Cold Pressed Oils",
  "Grains & Pulses",
  "Farm Poultry & Eggs",
  "Spices & Herbs",
  "Hydroponics & Greens"
];

function formatWhatsAppPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export default function RegisteredVendorsPage() {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Detail Modal State
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null);

  // Add Vendor Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [selectedProductNames, setSelectedProductNames] = useState<string[]>([]);

  // Delete Confirm State
  const [vendorToDelete, setVendorToDelete] = useState<VendorRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // New Vendor Form
  const [formData, setFormData] = useState({
    business_name: "",
    contact_person: "",
    phone: "",
    email: "",
    category: "Organic Vegetables",
    description: "",
    address: "",
    city: "Kuppam",
    state: "Andhra Pradesh",
    pincode: "",
    gstin: "",
    fssai_license: "",
    supply_capacity: "100-500 kg/day",
    experience_years: "3+ Years",
    image_url: ""
  });

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/vendors/public", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setVendors(data.data);
      } else {
        setVendors([]);
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load registered vendors");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProductCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/vendors/products", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableProducts(data.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchVendors();
    fetchProductCatalog();
  }, [fetchVendors, fetchProductCatalog]);

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return (vendors || []).filter((v) => {
      if (!v) return false;
      const vCat = String(v.category || "");
      // Category filter
      if (selectedCategory !== "All" && !vCat.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
      // Verification filter
      if (verificationFilter === "verified" && !v.is_verified) return false;
      if (verificationFilter === "pending" && v.is_verified) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesBusiness = String(v.business_name || "").toLowerCase().includes(q);
        const matchesContact = String(v.contact_person || "").toLowerCase().includes(q);
        const matchesPhone = String(v.phone || "").toLowerCase().includes(q);
        const matchesEmail = String(v.email || "").toLowerCase().includes(q);
        const matchesCity = String(v.city || "").toLowerCase().includes(q);
        const matchesCategory = vCat.toLowerCase().includes(q);
        const matchesProducts = Array.isArray(v.products_supplied) && v.products_supplied.some((p) => String(p?.name || "").toLowerCase().includes(q));
        return (
          matchesBusiness ||
          matchesContact ||
          matchesPhone ||
          matchesEmail ||
          matchesCity ||
          matchesCategory ||
          matchesProducts
        );
      }

      return true;
    });
  }, [vendors, selectedCategory, verificationFilter, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const list = vendors || [];
    const total = list.length;
    const verified = list.filter((v) => v && v.is_verified).length;
    const categoriesSet = new Set(list.map((v) => v?.category).filter(Boolean));
    const totalProducts = list.reduce(
      (acc, v) => acc + (Array.isArray(v?.products_supplied) ? v.products_supplied.length : (Number(v?.total_products_supplied) || 0)),
      0
    );

    return {
      total,
      verified,
      categoriesCount: categoriesSet.size,
      totalProducts
    };
  }, [vendors]);

  // Toggle verification status
  const handleToggleVerification = async (vendor: VendorRecord) => {
    try {
      const newStatus = !vendor.is_verified;
      const res = await fetch(`/api/v1/vendors/${vendor.vendor_id || vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_verified: newStatus, status: newStatus ? "VERIFIED" : "PENDING" })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessToast(
          `Vendor "${vendor.business_name}" marked as ${newStatus ? "Verified" : "Pending Verification"}`
        );
        setVendors((prev) =>
          prev.map((item) =>
            item.vendor_id === vendor.vendor_id
              ? { ...item, is_verified: newStatus, status: newStatus ? "VERIFIED" : "PENDING" }
              : item
          )
        );
        if (selectedVendor && selectedVendor.vendor_id === vendor.vendor_id) {
          setSelectedVendor({
            ...selectedVendor,
            is_verified: newStatus,
            status: newStatus ? "VERIFIED" : "PENDING"
          });
        }
      } else {
        showErrorToast(data.message || "Failed to update vendor status");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to update verification status");
    }
  };

  // Delete vendor
  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/vendors/${vendorToDelete.vendor_id || vendorToDelete.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        showSuccessToast(`Vendor "${vendorToDelete.business_name}" removed successfully`);
        setVendors((prev) => prev.filter((v) => v.vendor_id !== vendorToDelete.vendor_id));
        if (selectedVendor && selectedVendor.vendor_id === vendorToDelete.vendor_id) {
          setSelectedVendor(null);
        }
        setVendorToDelete(null);
      } else {
        showErrorToast(data.message || "Failed to delete vendor");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to delete vendor");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Submit new vendor registration
  const handleAddVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.business_name.trim()) {
      showErrorToast("Business name is required");
      return;
    }
    if (!formData.phone.trim()) {
      showErrorToast("Phone number is required");
      return;
    }

    setAddLoading(true);
    try {
      const suppliedProductsList = selectedProductNames.map((name) => {
        const found = availableProducts.find((p) => p.name.toLowerCase() === name.toLowerCase());
        return {
          product_id: found?.product_id || `prod-${Date.now()}`,
          name: name,
          category: found?.category || formData.category
        };
      });

      const payload = {
        ...formData,
        products_supplied: suppliedProductsList,
        total_products_supplied: suppliedProductsList.length,
        is_verified: true,
        is_active: true,
        status: "VERIFIED"
      };

      const res = await fetch("/api/v1/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showSuccessToast("Vendor registered successfully!");
        setIsAddModalOpen(false);
        // Reset form
        setFormData({
          business_name: "",
          contact_person: "",
          phone: "",
          email: "",
          category: "Organic Vegetables",
          description: "",
          address: "",
          city: "Kuppam",
          state: "Andhra Pradesh",
          pincode: "",
          gstin: "",
          fssai_license: "",
          supply_capacity: "100-500 kg/day",
          experience_years: "3+ Years",
          image_url: ""
        });
        setSelectedProductNames([]);
        fetchVendors();
      } else {
        showErrorToast(data.message || "Failed to register vendor");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Error registering vendor");
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleProductSelection = (prodName: string) => {
    setSelectedProductNames((prev) =>
      prev.includes(prodName) ? prev.filter((p) => p !== prodName) : [...prev, prodName]
    );
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
        <span className="font-semibold text-slate-800">Registered Vendors</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Registered Vendors &amp; Producers</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-800">
                {vendors.length} Registered
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage verified local farmers, dairy units, and fresh food producers supplying F2H
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchVendors}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-xs"
            title="Refresh vendor list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#16a34a] hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={15} />
            <span>Register Vendor</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Vendors</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Verified Producers</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats.verified}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Categories</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats.categoriesCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Products Supplied</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats.totalProducts}</p>
          </div>
        </div>
      </div>

      {/* Category Pills & Search / Filters Toolbar */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
        {/* Category Scrollable Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search, Verification Filter & View Toggle */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor, contact, phone, city, or product..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Status Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setVerificationFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  verificationFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setVerificationFilter("verified")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  verificationFilter === "verified" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setVerificationFilter("pending")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  verificationFilter === "pending" ? "bg-white text-amber-700 shadow-xs" : "text-slate-600"
                }`}
              >
                Pending
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  viewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
                title="Table View"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Vendor Content Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-slate-50 rounded-xl" />
              <div className="flex gap-2">
                <div className="h-6 bg-slate-100 rounded-lg w-1/3" />
                <div className="h-6 bg-slate-100 rounded-lg w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Building2 size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No Registered Vendors Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || selectedCategory !== "All" || verificationFilter !== "all"
                ? "Try adjusting your search filters or selected category."
                : "No vendors registered yet. Use the 'Register Vendor' button to add your first supplier."}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            {(searchQuery || selectedCategory !== "All" || verificationFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setVerificationFilter("all");
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
              <Plus size={14} /> Register Vendor
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => {
            const hasImage = Boolean(vendor.image_url && vendor.image_url.startsWith("http"));
            const productsList = vendor.products_supplied || [];

            return (
              <div
                key={vendor.id || vendor.vendor_id}
                className="bg-white rounded-3xl border border-slate-100/80 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-4">
                  {/* Top Row: Avatar/Image + Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {hasImage ? (
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200/60 bg-slate-50 shrink-0">
                          <img
                            src={vendor.image_url!}
                            alt={vendor.business_name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                          {String(vendor.business_name || "V").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {vendor.business_name}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{vendor.contact_person}</span>
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <MapPin size={11} className="text-slate-400" />
                          <span>{vendor.city}, {vendor.state}</span>
                        </div>
                      </div>
                    </div>

                    {/* Verification Status Pill */}
                    <div>
                      {vendor.is_verified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                          <Clock size={11} className="text-amber-600" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category & Experience / Capacity Metrics */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {vendor.category}
                    </span>
                    {vendor.experience_years && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-emerald-50/60 text-emerald-800 border border-emerald-100">
                        {vendor.experience_years} Exp
                      </span>
                    )}
                    {vendor.supply_capacity && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50/60 text-blue-800 border border-blue-100">
                        Cap: {vendor.supply_capacity}
                      </span>
                    )}
                  </div>

                  {/* Products Supplied Pills */}
                  {productsList.length > 0 && (
                    <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                        <span className="flex items-center gap-1">
                          <Package size={12} className="text-emerald-600" />
                          Supplies ({productsList.length} items)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {productsList.slice(0, 3).map((prod, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-slate-800 border border-slate-200/60 shadow-2xs line-clamp-1"
                          >
                            {prod.name}
                          </span>
                        ))}
                        {productsList.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            +{productsList.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Contact Line */}
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Phone size={13} className="text-emerald-600" />
                      <span>{vendor.phone}</span>
                    </div>
                    {vendor.rating !== undefined && vendor.rating !== null && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span>{Number(vendor.rating || 0).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Call Direct */}
                    <a
                      href={`tel:${vendor.phone}`}
                      className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Call Vendor"
                    >
                      <PhoneCall size={14} />
                    </a>

                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/${formatWhatsAppPhone(vendor.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Chat on WhatsApp"
                    >
                      <MessageSquare size={14} />
                    </a>

                    {/* Toggle Verification */}
                    <button
                      onClick={() => handleToggleVerification(vendor)}
                      className={`p-2 rounded-xl transition-colors ${
                        vendor.is_verified
                          ? "text-emerald-600 hover:bg-emerald-100/50"
                          : "text-slate-400 hover:text-emerald-600 hover:bg-slate-200"
                      }`}
                      title={vendor.is_verified ? "Mark as Pending" : "Mark as Verified"}
                    >
                      <BadgeCheck size={15} />
                    </button>

                    {/* Delete Vendor */}
                    <button
                      onClick={() => setVendorToDelete(vendor)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Vendor"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* View Full Profile */}
                  <button
                    onClick={() => setSelectedVendor(vendor)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                  >
                    <Eye size={13} />
                    <span>Details</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Vendor &amp; Contact</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Products Supplied</th>
                  <th className="py-3.5 px-4">City / State</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredVendors.map((vendor) => {
                  const hasImage = Boolean(vendor.image_url && vendor.image_url.startsWith("http"));
                  const productsCount = vendor.products_supplied?.length || vendor.total_products_supplied || 0;

                  return (
                    <tr key={vendor.id || vendor.vendor_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {hasImage ? (
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                              <img
                                src={vendor.image_url!}
                                alt={vendor.business_name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {String(vendor.business_name || "V").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{vendor.business_name}</p>
                            <p className="text-[11px] text-slate-500">
                              {vendor.contact_person} • {vendor.phone}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800">
                          {vendor.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            {productsCount} Items
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="text-slate-800 font-medium">{vendor.city}</p>
                        <p className="text-[11px] text-slate-400">{vendor.state}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        {vendor.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} className="text-emerald-600" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                            <Clock size={11} className="text-amber-600" /> Pending
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedVendor(vendor)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleVerification(vendor)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Toggle Verification"
                          >
                            <BadgeCheck size={15} />
                          </button>
                          <button
                            onClick={() => setVendorToDelete(vendor)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VENDOR DETAIL MODAL / SLIDEOVER */}
      {/* ========================================================================= */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-start justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-3.5">
                {selectedVendor.image_url && selectedVendor.image_url.startsWith("http") ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                    <img
                      src={selectedVendor.image_url}
                      alt={selectedVendor.business_name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-xl shrink-0">
                    {String(selectedVendor.business_name || "V").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedVendor.business_name}</h2>
                    {selectedVendor.is_verified && (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID: <span className="font-mono text-slate-700">{selectedVendor.vendor_id}</span> • Registered on{" "}
                    {selectedVendor.created_at
                      ? new Date(selectedVendor.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })
                      : "Recent"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedVendor(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 md:p-6 space-y-6">
              {/* Top info badge row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Category</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedVendor.category}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Supply Capacity</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedVendor.supply_capacity || "Not Specified"}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Experience</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedVendor.experience_years || "1+ Year"}
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={14} className="text-emerald-600" /> Contact Details
                </h3>
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                    <span className="font-semibold text-slate-800">{selectedVendor.contact_person}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Phone:</span>
                    <span className="font-semibold text-slate-800">{selectedVendor.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address:</span>
                    <span className="font-semibold text-slate-800">{selectedVendor.email || "support@f2hfresh.com"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Location / City:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedVendor.city}, {selectedVendor.state}{" "}
                      {selectedVendor.pincode ? `(${selectedVendor.pincode})` : ""}
                    </span>
                  </div>
                  {selectedVendor.address && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Full Address / Facility:</span>
                      <span className="font-semibold text-slate-800">{selectedVendor.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Credentials (GST / FSSAI) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-600" /> Business Credentials &amp; Licenses
                </h3>
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">GSTIN Number:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedVendor.gstin || "Not Applicable / Unregistered"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">FSSAI License:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedVendor.fssai_license || "Verified Local Producer"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Products Supplied List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} className="text-purple-600" /> Products Supplied (
                  {selectedVendor.products_supplied?.length || 0})
                </h3>
                {selectedVendor.products_supplied && selectedVendor.products_supplied.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedVendor.products_supplied.map((prod, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                            ✓
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900">{prod.name}</p>
                            <p className="text-[10px] text-slate-400">{prod.category || selectedVendor.category}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No specific products mapped to this vendor yet.</p>
                )}
              </div>

              {/* Vendor Description */}
              {selectedVendor.description && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">About Vendor</h3>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {selectedVendor.description}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Direct Action Buttons */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${selectedVendor.phone}`}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <PhoneCall size={14} /> Call Vendor
                </a>
                <a
                  href={`https://wa.me/${formatWhatsAppPhone(selectedVendor.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare size={14} /> WhatsApp
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleVerification(selectedVendor)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    selectedVendor.is_verified
                      ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {selectedVendor.is_verified ? "Revoke Verification" : "Verify Vendor"}
                </button>

                <button
                  onClick={() => setSelectedVendor(null)}
                  className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REGISTER NEW VENDOR MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Register New Producer / Vendor</h2>
                  <p className="text-xs text-slate-500">Add a verified supplier to the F2H catalog registry</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddVendorSubmit} className="p-5 md:p-6 space-y-5">
              {/* Business & Contact Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Business / Farm Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="e.g., Kuppam Organic Agro Farms"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Contact Person Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g., Ramesh Naidu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="support@f2hfresh.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Primary Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Supply Capacity</label>
                  <input
                    type="text"
                    value={formData.supply_capacity}
                    onChange={(e) => setFormData({ ...formData, supply_capacity: e.target.value })}
                    placeholder="e.g. 200 kg/day"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Experience</label>
                  <input
                    type="text"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                    placeholder="e.g. 5+ Years"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* City, State, Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">City / Town</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="517425"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Multi-Product Selector from Live Products Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Package size={14} className="text-emerald-600" />
                    Select Products Supplied by this Vendor
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700">
                    {selectedProductNames.length} Selected
                  </span>
                </div>

                {availableProducts.length > 0 ? (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-40 overflow-y-auto space-y-1.5">
                    {availableProducts.map((prod) => {
                      const isSelected = selectedProductNames.includes(prod.name);
                      return (
                        <button
                          key={prod.product_id || prod.name}
                          type="button"
                          onClick={() => handleToggleProductSelection(prod.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                              : "bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-100"
                          }`}
                        >
                          <span>{prod.name}</span>
                          <span className={`text-[10px] ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                            {prod.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No products loaded yet from the catalog.</p>
                )}
              </div>

              {/* Image URL / Photo Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Profile / Farm Image URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/... (optional)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
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
                  <span>Register Vendor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Remove Registered Vendor?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove{" "}
                <span className="font-semibold text-slate-800">{vendorToDelete.business_name}</span> from the
                registered vendor list? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setVendorToDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVendor}
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
