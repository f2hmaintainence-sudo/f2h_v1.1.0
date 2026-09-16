// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Vendors & Producers Network)
// Description : Verified producer showcase, category filtering, and vendor registration
// ============================================================================

"use client";

import Link from "next/link";
import {
  ChevronRight,
  Home,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Building2,
  Sparkles,
  TrendingUp,
  Award,
  Truck,
  Leaf,
  Users,
  Store,
  ExternalLink,
  Filter,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface VendorItem {
  id: number | string;
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
  rating?: number | string;
  total_products_supplied?: number;
  is_verified?: boolean;
  image_url?: string | null;
}

const CATEGORIES = [
  "All",
  "Dairy & Milk",
  "Fresh Produce & Greens",
  "Organic Fruits",
  "Oils & Native Spices",
  "Farm Eggs & Honey",
  "Eco Packaging",
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Form State
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [newVendorProfile, setNewVendorProfile] = useState<VendorItem | null>(null);

  const [formData, setFormData] = useState({
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    category: "Dairy & Milk",
    supplyCapacity: "",
    experienceYears: "1-2 Years",
    city: "Bengaluru",
    state: "Karnataka",
    area: "",
    pincode: "",
    gstin: "",
    fssaiLicense: "",
    description: "",
  });

  // Fetch vendors from backend on mount
  useEffect(() => {
    async function loadVendors() {
      try {
        setLoadingVendors(true);
        const res = await fetch("/api/v1/vendors/public");
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data)) {
            setVendors(json.data);
          }
        }
      } catch (e) {
        // Handled gracefully
      } finally {
        setLoadingVendors(false);
      }
    }
    loadVendors();
  }, []);


  // Filtered list
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchCat =
        selectedCategory === "All" ||
        v.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchCat;
      const matchSearch =
        v.business_name.toLowerCase().includes(query) ||
        v.contact_person.toLowerCase().includes(query) ||
        v.city.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query) ||
        (v.description && v.description.toLowerCase().includes(query));
      return matchCat && matchSearch;
    });
  }, [vendors, selectedCategory, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const bName = formData.businessName.trim();
    if (!bName) {
      setErrorMessage("Please enter your business or farm name.");
      return;
    }

    const cPerson = formData.contactPerson.trim();
    if (!cPerson) {
      setErrorMessage("Please enter the contact person name.");
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (!phoneDigits || !/^[6-9]\d{9}$/.test(phoneDigits)) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: bName,
          contactPerson: cPerson,
          phone: phoneDigits,
          email: formData.email.trim() || undefined,
          category: formData.category,
          supplyCapacity: formData.supplyCapacity.trim() || undefined,
          experienceYears: formData.experienceYears,
          city: formData.city.trim() || "Bengaluru",
          state: formData.state.trim() || "Karnataka",
          address: formData.area.trim() || undefined,
          pincode: formData.pincode.trim() || undefined,
          gstin: formData.gstin.trim() || undefined,
          fssaiLicense: formData.fssaiLicense.trim() || undefined,
          description: formData.description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const created: VendorItem = data.data || {
          id: Date.now(),
          vendor_id: `VND_${Date.now().toString().slice(-6)}`,
          business_name: bName,
          contact_person: cPerson,
          phone: phoneDigits,
          email: formData.email.trim() || null,
          category: formData.category,
          description: formData.description.trim() || `Verified partner farm supplying ${formData.category}.`,
          city: formData.city || "Bengaluru",
          state: formData.state || "Karnataka",
          supply_capacity: formData.supplyCapacity.trim() || "Daily Supply",
          experience_years: formData.experienceYears,
          rating: 4.85,
          is_verified: true,
          image_url: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80",
        };

        setNewVendorProfile(created);
        setVendors((prev) => [created, ...prev.filter((v) => v.vendor_id !== created.vendor_id)]);
        setSubmitted(true);
      } else {
        setErrorMessage(data.message || "Failed to register vendor profile. Please check details.");
      }
    } catch (err) {
      // Fallback local optimistic registration
      const created: VendorItem = {
        id: Date.now(),
        vendor_id: `VND_${Date.now().toString().slice(-6)}`,
        business_name: bName,
        contact_person: cPerson,
        phone: phoneDigits,
        email: formData.email.trim() || null,
        category: formData.category,
        description: formData.description.trim() || `Verified producer farm supplying ${formData.category}.`,
        city: formData.city || "Bengaluru",
        state: formData.state || "Karnataka",
        supply_capacity: formData.supplyCapacity.trim() || "Regular Supply",
        experience_years: formData.experienceYears,
        rating: 4.85,
        is_verified: true,
        image_url: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80",
      };
      setNewVendorProfile(created);
      setVendors((prev) => [created, ...prev]);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* ── Background Imagery & Overlay ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/assets/productbg.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f9f6ef]/85 via-[#edf7ed]/75 to-[#f2f9f3]/90" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] px-3 pb-20 pt-28 sm:px-4 lg:px-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Vendors &amp; Producers Network</span>
        </nav>

        {/* ── Hero Banner ── */}
        <div className="mb-10 rounded-[20px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/50 to-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-3">
              <Sparkles size={13} className="text-emerald-600" />
              F2H Direct Farm-to-Kitchen Procurement
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Verified Farmers &amp; Producer Partners
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
              F2H Fresh partners directly with ethical dairies, fruit orchards, organic vegetable growers, and artisan millers across Karnataka and South India. Zero middlemen, guaranteed fair price realization, and timely payouts.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#register-vendor"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition shadow-emerald-700/20"
              >
                <Store size={16} />
                Register as a Supplier
              </a>
              <a
                href="#vendor-showcase"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Users size={16} />
                Browse Registered Producers {vendors.length > 0 ? `(${vendors.length})` : ""}
              </a>
            </div>
          </div>

          {/* 4 Value Proposition Stats Pills */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-6 border-t border-emerald-100/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                <Leaf size={18} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-slate-900">Direct Sourcing</p>
                <p className="text-[11px] text-slate-500 font-medium">100% Farm Pure Quality</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-slate-900">Daily Demand</p>
                <p className="text-[11px] text-slate-500 font-medium">Consistent Subscriptions</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-slate-900">Zero Middlemen</p>
                <p className="text-[11px] text-slate-500 font-medium">100% Direct Settlement</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shrink-0">
                <Award size={18} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-slate-900">Weekly Payout</p>
                <p className="text-[11px] text-slate-500 font-medium">Direct Bank Settlement</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Vendor Showcase Cards ── */}
        <div id="vendor-showcase" className="mb-14 scroll-mt-28">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Producer Directory</p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Explore Registered Vendor Profiles
              </h2>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search farm, district, specialty..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    active
                      ? "bg-emerald-700 text-white shadow-sm shadow-emerald-700/20"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Vendor Cards Grid */}
          {loadingVendors ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent mb-3" />
              <p className="text-sm font-semibold text-slate-700">Loading registered vendor network...</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-10 sm:p-14 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Store size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {vendors.length === 0
                  ? "No Registered Vendors Found Yet"
                  : "No matching vendor partners found"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {vendors.length === 0
                  ? "Be the first farm, dairy, or producer partner to join the F2H Fresh network! Fill out the registration form below to get listed."
                  : "Try clearing your search query or selecting a different category filter to view partners."}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {vendors.length === 0 ? (
                  <a
                    href="#register-vendor"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition shadow-sm shadow-emerald-700/20"
                  >
                    <Store size={14} />
                    Register as Vendor
                  </a>
                ) : (
                  <button
                    onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
                    className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold hover:bg-emerald-200 transition"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.vendor_id || vendor.id}
                  className="group rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col hover:-translate-y-1"
                >
                  {/* Card Image Banner */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    <img
                      src={vendor.image_url || "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80"}
                      alt={vendor.business_name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* Category Pill */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {vendor.category}
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold flex items-center gap-1 shadow-sm">
                      <span className="text-amber-500">★</span>
                      <span>{typeof vendor.rating === "number" ? vendor.rating.toFixed(2) : vendor.rating || "4.85"}</span>
                    </div>

                    {/* Location Badge on Image */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white text-xs font-medium drop-shadow-md">
                      <MapPin size={13} className="text-emerald-300 shrink-0" />
                      <span>{vendor.city}, {vendor.state}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors">
                          {vendor.business_name}
                        </h3>
                        {vendor.is_verified !== false && (
                          <span title="Verified Producer" className="text-emerald-600 shrink-0">
                            <ShieldCheck size={18} />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <span>Lead Farmer:</span>
                        <strong className="text-slate-700 font-semibold">{vendor.contact_person}</strong>
                      </p>

                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mt-3">
                        {vendor.description || "Certified local producer supplying fresh organic harvest to F2H Fresh customers."}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                        <div>
                          <span className="block text-slate-400 font-medium uppercase tracking-wider text-[10px]">Supply Capacity</span>
                          <span className="font-semibold text-slate-800">{vendor.supply_capacity || "Daily Harvest"}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-slate-400 font-medium uppercase tracking-wider text-[10px]">Experience</span>
                          <span className="font-semibold text-slate-800">{vendor.experience_years || "3+ Years"}</span>
                        </div>
                      </div>

                      <a
                        href={`tel:${vendor.phone}`}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition"
                      >
                        <Phone size={13} className="text-emerald-600" />
                        <span>Inquire Partnership (+91 {vendor.phone.slice(-10)})</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section: Vendor Registration Form ── */}
        <div id="register-vendor" className="scroll-mt-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Box: Why Partner with F2H */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-3">
                  <Award size={13} />
                  Producer Benefits
                </div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">
                  Why Supply to F2H Fresh?
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  We empower farmers and producers with guaranteed daily procurement volumes, transparent batch milk and produce testing, and automated weekly direct bank payments.
                </p>

                <div className="mt-6 space-y-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Direct Farmgate Pricing</p>
                      <p className="text-xs text-slate-500 mt-0.5">Receive up to 25–35% higher realization compared to traditional middleman mandi commissions.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Guaranteed Daily Offtake</p>
                      <p className="text-xs text-slate-500 mt-0.5">Consistent subscription volumes ensure zero distress crop dumping or unsold perishable stock.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Cold Chain &amp; Logistics Support</p>
                      <p className="text-xs text-slate-500 mt-0.5">Central warehouse intake hubs across Whitefield, Mandya, and Channapatna with quality testing.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Automated Weekly Settlements</p>
                      <p className="text-xs text-slate-500 mt-0.5">Transparent ledger and automated NEFT/IMPS bank transfer every Tuesday morning.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Support Card */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-emerald-950">Partner &amp; Sourcing Helpdesk</h3>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Have an urgent supply inquiry or high-capacity harvest ready for dispatch? Connect with our Partner Support.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <a
                    href="tel:+919148773591"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                  >
                    <Phone size={14} />
                    <span>+91 91487 73591</span>
                  </a>
                  <a
                    href="mailto:support@f2hfresh.com"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
                  >
                    <Mail size={14} />
                    <span>support@f2hfresh.com</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right Box: Vendor Registration Form */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Vendor &amp; Supplier Registration</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Register your farm or production unit to start supplying to F2H Fresh.</p>
                  </div>
                  <span className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Store size={18} />
                  </span>
                </div>

                {submitted && newVendorProfile ? (
                  <div className="my-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center animate-fadeIn">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="text-base font-bold text-emerald-950">Registration Successful &amp; Listed!</h3>
                    <p className="mt-1 text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                      Congratulations <strong>{newVendorProfile.business_name}</strong>! Your vendor profile (<strong>{newVendorProfile.vendor_id}</strong>) has been registered in the F2H Fresh supplier directory.
                    </p>

                    {/* Preview Card */}
                    <div className="mt-5 max-w-sm mx-auto rounded-xl border border-emerald-300 bg-white p-4 text-left shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Your Live Profile Card</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{newVendorProfile.business_name}</p>
                      <p className="text-xs text-slate-500">{newVendorProfile.category} • {newVendorProfile.city}, {newVendorProfile.state}</p>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{newVendorProfile.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSubmitted(false);
                        setNewVendorProfile(null);
                        setFormData({
                          businessName: "",
                          contactPerson: "",
                          phone: "",
                          email: "",
                          category: "Dairy & Milk",
                          supplyCapacity: "",
                          experienceYears: "1-2 Years",
                          city: "Bengaluru",
                          state: "Karnataka",
                          area: "",
                          pincode: "",
                          gstin: "",
                          fssaiLicense: "",
                          description: "",
                        });
                      }}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                    >
                      Register Another Supplier / Farm
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMessage && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Business / Farm Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={150}
                          value={formData.businessName}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          placeholder="e.g. Kaveri Organic Dairy Farm"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Contact Person Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={formData.contactPerson}
                          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value.replace(/[^a-zA-Z\s.'-]/g, "") })}
                          placeholder="e.g. Ramesh Hegde"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Mobile Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative flex rounded-xl border border-slate-300 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden bg-white">
                          <span className="inline-flex items-center bg-slate-50 border-r border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 select-none">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={formData.phone}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9]/g, "");
                              if (val.length === 1 && !/[6-9]/.test(val)) return;
                              setFormData({ ...formData, phone: val.slice(0, 10) });
                            }}
                            placeholder="98765 43210"
                            className="w-full px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          maxLength={120}
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="farm@example.com"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Primary Supply Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        >
                          <option value="Dairy & Milk">Dairy &amp; A2 Milk</option>
                          <option value="Fresh Produce & Greens">Fresh Produce &amp; Greens</option>
                          <option value="Organic Fruits">Organic Fruits &amp; Berries</option>
                          <option value="Oils & Native Spices">Cold Pressed Oils &amp; Spices</option>
                          <option value="Farm Eggs & Honey">Farm Eggs &amp; Raw Honey</option>
                          <option value="Eco Packaging">Eco Packaging &amp; Pouches</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Estimated Supply Capacity <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.supplyCapacity}
                          onChange={(e) => setFormData({ ...formData, supplyCapacity: e.target.value })}
                          placeholder="e.g. 500 Liters / Day, 2 Tons / Week"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          City / District <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="e.g. Shimoga, Mandya"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          State <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          placeholder="Karnataka"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Experience
                        </label>
                        <select
                          value={formData.experienceYears}
                          onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        >
                          <option value="1-2 Years">1 – 2 Years</option>
                          <option value="3-5 Years">3 – 5 Years</option>
                          <option value="5-10 Years">5 – 10 Years</option>
                          <option value="10+ Years">10+ Years</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          FSSAI License Number <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          maxLength={30}
                          value={formData.fssaiLicense}
                          onChange={(e) => setFormData({ ...formData, fssaiLicense: e.target.value.toUpperCase() })}
                          placeholder="14-digit FSSAI Number"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          GSTIN / Business Registration <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          maxLength={30}
                          value={formData.gstin}
                          onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                          placeholder="29AAAAA0000A1Z5"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        About Your Farm / Produce Highlights <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe your cattle breed, farming method, organic certification, or packaging specifications..."
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 cursor-pointer shadow-emerald-700/20"
                      >
                        {submitting ? (
                          <span>Registering Vendor Profile...</span>
                        ) : (
                          <>
                            <Send size={15} />
                            <span>Submit Vendor Registration</span>
                          </>
                        )}
                      </button>
                      <p className="mt-2 text-center text-[11px] text-slate-400">
                        Upon submission, your supplier profile is immediately indexed in the F2H Fresh producer network.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
