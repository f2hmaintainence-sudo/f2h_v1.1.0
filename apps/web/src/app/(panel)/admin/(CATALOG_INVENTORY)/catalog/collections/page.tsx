"use client";

// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Daily Vendor Collections for Milk & Other Produce)
// Description : Field-optimized procurement with Date-wise filter, Summary modal, Milk quality audit, and slip generation
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
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
  Apple,
  Milk,
  Boxes,
  Tag,
  Warehouse,
  UserCheck,
  User,
  BarChart3,
  PieChart,
  CalendarRange,
  Download,
  Coins,
  TrendingUp,
  Receipt,
  SlidersHorizontal,
  ArrowUpDown
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

interface VendorCollectionRecord {
  id: number;
  collection_id: string;
  collection_type: "MILK" | "OTHERS";
  collection_date: string;
  shift: "MORNING" | "EVENING" | "AFTERNOON" | "GENERAL";
  vendor_id: string;
  vendor_name: string;
  vendor_phone?: string | null;
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

  // Produce, Ghee, Fruits & Others attributes
  batch_lot_no?: string | null;
  packaging_type?: string | null;
  purity_percentage?: number | null;
  storage_location?: string | null;
  harvest_date?: string | null;
  expiry_date?: string | null;
  gross_quantity?: number | null;
  defect_quantity?: number | null;

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

interface ProductBreakdownItem {
  name: string;
  quantity: number;
  unit: string;
  amount: number;
  count: number;
}

interface VendorBreakdownItem {
  vendor_id: string;
  vendor_name: string;
  vendor_phone?: string;
  quantity: number;
  amount: number;
  count: number;
  paid_amount: number;
  pending_amount: number;
}

interface CollectionSummary {
  totalMilkQuantity: number;
  totalOthersQuantity: number;
  morningMilkQuantity: number;
  eveningMilkQuantity: number;
  afternoonMilkQuantity?: number;
  generalMilkQuantity?: number;
  totalAmount: number;
  paidAmount?: number;
  pendingAmount?: number;
  partialAmount?: number;
  avgFat: number;
  avgSnf: number;
  avgClr?: number;
  avgTemperature?: number;
  totalCollections: number;
  milkCollectionsCount: number;
  othersCollectionsCount: number;
  activeVendorsCount: number;
  productBreakdown?: ProductBreakdownItem[];
  vendorBreakdown?: VendorBreakdownItem[];
}

const PRODUCE_CATEGORY_OPTIONS = [
  "Ghee & Dairy Products",
  "Fresh Fruits",
  "Organic Vegetables",
  "Cold Pressed Oils",
  "Raw Honey & Spices",
  "Farm Poultry & Eggs",
  "Grains & Pulses",
  "Hydroponics & Greens"
];

const PACKAGING_PRESETS = [
  "Glass Jar (500ml/1L)",
  "Tin (15kg)",
  "Plastic Crate",
  "Corrugated Box",
  "Egg Tray (30 Pcs)",
  "Vacuum Pouch",
  "Gunny Bag (50kg)",
  "Loose / Bulk"
];

export default function DailyCollectionsPage() {
  const { user } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const authenticatedCollectorName = useMemo(() => {
    if (!user) return "Collection Officer";
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    return fullName || user.user_name || user.email?.split("@")[0] || "Authenticated Officer";
  }, [user]);

  const authenticatedCollectorPhone = useMemo(() => {
    return (user as any)?.phone || (user as any)?.phone_number || (user as any)?.mobile || "";
  }, [user]);

  const [collections, setCollections] = useState<VendorCollectionRecord[]>([]);
  const [summary, setSummary] = useState<CollectionSummary>({
    totalMilkQuantity: 0,
    totalOthersQuantity: 0,
    morningMilkQuantity: 0,
    eveningMilkQuantity: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    partialAmount: 0,
    avgFat: 0,
    avgSnf: 0,
    avgClr: 0,
    avgTemperature: 0,
    totalCollections: 0,
    milkCollectionsCount: 0,
    othersCollectionsCount: 0,
    activeVendorsCount: 0,
    productBreakdown: [],
    vendorBreakdown: []
  });
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Date Filtering State
  // ---------------------------------------------------------------------------
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom">("today");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Other Filters
  const [selectedType, setSelectedType] = useState<"ALL" | "MILK" | "OTHERS">("ALL");
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Vendors list for dropdowns
  const [registeredVendors, setRegisteredVendors] = useState<VendorOption[]>([]);

  // Modals & Sliders
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryModalTab, setSummaryModalTab] = useState<"overview" | "vendors" | "products" | "quality">("overview");
  const [addLoading, setAddLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<VendorCollectionRecord | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<VendorCollectionRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Intake Mode in Add Modal ('MILK' vs 'OTHERS')
  const [intakeMode, setIntakeMode] = useState<"MILK" | "OTHERS">("MILK");

  // Form State for Recording Collection (Auto-populated with Authenticated Collector)
  const [formData, setFormData] = useState({
    collection_date: todayStr,
    shift: "MORNING" as "MORNING" | "EVENING" | "AFTERNOON" | "GENERAL",
    vendor_id: "",
    vendor_name: "",
    vendor_phone: "",
    collector_name: "",
    collector_phone: "",
    product_name: "Fresh Cow Milk",
    category: "Dairy & Milk",
    quantity: "",
    unit: "Liters",
    rate_per_unit: "42.00",

    // Milk quality parameters
    fat_percentage: "4.5",
    snf_percentage: "8.5",
    clr_reading: "28.5",
    temperature: "4.0",
    quality_grade: "Grade A",
    container_can_no: "CAN-01",

    // Others / Produce & Ghee parameters
    batch_lot_no: `LOT-${todayStr.replace(/-/g, "")}-01`,
    packaging_type: "Glass Jar (500ml/1L)",
    purity_percentage: "99.5",
    storage_location: "Cold Storage (0-4°C)",
    harvest_date: todayStr,
    defect_quantity: "0",

    payment_status: "PENDING" as "PENDING" | "PAID" | "PARTIAL",
    payment_mode: "CASH" as "CASH" | "UPI" | "BANK_TRANSFER" | "CREDIT",
    notes: ""
  });

  // Keep collector name & phone synchronized with authenticated session
  useEffect(() => {
    if (authenticatedCollectorName) {
      setFormData((prev) => ({
        ...prev,
        collector_name: prev.collector_name && prev.collector_name !== "Collection Officer" ? prev.collector_name : authenticatedCollectorName,
        collector_phone: prev.collector_phone || authenticatedCollectorPhone
      }));
    }
  }, [authenticatedCollectorName, authenticatedCollectorPhone]);

  const openAddModal = (mode?: "MILK" | "OTHERS") => {
    if (mode) setIntakeMode(mode);
    setFormData((prev) => ({
      ...prev,
      collector_name: authenticatedCollectorName,
      collector_phone: authenticatedCollectorPhone || prev.collector_phone
    }));
    setIsAddModalOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Date Helpers & Presets
  // ---------------------------------------------------------------------------
  const applyPreset = (preset: "today" | "yesterday" | "this_week" | "this_month" | "last_month") => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === "today") {
      setDateMode("single");
      setSelectedDate(todayStr);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      setDateMode("single");
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setSelectedDate(yStr);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "this_week") {
      setDateMode("range");
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      const wStr = w.toISOString().split("T")[0];
      setStartDate(wStr);
      setEndDate(todayStr);
    } else if (preset === "this_month") {
      setDateMode("range");
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      setStartDate(mStart);
      setEndDate(todayStr);
    } else if (preset === "last_month") {
      setDateMode("range");
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
      setStartDate(lmStart);
      setEndDate(lmEnd);
    }
  };

  // Date Navigation Helpers for Single Day mode
  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const nextDateStr = d.toISOString().split("T")[0];
    setSelectedDate(nextDateStr);
    setStartDate(nextDateStr);
    setEndDate(nextDateStr);
    setDatePreset(nextDateStr === todayStr ? "today" : "custom");
  };

  const isToday = selectedDate === todayStr && dateMode === "single";

  // Active Date Range Label for header and modals
  const activeDateLabel = useMemo(() => {
    if (dateMode === "single") {
      if (selectedDate === todayStr) return "Today (Daily)";
      try {
        const d = new Date(selectedDate + "T00:00:00");
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      } catch {
        return selectedDate;
      }
    } else {
      try {
        const s = new Date(startDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const e = new Date(endDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        return `${s} – ${e}`;
      } catch {
        return `${startDate} to ${endDate}`;
      }
    }
  }, [dateMode, selectedDate, startDate, endDate, todayStr]);

  // ---------------------------------------------------------------------------
  // Fetch Collections
  // ---------------------------------------------------------------------------
  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (dateMode === "single") {
        if (selectedDate) params.append("date", selectedDate);
      } else {
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
      }

      if (selectedType && selectedType !== "ALL") params.append("type", selectedType);
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
  }, [dateMode, selectedDate, startDate, endDate, selectedType, selectedShift, searchQuery]);

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
            vendor_phone: data.data[0].phone || "",
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

  // Handle Switch of Intake Mode inside Add Modal
  const handleIntakeModeSwitch = (mode: "MILK" | "OTHERS") => {
    setIntakeMode(mode);
    if (mode === "MILK") {
      setFormData((prev) => ({
        ...prev,
        category: "Dairy & Milk",
        product_name: "Fresh Cow Milk",
        unit: "Liters",
        rate_per_unit: "42.00"
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        category: "Ghee & Dairy Products",
        product_name: "Pure Desi Ghee (Bilona)",
        unit: "Kg",
        rate_per_unit: "650.00"
      }));
    }
  };

  // Handle Vendor Selection Change in Form
  const handleVendorSelect = (vendorId: string) => {
    const found = registeredVendors.find((v) => v.vendor_id === vendorId);
    if (found) {
      const isVendorDairy = found.category.toLowerCase().includes("dairy");
      const defaultProduct =
        found.products_supplied?.[0]?.name || (isVendorDairy ? "Fresh Cow Milk" : found.category);

      setFormData((prev) => ({
        ...prev,
        vendor_id: found.vendor_id,
        vendor_name: found.business_name,
        vendor_phone: found.phone || "",
        category: found.category || (intakeMode === "MILK" ? "Dairy & Milk" : "Fresh Produce"),
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
    const collectorNameFinal = formData.collector_name.trim() || authenticatedCollectorName;
    if (!collectorNameFinal) {
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
        collector_name: collectorNameFinal,
        collector_phone: formData.collector_phone || authenticatedCollectorPhone || null,
        collection_type: intakeMode,
        quantity: Number(formData.quantity),
        rate_per_unit: Number(formData.rate_per_unit) || 0,
        fat_percentage: intakeMode === "MILK" && formData.fat_percentage ? Number(formData.fat_percentage) : null,
        snf_percentage: intakeMode === "MILK" && formData.snf_percentage ? Number(formData.snf_percentage) : null,
        clr_reading: intakeMode === "MILK" && formData.clr_reading ? Number(formData.clr_reading) : null,
        temperature: intakeMode === "MILK" && formData.temperature ? Number(formData.temperature) : null,
        purity_percentage: intakeMode === "OTHERS" && formData.purity_percentage ? Number(formData.purity_percentage) : null,
        defect_quantity: intakeMode === "OTHERS" && formData.defect_quantity ? Number(formData.defect_quantity) : 0
      };

      const res = await fetch("/api/v1/vendors/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showSuccessToast(
          `✓ Recorded: ${payload.quantity} ${payload.unit} of ${payload.product_name} (${payload.vendor_name})`
        );
        fetchCollections();

        if (addAnother) {
          setFormData((prev) => ({
            ...prev,
            quantity: "",
            notes: "",
            collector_name: authenticatedCollectorName,
            collector_phone: authenticatedCollectorPhone || prev.collector_phone,
            container_can_no: `CAN-${String(Math.floor(Math.random() * 20) + 1).padStart(2, "0")}`,
            batch_lot_no: `LOT-${todayStr.replace(/-/g, "")}-${String(Math.floor(Math.random() * 90) + 10)}`
          }));
        } else {
          setIsAddModalOpen(false);
          setFormData((prev) => ({
            ...prev,
            quantity: "",
            notes: "",
            collector_name: authenticatedCollectorName,
            collector_phone: authenticatedCollectorPhone || prev.collector_phone
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

  // Helper to standardize phone number for WhatsApp wa.me links
  const formatWhatsAppPhone = (phone?: string | null): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    return digits;
  };

  // WhatsApp Share Slip text builder
  const getWhatsAppSlipUrl = (c: VendorCollectionRecord, vendorPhoneOverride?: string | null) => {
    const isMilk = c.collection_type === "MILK" || !c.collection_type;
    let extraDetails = "";

    if (isMilk) {
      if (c.fat_percentage != null) extraDetails += `• *Fat %:* ${c.fat_percentage}%\n`;
      if (c.snf_percentage != null) extraDetails += `• *SNF %:* ${c.snf_percentage}%\n`;
      if (c.clr_reading != null) extraDetails += `• *CLR Reading:* ${c.clr_reading}\n`;
      if (c.temperature != null) extraDetails += `• *Temperature:* ${c.temperature} °C\n`;
      if (c.container_can_no) extraDetails += `• *Can No:* ${c.container_can_no}\n`;
      if (c.quality_grade) extraDetails += `• *Grade:* ${c.quality_grade}\n`;
    } else {
      if (c.batch_lot_no) extraDetails += `• *Batch/Lot No:* ${c.batch_lot_no}\n`;
      if (c.packaging_type) extraDetails += `• *Packaging:* ${c.packaging_type}\n`;
      if (c.purity_percentage != null) extraDetails += `• *Purity/Brix:* ${c.purity_percentage}%\n`;
      if (c.storage_location) extraDetails += `• *Storage Location:* ${c.storage_location}\n`;
      if (c.harvest_date) extraDetails += `• *Harvest Date:* ${c.harvest_date}\n`;
    }

    const resolvedVendorPhone =
      vendorPhoneOverride ||
      c.vendor_phone ||
      registeredVendors.find((v) => v.vendor_id === c.vendor_id)?.phone ||
      "";
    const cleanPhone = formatWhatsAppPhone(resolvedVendorPhone);

    const text = encodeURIComponent(
      `*🥛 F2H FRESH - INTAKE RECEIPT *\n` +
      `------------------------------------\n` +
      ` *Slip No:* ${c.collection_id}\n` +
      ` *Date:* ${c.collection_date} (${c.shift})\n` +
      ` *Intake Type:* ${isMilk ? "Milk Procurement" : "Produce & Ghee Intake"}\n` +
      ` *Vendor:* ${c.vendor_name}${resolvedVendorPhone ? ` (+91 ${resolvedVendorPhone.replace(/^(\+91|91|0)/, '')})` : ""}\n` +
      ` *Product:* ${c.product_name}\n` +
      ` *Quantity:* ${c.quantity} ${c.unit}\n` +
      ` *Rate:* ₹${c.rate_per_unit} / ${c.unit}\n` +
      ` *Total Amount:* ₹${c.total_amount.toLocaleString("en-IN")}\n` +
      (extraDetails ? `\n*Quality & Batch Specs:*\n${extraDetails}` : "") +
      `\n*Payment:* ${c.payment_status} (${c.payment_mode || "CASH"})\n` +
      `*Received By:* ${c.collector_name}${c.collector_phone ? ` (${c.collector_phone})` : ""}\n` +
      `------------------------------------\n` +
      `*Farm to Home Fresh (F2H)*\n` +
      `Pure • Direct • Farm Fresh Procurements`
    );

    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  // WhatsApp Comprehensive Summary Share Builder
  const getWhatsAppSummaryShareUrl = () => {
    const text = encodeURIComponent(
      `*📊 F2H FRESH - PROCUREMENT SUMMARY REPORT*\n` +
      `*Period:* ${activeDateLabel}\n` +
      `------------------------------------\n` +
      `*Total Slips:* ${summary.totalCollections || collections.length}\n` +
      `*Total Procurement Value:* ₹${(summary.totalAmount || 0).toLocaleString("en-IN")}\n` +
      `*Settlement Paid:* ₹${(summary.paidAmount || 0).toLocaleString("en-IN")} | *Pending:* ₹${(summary.pendingAmount || 0).toLocaleString("en-IN")}\n` +
      `------------------------------------\n` +
      `*🥛 MILK PROCUREMENT:*\n` +
      `• Total Volume: ${summary.totalMilkQuantity} L\n` +
      `• Morning (AM): ${summary.morningMilkQuantity} L | Evening (PM): ${summary.eveningMilkQuantity} L\n` +
      `• Avg Fat: ${summary.avgFat ? `${summary.avgFat}%` : "--"} | Avg SNF: ${summary.avgSnf ? `${summary.avgSnf}%` : "--"}\n` +
      (summary.avgClr ? `• Avg CLR: ${summary.avgClr}\n` : "") +
      (summary.avgTemperature ? `• Avg Temp: ${summary.avgTemperature} °C\n` : "") +
      `------------------------------------\n` +
      `*🍎 PRODUCE & GHEE:* ${summary.totalOthersQuantity} Units/Kg\n` +
      `*👨‍🌾 ACTIVE SUPPLIERS:* ${summary.activeVendorsCount || 0} Vendors\n` +
      `------------------------------------\n` +
      `*Generated on:* ${new Date().toLocaleString("en-IN")}\n` +
      `*Farm to Home Fresh (F2H)*`
    );
    return `https://wa.me/?text=${text}`;
  };

  // CSV Export
  const exportCollectionsCSV = () => {
    if (collections.length === 0) {
      showErrorToast("No collections to export");
      return;
    }
    const headers = [
      "Slip ID",
      "Date",
      "Shift",
      "Type",
      "Vendor Name",
      "Vendor Phone",
      "Product Name",
      "Category",
      "Quantity",
      "Unit",
      "Rate Per Unit (Rs)",
      "Total Amount (Rs)",
      "Fat %",
      "SNF %",
      "CLR",
      "Temp (C)",
      "Can No",
      "Batch Lot",
      "Packaging",
      "Payment Status",
      "Collector Name"
    ];

    const rows = collections.map((c) => [
      `"${c.collection_id}"`,
      `"${c.collection_date}"`,
      `"${c.shift}"`,
      `"${c.collection_type}"`,
      `"${c.vendor_name}"`,
      `"${c.vendor_phone || ""}"`,
      `"${c.product_name}"`,
      `"${c.category}"`,
      c.quantity,
      `"${c.unit}"`,
      c.rate_per_unit,
      c.total_amount,
      c.fat_percentage ?? "",
      c.snf_percentage ?? "",
      c.clr_reading ?? "",
      c.temperature ?? "",
      `"${c.container_can_no || ""}"`,
      `"${c.batch_lot_no || ""}"`,
      `"${c.packaging_type || ""}"`,
      `"${c.payment_status}"`,
      `"${c.collector_name}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `F2H_Collections_${dateMode === "single" ? selectedDate : `${startDate}_to_${endDate}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast("CSV report exported successfully");
  };

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6 pb-24 md:pb-8 animate-in fade-in duration-200">
      {/* Desktop Breadcrumbs */}
      <nav className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Daily Collections</span>
      </nav>

      {/* Top Header & Summary / Record Controls */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100 shrink-0 shadow-2xs">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                  Vendor Procurement &amp; Intake
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {collections.length} entries
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <CalendarRange size={12} className="text-slate-400" />
                <span>Showing: <strong className="text-slate-700">{activeDateLabel}</strong></span>
              </p>
            </div>
          </div>

          {/* Header Action Buttons: Summary, Refresh, Record */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* SUMMARY BUTTON (Primary Action) */}
            <button
              onClick={() => setIsSummaryModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Open Procurement & Quality Audit Summary"
            >
              <BarChart3 size={15} className="text-emerald-700" />
              <span>Summary</span>
              <span className="ml-0.5 px-1.5 py-0.2 rounded-md bg-emerald-700 text-white text-[10px] font-mono">
                ₹{Math.round(summary.totalAmount || 0).toLocaleString("en-IN")}
              </span>
            </button>

            <button
              onClick={fetchCollections}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
              title="Refresh Records"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
              <span className="hidden sm:inline sm:ml-1">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCollectionsCSV}
              className="hidden md:flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
              title="Download CSV"
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            {/* Desktop Add Button */}
            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#16a34a] hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={15} />
              <span>Record Intake</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* COMPREHENSIVE DATE-WISE FILTER BAR */}
        {/* ------------------------------------------------------------------- */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          {/* Preset Pill Buttons */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1 hidden sm:inline">Date:</span>
              <button
                onClick={() => applyPreset("today")}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${dateMode === "single" && selectedDate === todayStr
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                Today
              </button>
              <button
                onClick={() => applyPreset("yesterday")}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${datePreset === "yesterday"
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => applyPreset("this_week")}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${datePreset === "this_week"
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => applyPreset("this_month")}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${datePreset === "this_month"
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                This Month
              </button>
              <button
                onClick={() => applyPreset("last_month")}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${datePreset === "last_month"
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                Last Month
              </button>
            </div>

            {/* Mode Switch: Single Day vs Date Range */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0 border border-slate-200/60">
              <button
                onClick={() => {
                  setDateMode("single");
                  setDatePreset("today");
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${dateMode === "single" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600"
                  }`}
              >
                Single Day
              </button>
              <button
                onClick={() => {
                  setDateMode("range");
                  setDatePreset("custom");
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${dateMode === "range" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600"
                  }`}
              >
                Date Range
              </button>
            </div>
          </div>

          {/* Input Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/80 p-2 rounded-2xl border border-slate-200/70">
            {dateMode === "single" ? (
              /* Single Day < Prev [Date] Next > Controls */
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <button
                    onClick={() => navigateDay(-1)}
                    className="p-2 hover:bg-slate-100 text-slate-600 rounded-l-xl transition-colors"
                    title="Previous Day"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setDatePreset(e.target.value === todayStr ? "today" : "custom");
                    }}
                    className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer px-2 text-center"
                  />
                  <button
                    onClick={() => navigateDay(1)}
                    className="p-2 hover:bg-slate-100 text-slate-600 rounded-r-xl transition-colors"
                    title="Next Day"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {!isToday && (
                  <button
                    onClick={() => {
                      setSelectedDate(todayStr);
                      setDatePreset("today");
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                  >
                    Jump to Today
                  </button>
                )}
              </div>
            ) : (
              /* Date Range Controls: From Date -> To Date */
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>

                <ChevronRight size={14} className="text-slate-400 hidden sm:inline" />

                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Shift Filter Switcher */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5">
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                <button
                  onClick={() => setSelectedShift("ALL")}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${selectedShift === "ALL" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600"
                    }`}
                >
                  All Shifts
                </button>
                <button
                  onClick={() => setSelectedShift("MORNING")}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${selectedShift === "MORNING" ? "bg-amber-500 text-white shadow-2xs font-bold" : "text-amber-800"
                    }`}
                >
                  <Sun size={12} /> AM
                </button>
                <button
                  onClick={() => setSelectedShift("EVENING")}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${selectedShift === "EVENING" ? "bg-indigo-600 text-white shadow-2xs font-bold" : "text-indigo-800"
                    }`}
                >
                  <Moon size={12} /> PM
                </button>
              </div>
            </div>
          </div>

          {/* Category / Type Filter Tabs (ALL / MILK / OTHERS) */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedType("ALL")}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center ${selectedType === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              All Intake ({collections.length})
            </button>
            <button
              onClick={() => setSelectedType("MILK")}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${selectedType === "MILK"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-blue-700 hover:bg-blue-50"
                }`}
            >
              <Milk size={14} /> Milk Intake ({summary.milkCollectionsCount || 0})
            </button>
            <button
              onClick={() => setSelectedType("OTHERS")}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${selectedType === "OTHERS"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 hover:bg-emerald-50"
                }`}
            >
              <Apple size={14} /> Others ({summary.othersCollectionsCount || 0})
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* KPI METRICS SUMMARY STRIP (Clicking any card opens Summary Modal!) */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Milk Volume */}
        <div
          onClick={() => {
            setSummaryModalTab("quality");
            setIsSummaryModalOpen(true);
          }}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Droplet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Milk Volume</p>
              <BarChart3 size={12} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900">
              {summary.totalMilkQuantity} <span className="text-xs font-normal text-slate-500">L</span>
            </p>
            <p className="text-[10px] text-blue-700 font-medium truncate">
              AM: {summary.morningMilkQuantity}L • PM: {summary.eveningMilkQuantity}L
            </p>
          </div>
        </div>

        {/* Produce & Ghee Quantity */}
        <div
          onClick={() => {
            setSummaryModalTab("products");
            setIsSummaryModalOpen(true);
          }}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Apple size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Produce &amp; Ghee</p>
              <BarChart3 size={12} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900">
              {summary.totalOthersQuantity} <span className="text-xs font-normal text-slate-500">Kg/Units</span>
            </p>
            <p className="text-[10px] text-amber-700 font-medium truncate">
              {summary.othersCollectionsCount} entries logged
            </p>
          </div>
        </div>

        {/* Quality Index */}
        <div
          onClick={() => {
            setSummaryModalTab("quality");
            setIsSummaryModalOpen(true);
          }}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Gauge size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Avg Fat / SNF</p>
              <BarChart3 size={12} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900">
              {summary.avgFat ? `${summary.avgFat}%` : "--"} / {summary.avgSnf ? `${summary.avgSnf}%` : "--"}
            </p>
            <p className="text-[10px] text-emerald-700 font-medium truncate">
              {summary.avgClr ? `CLR ${summary.avgClr}` : "Standard Quality"} • {summary.avgTemperature ? `${summary.avgTemperature}°C` : "Chilled"}
            </p>
          </div>
        </div>

        {/* Procurement Value */}
        <div
          onClick={() => {
            setSummaryModalTab("overview");
            setIsSummaryModalOpen(true);
          }}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 cursor-pointer hover:border-purple-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <IndianRupee size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase">Total Intake Value</p>
              <BarChart3 size={12} className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900">
              ₹{summary.totalAmount.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-purple-700 font-medium truncate">
              Paid: ₹{(summary.paidAmount || 0).toLocaleString("en-IN")} • Pend: ₹{(summary.pendingAmount || 0).toLocaleString("en-IN")}
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
            placeholder="Search vendor, produce, CAN, batch lot..."
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
            className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === "cards" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            title="Mobile Cards View"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
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
          <p className="text-xs text-slate-500 font-medium">Loading procurement records...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-white rounded-2xl md:rounded-3xl p-8 border border-slate-100 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
            <ClipboardCheck size={26} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">No Intake Logged For This Selection</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No entries found for {activeDateLabel}. Tap below to log milk or produce collection.
            </p>
          </div>
          <button
            onClick={() => openAddModal()}
            className="px-5 py-2.5 bg-[#16a34a] text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20 inline-flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={15} /> Record Intake
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* MOBILE CARDS VIEW (Primary & Default) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map((item) => {
            const isMilk = item.collection_type === "MILK" || !item.collection_type;
            const vendorMatch = registeredVendors.find((v) => v.vendor_id === item.vendor_id);
            const vendorPhone = vendorMatch?.phone || item.collector_phone || "";

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xs hover:border-emerald-200 transition-all p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isMilk ? (
                        <div
                          className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0"
                          title="Milk Collection"
                        >
                          <Droplet size={16} />
                        </div>
                      ) : (
                        <div
                          className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0"
                          title="Produce / Ghee / Goods Intake"
                        >
                          <Apple size={16} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{item.vendor_name}</h3>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.collection_id} • {item.collection_date} • {item.shift}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePayment(item)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${item.payment_status === "PAID"
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
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Quantity</span>
                      <p className="text-lg font-black text-slate-900">
                        {item.quantity} <span className="text-xs font-semibold text-slate-600">{item.unit}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">@ ₹{item.rate_per_unit}/{item.unit}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Total Amount</span>
                      <p className="text-lg font-black text-emerald-700">₹{item.total_amount.toLocaleString("en-IN")}</p>
                      <span className="text-[10px] font-bold text-slate-700">{item.product_name}</span>
                    </div>
                  </div>

                  {/* Badges: Milk vs Others Model */}
                  {isMilk ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.fat_percentage && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                          Fat: {item.fat_percentage}%
                        </span>
                      )}
                      {item.snf_percentage && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                          SNF: {item.snf_percentage}%
                        </span>
                      )}
                      {item.clr_reading && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/60">
                          CLR: {item.clr_reading}
                        </span>
                      )}
                      {item.container_can_no && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                          {item.container_can_no}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                        {item.category}
                      </span>
                      {item.packaging_type && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                          {item.packaging_type}
                        </span>
                      )}
                      {item.batch_lot_no && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono bg-purple-50 text-purple-700">
                          {item.batch_lot_no}
                        </span>
                      )}
                      {item.purity_percentage && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800">
                          Purity: {item.purity_percentage}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Collector Info */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                      Collector: <strong className="text-slate-700">{item.collector_name}</strong>
                    </span>
                    {item.collector_phone && (
                      <span className="text-[10px] text-slate-400 font-mono">{item.collector_phone}</span>
                    )}
                  </div>
                </div>

                {/* Footer Quick Action Bar */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {vendorPhone && (
                      <a
                        href={`tel:${vendorPhone}`}
                        className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Call Vendor"
                      >
                        <PhoneCall size={14} />
                      </a>
                    )}

                    <a
                      href={getWhatsAppSlipUrl(item, vendorPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Share Receipt on WhatsApp"
                    >
                      <MessageSquare size={14} />
                    </a>

                    <button
                      onClick={() => setCollectionToDelete(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Slip"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

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
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date &amp; Slip</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Product &amp; Volume</th>
                  <th className="py-3 px-4">Quality / Lot</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {collections.map((item) => {
                  const isMilk = item.collection_type === "MILK" || !item.collection_type;
                  const vendor = registeredVendors.find((v) => v.vendor_id === item.vendor_id);
                  const vendorPhone = item.vendor_phone || vendor?.phone;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isMilk ? (
                            <Droplet size={15} className="text-blue-600 shrink-0" />
                          ) : (
                            <Apple size={15} className="text-amber-600 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{isMilk ? "Milk" : item.category}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.collection_date} • {item.collection_id} ({item.shift})
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{item.vendor_name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <ShieldCheck size={11} className="text-emerald-600 shrink-0" />
                            <span>{item.collector_name}</span>
                          </span>
                          {vendorPhone && (
                            <span className="text-[10px] text-emerald-700 font-mono font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              +91 {vendorPhone.replace(/^(\+91|91|0)/, '')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{item.product_name}</p>
                        <p className="text-[10px] text-slate-500">
                          {item.quantity} {item.unit} @ ₹{item.rate_per_unit}/{item.unit}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        {isMilk ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.fat_percentage && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px]">
                                {item.fat_percentage}% Fat
                              </span>
                            )}
                            {item.snf_percentage && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                                {item.snf_percentage}% SNF
                              </span>
                            )}
                            {item.clr_reading && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">
                                CLR {item.clr_reading}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.packaging_type && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                {item.packaging_type}
                              </span>
                            )}
                            {item.batch_lot_no && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px]">
                                {item.batch_lot_no}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{item.total_amount.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleTogglePayment(item)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.payment_status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                        >
                          {item.payment_status}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {vendorPhone && (
                            <a
                              href={`tel:${vendorPhone}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title={`Call ${item.vendor_name}`}
                            >
                              <PhoneCall size={14} />
                            </a>
                          )}

                          <a
                            href={getWhatsAppSlipUrl(item, vendorPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title={`Send WhatsApp Slip`}
                          >
                            <MessageSquare size={15} />
                          </a>

                          <button
                            onClick={() => setSelectedCollection(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="View Slip"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => setCollectionToDelete(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Slip"
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
      {/* MOBILE STICKY FLOATING ACTION BUTTON */}
      {/* ========================================================================= */}
      <div className="fixed bottom-4 right-4 sm:hidden z-30 flex items-center gap-2">
        <button
          onClick={() => setIsSummaryModalOpen(true)}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-900 text-white font-extrabold shadow-xl shadow-emerald-950/40 active:scale-95 transition-all border border-emerald-700"
          title="Summary"
        >
          <BarChart3 size={20} />
        </button>

        <button
          onClick={() => openAddModal()}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#16a34a] text-white font-extrabold text-sm shadow-xl shadow-emerald-700/40 active:scale-95 transition-all"
        >
          <Plus size={18} />
          <span>Record Intake</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED PROCUREMENT & QUALITY AUDIT SUMMARY MODAL */}
      {/* ========================================================================= */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Procurement &amp; Quality Audit</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {activeDateLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Comprehensive procurement statistics, shift volumes, quality lab averages, and vendor balances
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
                  title="Print Report"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>

                <button
                  onClick={exportCollectionsCSV}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
                  title="Download CSV"
                >
                  <Download size={14} />
                  <span>CSV</span>
                </button>

                <a
                  href={getWhatsAppSummaryShareUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#16a34a] hover:bg-emerald-700 transition-colors shadow-xs"
                  title="Share Summary via WhatsApp"
                >
                  <Share2 size={14} />
                  <span className="hidden sm:inline">Share</span>
                </a>

                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 border-b border-slate-100 bg-white overflow-x-auto">
              <button
                onClick={() => setSummaryModalTab("overview")}
                className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 shrink-0 ${summaryModalTab === "overview"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
              >
                Executive Overview
              </button>
              <button
                onClick={() => setSummaryModalTab("vendors")}
                className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 shrink-0 ${summaryModalTab === "vendors"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
              >
                Supplier / Vendor Breakdown ({summary.vendorBreakdown?.length || summary.activeVendorsCount || 0})
              </button>
              <button
                onClick={() => setSummaryModalTab("products")}
                className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 shrink-0 ${summaryModalTab === "products"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
              >
                Product Breakdown ({summary.productBreakdown?.length || 0})
              </button>
              <button
                onClick={() => setSummaryModalTab("quality")}
                className={`pb-2.5 px-2 text-xs font-bold transition-all border-b-2 shrink-0 ${summaryModalTab === "quality"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
              >
                Milk Shifts &amp; Quality Audit
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {summaryModalTab === "overview" && (
                <div className="space-y-5">
                  {/* Key KPI Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-100">
                      <p className="text-[10px] font-bold text-purple-700 uppercase">Total Procurement</p>
                      <p className="text-xl font-black text-purple-950 mt-1">
                        ₹{summary.totalAmount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-purple-600 mt-0.5">{summary.totalCollections} collection slips</p>
                    </div>

                    <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-700 uppercase">Milk Volume</p>
                      <p className="text-xl font-black text-blue-950 mt-1">
                        {summary.totalMilkQuantity} <span className="text-xs font-semibold">Liters</span>
                      </p>
                      <p className="text-[10px] text-blue-600 mt-0.5">AM: {summary.morningMilkQuantity}L • PM: {summary.eveningMilkQuantity}L</p>
                    </div>

                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Produce &amp; Ghee</p>
                      <p className="text-xl font-black text-amber-950 mt-1">
                        {summary.totalOthersQuantity} <span className="text-xs font-semibold">Kg/Units</span>
                      </p>
                      <p className="text-[10px] text-amber-600 mt-0.5">{summary.othersCollectionsCount} produce batches</p>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Active Farmers</p>
                      <p className="text-xl font-black text-emerald-950 mt-1">
                        {summary.activeVendorsCount} <span className="text-xs font-semibold">Suppliers</span>
                      </p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Verified deliveries</p>
                    </div>
                  </div>

                  {/* Financial Settlement Progress Bar */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Coins size={15} className="text-emerald-600" /> Payment &amp; Settlement Status
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Total ₹{summary.totalAmount.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {/* Progress multi-color bar */}
                    {summary.totalAmount > 0 ? (
                      <div className="w-full h-3 rounded-full bg-slate-200 flex overflow-hidden">
                        <div
                          style={{ width: `${((summary.paidAmount || 0) / summary.totalAmount) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Paid: ₹${(summary.paidAmount || 0).toLocaleString("en-IN")}`}
                        />
                        <div
                          style={{ width: `${((summary.partialAmount || 0) / summary.totalAmount) * 100}%` }}
                          className="bg-blue-500 h-full"
                          title={`Partial: ₹${(summary.partialAmount || 0).toLocaleString("en-IN")}`}
                        />
                        <div
                          style={{ width: `${((summary.pendingAmount || 0) / summary.totalAmount) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Pending: ₹${(summary.pendingAmount || 0).toLocaleString("en-IN")}`}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-3 rounded-full bg-slate-200" />
                    )}

                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Paid Settlement</p>
                          <p className="font-bold text-emerald-700">₹{(summary.paidAmount || 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Partial Settlement</p>
                          <p className="font-bold text-blue-700">₹{(summary.partialAmount || 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500">Pending Settlement</p>
                          <p className="font-bold text-amber-700">₹{(summary.pendingAmount || 0).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Quality Lab Averages */}
                  <div className="p-4 bg-gradient-to-r from-blue-50/60 to-emerald-50/60 rounded-2xl border border-blue-200/60 space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Gauge size={15} className="text-blue-600" /> Milk Quality Lab Audit Benchmarks
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Fat</span>
                        <p className="text-base font-black text-blue-800">{summary.avgFat ? `${summary.avgFat}%` : "--"}</p>
                        <span className="text-[9px] text-slate-400">Target: &gt; 4.0%</span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Avg SNF</span>
                        <p className="text-base font-black text-emerald-800">{summary.avgSnf ? `${summary.avgSnf}%` : "--"}</p>
                        <span className="text-[9px] text-slate-400">Target: &gt; 8.5%</span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Avg CLR Reading</span>
                        <p className="text-base font-black text-indigo-800">{summary.avgClr || "--"}</p>
                        <span className="text-[9px] text-slate-400">Target: 28 – 30</span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Intake Temp</span>
                        <p className="text-base font-black text-teal-800">{summary.avgTemperature ? `${summary.avgTemperature}°C` : "--"}</p>
                        <span className="text-[9px] text-slate-400">Chilled: &lt; 4°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendors Breakdown Tab */}
              {summaryModalTab === "vendors" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Supplier-wise Deliveries &amp; Balance</span>
                    <span className="text-slate-500">{summary.vendorBreakdown?.length || 0} active vendors</span>
                  </div>

                  {(!summary.vendorBreakdown || summary.vendorBreakdown.length === 0) ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                      No vendor deliveries recorded for this selection.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3">Farmer / Vendor</th>
                            <th className="p-3">Slips</th>
                            <th className="p-3">Total Volume</th>
                            <th className="p-3">Total Payout</th>
                            <th className="p-3">Paid / Pending</th>
                            <th className="p-3 text-right">WhatsApp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {summary.vendorBreakdown.map((v, i) => {
                            const vCleanPhone = formatWhatsAppPhone(v.vendor_phone);
                            const vendorWhatsAppUrl = vCleanPhone
                              ? `https://wa.me/${vCleanPhone}?text=${encodeURIComponent(
                                `*🥛 F2H Fresh Supplier Statement*\n` +
                                `*Period:* ${activeDateLabel}\n` +
                                `*Vendor:* ${v.vendor_name}\n` +
                                `*Total Deliveries:* ${v.count}\n` +
                                `*Total Volume:* ${v.quantity}\n` +
                                `*Total Amount:* ₹${v.amount.toLocaleString("en-IN")}\n` +
                                `*Paid:* ₹${v.paid_amount.toLocaleString("en-IN")} | *Pending:* ₹${v.pending_amount.toLocaleString("en-IN")}\n` +
                                `Thank you for partnering with F2H Fresh!`
                              )}`
                              : "";

                            return (
                              <tr key={i} className="hover:bg-slate-50/70">
                                <td className="p-3">
                                  <p className="font-bold text-slate-900">{v.vendor_name}</p>
                                  {v.vendor_phone && (
                                    <span className="text-[10px] text-slate-500 font-mono">+91 {v.vendor_phone.replace(/^(\+91|91|0)/, '')}</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono">{v.count}</td>
                                <td className="p-3 font-bold text-slate-800">{v.quantity}</td>
                                <td className="p-3 font-bold text-emerald-800">₹{v.amount.toLocaleString("en-IN")}</td>
                                <td className="p-3">
                                  <div className="text-[10px]">
                                    <span className="text-emerald-700 font-bold">Paid: ₹{v.paid_amount.toLocaleString("en-IN")}</span>
                                    {v.pending_amount > 0 && (
                                      <span className="text-amber-700 font-bold block">Pend: ₹{v.pending_amount.toLocaleString("en-IN")}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  {vCleanPhone ? (
                                    <a
                                      href={vendorWhatsAppUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                                    >
                                      <MessageSquare size={12} /> Send Statement
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">No phone</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Products Breakdown Tab */}
              {summaryModalTab === "products" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Product &amp; Commodity Breakdown</span>
                    <span className="text-slate-500">{summary.productBreakdown?.length || 0} unique items</span>
                  </div>

                  {(!summary.productBreakdown || summary.productBreakdown.length === 0) ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                      No product data available for this range.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3">Product Name</th>
                            <th className="p-3">Entries</th>
                            <th className="p-3">Total Quantity</th>
                            <th className="p-3">Total Cost (₹)</th>
                            <th className="p-3 text-right">Avg Rate / Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {summary.productBreakdown.map((p, i) => (
                            <tr key={i} className="hover:bg-slate-50/70">
                              <td className="p-3 font-bold text-slate-900">{p.name}</td>
                              <td className="p-3 font-mono">{p.count}</td>
                              <td className="p-3 font-bold text-slate-800">
                                {p.quantity} {p.unit}
                              </td>
                              <td className="p-3 font-bold text-emerald-800">₹{p.amount.toLocaleString("en-IN")}</td>
                              <td className="p-3 text-right font-mono font-semibold text-slate-700">
                                ₹{p.quantity > 0 ? (p.amount / p.quantity).toFixed(2) : "0.00"} / {p.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Quality & Shifts Tab */}
              {summaryModalTab === "quality" && (
                <div className="space-y-4">
                  {/* Shift Volumes Card */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock size={15} className="text-blue-600" /> Shift-wise Milk Volume Distribution
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200">
                        <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1 uppercase">
                          <Sun size={12} /> Morning (AM)
                        </span>
                        <p className="text-lg font-black text-amber-950 mt-1">{summary.morningMilkQuantity} L</p>
                      </div>

                      <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200">
                        <span className="text-[10px] font-bold text-indigo-800 flex items-center gap-1 uppercase">
                          <Moon size={12} /> Evening (PM)
                        </span>
                        <p className="text-lg font-black text-indigo-950 mt-1">{summary.eveningMilkQuantity} L</p>
                      </div>

                      <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200">
                        <span className="text-[10px] font-bold text-blue-800 uppercase">Afternoon</span>
                        <p className="text-lg font-black text-blue-950 mt-1">{summary.afternoonMilkQuantity || 0} L</p>
                      </div>

                      <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">General</span>
                        <p className="text-lg font-black text-slate-900 mt-1">{summary.generalMilkQuantity || 0} L</p>
                      </div>
                    </div>
                  </div>

                  {/* Quality Audit Cards */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Gauge size={15} className="text-emerald-600" /> Quality Averages Across All Intakes
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="text-[10px] font-bold text-blue-800 uppercase block">Average Fat</span>
                        <span className="text-2xl font-black text-blue-900">{summary.avgFat ? `${summary.avgFat}%` : "--"}</span>
                      </div>

                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Average SNF</span>
                        <span className="text-2xl font-black text-emerald-900">{summary.avgSnf ? `${summary.avgSnf}%` : "--"}</span>
                      </div>

                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase block">Average CLR</span>
                        <span className="text-2xl font-black text-indigo-900">{summary.avgClr || "--"}</span>
                      </div>

                      <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                        <span className="text-[10px] font-bold text-teal-800 uppercase block">Average Temp</span>
                        <span className="text-2xl font-black text-teal-900">{summary.avgTemperature ? `${summary.avgTemperature}°C` : "--"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                F2H Fresh Procurement Engine • {collections.length} entries analyzed
              </span>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD INTAKE MODAL (SELECT MILK OR OTHERS) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center font-bold shrink-0">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">Record Vendor Intake</h2>
                    <p className="text-[11px] text-slate-500">Choose collection model below</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* MODEL SELECTOR: MILK vs OTHERS (PRODUCE / GHEE) */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleIntakeModeSwitch("MILK")}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${intakeMode === "MILK"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  <Droplet size={15} /> 🥛 Milk Procurement
                </button>
                <button
                  type="button"
                  onClick={() => handleIntakeModeSwitch("OTHERS")}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${intakeMode === "OTHERS"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  <Apple size={15} /> 🍎 Ghee, Fruits &amp; Others
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={(e) => handleAddCollectionSubmit(e, false)}
              className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1"
            >
              {/* Date & Shift */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.collection_date}
                    onChange={(e) => setFormData({ ...formData, collection_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Shift</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shift: "MORNING" })}
                      className={`py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${formData.shift === "MORNING" ? "bg-amber-500 text-white shadow-2xs" : "text-slate-700"
                        }`}
                    >
                      <Sun size={12} /> AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shift: "EVENING" })}
                      className={`py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${formData.shift === "EVENING" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-700"
                        }`}
                    >
                      <Moon size={12} /> PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Vendor Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Vendor / Farmer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => handleVendorSelect(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none"
                >
                  {registeredVendors.length > 0 ? (
                    registeredVendors.map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.business_name} ({v.contact_person}) {v.phone ? `— +91 ${v.phone.replace(/^(\+91|91|0)/, '')}` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No vendors registered</option>
                  )}
                </select>
                {formData.vendor_phone && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                    <span className="flex items-center gap-1 font-medium">
                      <MessageSquare size={12} className="text-emerald-600" /> Vendor WhatsApp:
                    </span>
                    <span className="font-mono font-bold">+91 {formData.vendor_phone.replace(/^(\+91|91|0)/, '')}</span>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* MODEL 1: MILK INTAKE SPECIFIC FIELDS */}
              {/* ========================================================= */}
              {intakeMode === "MILK" ? (
                <div className="space-y-4">
                  {/* Milk Product & Liters */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Milk Product</label>
                      <input
                        type="text"
                        required
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        placeholder="e.g. Fresh Cow Milk / Buffalo Milk"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">
                        Volume (Liters) <span className="text-rose-500">*</span>
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
                        className="w-full px-3.5 py-2 bg-blue-50/40 border border-blue-300 rounded-xl text-base font-black text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Rate per Liter */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Rate per Liter (₹)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        inputMode="decimal"
                        value={formData.rate_per_unit}
                        onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Container / Can No</label>
                      <input
                        type="text"
                        value={formData.container_can_no}
                        onChange={(e) => setFormData({ ...formData, container_can_no: e.target.value })}
                        placeholder="CAN-01"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Milk Quality Lab Parameters */}
                  <div className="p-3.5 bg-blue-50/40 rounded-2xl border border-blue-200 space-y-2.5">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Gauge size={14} className="text-blue-600" /> Milk Quality Test
                    </span>

                    <div className="grid grid-cols-3 gap-2">
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
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 text-center"
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
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 text-center"
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
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ========================================================= */
                /* MODEL 2: PRODUCE, GHEE, FRUITS & OTHERS FIELDS */
                /* ========================================================= */
                <div className="space-y-4">
                  {/* Category & Produce Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none"
                      >
                        {PRODUCE_CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">
                        Produce / Item Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        placeholder="e.g. Pure Desi Ghee / Shimla Apples"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quantity & Unit of Measure */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-bold text-slate-800">
                        Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        required
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="e.g. 25.0"
                        className="w-full px-3.5 py-2 bg-emerald-50/40 border border-emerald-300 rounded-xl text-base font-black text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Unit</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                      >
                        <option value="Kg">Kg</option>
                        <option value="Grams">Grams</option>
                        <option value="Liters">Liters</option>
                        <option value="Units">Units / Pcs</option>
                        <option value="Jars">Jars</option>
                        <option value="Tins">Tins</option>
                        <option value="Boxes">Boxes</option>
                        <option value="Trays">Egg Trays</option>
                        <option value="Crates">Crates</option>
                      </select>
                    </div>
                  </div>

                  {/* Rate per Unit */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">
                      Rate per {formData.unit} (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="decimal"
                      value={formData.rate_per_unit}
                      onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  {/* Produce & Ghee Quality Inspection Section */}
                  <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-200 space-y-2.5">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Award size={14} className="text-emerald-600" /> Produce &amp; Ghee Quality Attributes
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-700">Batch / Lot No</label>
                        <input
                          type="text"
                          value={formData.batch_lot_no}
                          onChange={(e) => setFormData({ ...formData, batch_lot_no: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-700">Purity % / Brix</label>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={formData.purity_percentage}
                          onChange={(e) => setFormData({ ...formData, purity_percentage: e.target.value })}
                          placeholder="e.g. 99.5"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 text-center"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-700">Packaging Type</label>
                        <select
                          value={formData.packaging_type}
                          onChange={(e) => setFormData({ ...formData, packaging_type: e.target.value })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                        >
                          {PACKAGING_PRESETS.map((pkg) => (
                            <option key={pkg} value={pkg}>
                              {pkg}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-700">Storage Destination</label>
                        <select
                          value={formData.storage_location}
                          onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                        >
                          <option value="Cold Storage (0-4°C)">Cold Storage (0-4°C)</option>
                          <option value="Dry Ambient Warehouse">Dry Ambient Warehouse</option>
                          <option value="Ghee Storage Cellar">Ghee Storage Cellar</option>
                          <option value="Fruit Ripening Bay">Fruit Ripening Bay</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Amount Banner */}
              {Number(formData.quantity) > 0 && (
                <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950">Payout Total:</span>
                  <span className="text-lg font-black text-emerald-900">
                    ₹{(Number(formData.quantity) * (Number(formData.rate_per_unit) || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Authenticated Collector & Payment Status */}
              <div className="space-y-2.5">
                {/* Authenticated User Profile Strip */}
                <div className="p-2.5 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/40 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {authenticatedCollectorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {authenticatedCollectorName}
                        </span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold tracking-tight">
                          <CheckCircle2 size={10} className="text-emerald-600" /> Logged In
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {user?.email || "Authenticated Session"} {authenticatedCollectorPhone ? `• ${authenticatedCollectorPhone}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-white/90 px-2 py-1 rounded-lg border border-emerald-200/60 shrink-0">
                    {user?.active_role || "ADMIN"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                      <span>Collector Name</span>
                      <span className="text-[9px] font-semibold text-emerald-700 flex items-center gap-0.5">
                        <ShieldCheck size={10} /> Auth Collector
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.collector_name}
                      onChange={(e) => setFormData({ ...formData, collector_name: e.target.value })}
                      placeholder="Collector Name"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Payment Status</label>
                    <select
                      value={formData.payment_status}
                      onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PENDING">Pending (Weekly Settlement)</option>
                      <option value="PAID">Paid Instant</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
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
                    <PlusCircle size={14} /> Next
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
      {selectedCollection && (() => {
        const modalVendor = registeredVendors.find((v) => v.vendor_id === selectedCollection.vendor_id);
        const modalVendorPhone = selectedCollection.vendor_phone || modalVendor?.phone || "";

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 rounded-t-3xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Intake Receipt</h2>
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
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 font-mono text-xs">
                  <div className="text-center pb-2 border-b border-dashed border-slate-300">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 uppercase">F2H Fresh Intake</h3>
                    <p className="text-[10px] text-slate-500 font-sans">
                      {selectedCollection.collection_type === "MILK" ? "Milk Procurement Slip" : "Produce & Ghee Intake Slip"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block font-sans">Date:</span>
                      <strong className="text-slate-800">
                        {selectedCollection.collection_date} ({selectedCollection.shift})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Vendor:</span>
                      <strong className="text-slate-800">{selectedCollection.vendor_name}</strong>
                      {modalVendorPhone && (
                        <span className="text-[10px] text-emerald-700 font-mono font-semibold block">
                          +91 {modalVendorPhone.replace(/^(\+91|91|0)/, '')}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-400 font-sans">Collector:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-600" />
                        {selectedCollection.collector_name}
                        {selectedCollection.collector_phone ? ` (${selectedCollection.collector_phone})` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Quality / Specs Box */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5">
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
                      <span className="font-sans text-slate-600">Rate:</span>
                      <span className="font-bold text-slate-900">₹{selectedCollection.rate_per_unit}/{selectedCollection.unit}</span>
                    </div>

                    {selectedCollection.collection_type === "MILK" ? (
                      <>
                        {selectedCollection.fat_percentage && (
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                            <span className="font-sans text-slate-600">Fat % / SNF %:</span>
                            <span className="font-bold text-blue-700">
                              {selectedCollection.fat_percentage}% / {selectedCollection.snf_percentage || "--"}%
                            </span>
                          </div>
                        )}
                        {selectedCollection.clr_reading && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-sans text-slate-600">CLR Reading:</span>
                            <span className="font-bold text-indigo-700">{selectedCollection.clr_reading}</span>
                          </div>
                        )}
                        {selectedCollection.container_can_no && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-sans text-slate-600">Can No:</span>
                            <span className="font-bold text-slate-900">{selectedCollection.container_can_no}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {selectedCollection.batch_lot_no && (
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                            <span className="font-sans text-slate-600">Batch Lot:</span>
                            <span className="font-bold text-purple-700">{selectedCollection.batch_lot_no}</span>
                          </div>
                        )}
                        {selectedCollection.packaging_type && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-sans text-slate-600">Packaging:</span>
                            <span className="font-bold text-slate-900">{selectedCollection.packaging_type}</span>
                          </div>
                        )}
                        {selectedCollection.purity_percentage && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-sans text-slate-600">Purity / Brix:</span>
                            <span className="font-bold text-emerald-700">{selectedCollection.purity_percentage}%</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Total Payout */}
                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-300 text-sm">
                    <span className="font-bold text-slate-800 uppercase">Payout Total:</span>
                    <span className="font-bold text-base text-emerald-800">
                      ₹{selectedCollection.total_amount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="text-center pt-1 text-[10px] text-slate-400 font-sans">
                    Status: <strong className="text-slate-700">{selectedCollection.payment_status}</strong> (Mode:{" "}
                    {selectedCollection.payment_mode || "CASH"})
                  </div>
                </div>

                {/* Direct Vendor WhatsApp Action Strip */}
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-emerald-700" /> Send Slip to Vendor WhatsApp
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                      {modalVendorPhone ? `+91 ${modalVendorPhone.replace(/^(\+91|91|0)/, '')}` : "No number"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={getWhatsAppSlipUrl(selectedCollection, modalVendorPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#16a34a] text-white hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-700/20 active:scale-95"
                    >
                      <MessageSquare size={15} /> Send WhatsApp Slip
                    </a>
                    {modalVendorPhone && (
                      <a
                        href={`tel:${modalVendorPhone}`}
                        className="p-2.5 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors flex items-center justify-center"
                        title="Call Vendor"
                      >
                        <PhoneCall size={15} />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex items-center justify-between gap-2">
                <a
                  href={getWhatsAppSlipUrl(selectedCollection, modalVendorPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare size={14} /> WhatsApp Slip
                </a>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTogglePayment(selectedCollection)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${selectedCollection.payment_status === "PAID"
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
        );
      })()}

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
              <h3 className="text-sm font-bold text-slate-900">Remove Intake Slip?</h3>
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
