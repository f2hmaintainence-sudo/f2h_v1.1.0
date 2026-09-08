"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "@/services/api.client";
import {
  ShoppingCart, Package, Truck, CheckCircle2, Clock, AlertTriangle,
  XCircle, RefreshCw, Home, ChevronRight, Eye,
  Zap, Search, UserCheck, Calendar, MapPin, Phone,
  Building2, Layers, X, AlertCircle, UserPlus, ChevronLeft, FileSpreadsheet, Download, Camera
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";
import { downloadCSV, downloadExcel, ExportColumn } from "@/lib/exportUtils";
import {
  PaymentStatusBadge,
  DeliveryProofCell,
  ImagePreviewModal,
  getDeliveryImageUrl,
} from "@/app/(panel)/admin/(CUSTOMERS_ORDERS)/orders/components/OrdersTable";

interface OrderItem {
  id?: number;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number | string;
  coupon_amount?: number | string;
  total_price?: number | string;
  final_price: number;
  is_free?: boolean;
}

interface Order {
  order_id: string;
  customer_id?: string;
  customer_name: string;
  status: string;
  total_amount: number | string;
  subtotal?: number | string;
  discount_amount?: number | string;
  gst_amount?: number | string;
  payment_status?: string;
  payment_mode?: string;
  delivery_image?: string;
  delivery_slot: string;
  address_line: string;
  contact_number: string;
  branch_id?: string;
  branch_name?: string;
  order_source?: string;
  delivery_partner_id?: string;
  partner_name?: string;
  partner_phone?: string;
  assignment_method?: string;
  assigned_at?: string;
  scheduled_date?: string;
  created_at?: string;
  items?: OrderItem[];
  failed_reason?: string;
  cancel_reason?: string;
}

interface DeliveryPartner {
  delivery_partner_id: string;
  full_name: string;
  phone?: string;
  is_available?: boolean;
  // Partners are grouped by branch in the assignment dropdown.
  branch_id?: string;
  branch_name?: string;
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string; borderColor: string; label: string }> = {
  placed:           { icon: ShoppingCart, color: "text-sky-700",     bgColor: "bg-sky-50",     borderColor: "border-sky-300",     label: "Placed" },
  confirmed:        { icon: CheckCircle2, color: "text-teal-700",    bgColor: "bg-teal-50",    borderColor: "border-teal-300",    label: "Confirmed" },
  assigned:         { icon: UserCheck,    color: "text-indigo-700",  bgColor: "bg-indigo-50",  borderColor: "border-indigo-300",  label: "Assigned" },
  packed:           { icon: Package,      color: "text-purple-700",  bgColor: "bg-purple-50",  borderColor: "border-purple-300",  label: "Packed" },
  out_for_delivery: { icon: Truck,        color: "text-blue-700",    bgColor: "bg-blue-50",    borderColor: "border-blue-300",    label: "Out for Delivery" },
  delivered:        { icon: CheckCircle2, color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-300", label: "Delivered" },
  failed:           { icon: AlertCircle,  color: "text-rose-700",    bgColor: "bg-rose-50",    borderColor: "border-rose-300",    label: "Failed" },
  cancelled:        { icon: XCircle,      color: "text-slate-600",   bgColor: "bg-slate-100",  borderColor: "border-slate-300",   label: "Cancelled" },
};

const statusFlow = ["placed", "confirmed", "assigned", "packed", "out_for_delivery", "delivered"];

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function formatMoney(v: number | string) {
  return "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getItemSubtotal(item: OrderItem): number {
  return toAmount(item.unit_price) * toAmount(item.quantity || 1);
}

function getItemDiscount(item: OrderItem): number {
  return toAmount(item.discount_amount) + toAmount(item.coupon_amount);
}

function getItemTotal(item: OrderItem): number {
  const totalPrice = toAmount(item.total_price);
  const calculatedTotal = Math.max(0, getItemSubtotal(item) - getItemDiscount(item));
  if (totalPrice > 0 || item.is_free || calculatedTotal === 0) return totalPrice;

  const finalPrice = toAmount(item.final_price);
  if (finalPrice > 0 || item.is_free) return finalPrice;

  return calculatedTotal;
}

const ITEMS_PER_PAGE = 10;

const LIVE_ORDER_EXPORT_COLUMNS: ExportColumn<Order>[] = [
  { header: "Order ID", accessor: (order) => order.order_id },
  { header: "Customer", accessor: (order) => order.customer_name },
  { header: "Phone", accessor: (order) => order.contact_number },
  { header: "Branch", accessor: (order) => order.branch_name },
  { header: "Delivery Slot", accessor: (order) => order.delivery_slot },
  { header: "Delivery Partner", accessor: (order) => order.partner_name },
  { header: "Assignment", accessor: (order) => order.delivery_partner_id ? "Assigned" : "Unassigned" },
  { header: "Items", accessor: (order) => order.items?.map((item) => `${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ""} x${item.quantity}`).join("; ") },
  { header: "Amount", accessor: (order) => Number(order.total_amount || 0) },
  { header: "Payment Status", accessor: (order) => order.payment_status || "unpaid" },
  { header: "Payment Mode", accessor: (order) => order.payment_mode || "—" },
  { header: "Delivery Proof", accessor: (order) => order.delivery_image ? "Available" : "No" },
  { header: "Status", accessor: (order) => order.status },
  { header: "Source", accessor: (order) => order.order_source },
  { header: "Scheduled Date", accessor: (order) => order.scheduled_date },
  { header: "Created At", accessor: (order) => order.created_at },
  { header: "Address", accessor: (order) => order.address_line },
];

export default function LiveOrdersPage() {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Client-side filters
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const selectedDate = useMemo(() => todayIST(), []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [proofPreview, setProofPreview] = useState<{ url: string; title?: string } | null>(null);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setFetchError(null); }
    else setRefreshing(true);
    try {
      const qs = `?date=${selectedDate}`;
      const [trackRes, summaryRes] = await Promise.all([
        api.get<any>(`/admin/delivery/tracking${qs}`),
        api.get<any>(`/admin/delivery/tracking/summary${qs}`),
      ]);
      if (trackRes.error) {
        setFetchError(trackRes.error);
      } else {
        const rows = Array.isArray(trackRes.data?.data)
          ? trackRes.data.data
          : Array.isArray(trackRes.data) ? trackRes.data : [];
        setAllOrders(rows);
        setFetchError(null);
      }
      if (summaryRes.data?.data) setSummary(summaryRes.data.data);
      if (silent) showSuccessToast("Orders refreshed");
    } catch (e: any) {
      setFetchError(e?.message || "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // WebSockets: Real-time order updates (Replaces 30-second polling)
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : "");
    if (!baseUrl) return;

    const socket: Socket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      socket.emit("join_admin_live_orders");
    });

    socket.on("order_created", (newOrder: Order) => {
      if (!newOrder || !newOrder.order_id) return;
      setAllOrders(prev => {
        const exists = prev.some(o => o.order_id === newOrder.order_id);
        if (exists) return prev;
        return [newOrder, ...prev];
      });
      showSuccessToast(`New live order arrived: #${newOrder.order_id}`);
    });

    socket.on("order_status_changed", (updatedOrder: Partial<Order>) => {
      if (!updatedOrder || !updatedOrder.order_id) return;

      setAllOrders(prev => {
        const exists = prev.some(o => o.order_id === updatedOrder.order_id);
        if (!exists) {
          return [updatedOrder as Order, ...prev];
        }
        return prev.map(o => {
          if (o.order_id !== updatedOrder.order_id) return o;
          return {
            ...o,
            ...updatedOrder,
          };
        });
      });

      // Automatically update Order Details modal if currently open for this order
      setDetailOrder(prev => {
        if (prev && prev.order_id === updatedOrder.order_id) {
          return { ...prev, ...updatedOrder };
        }
        return prev;
      });
    });

    return () => {
      socket.off("connect");
      socket.off("order_created");
      socket.off("order_status_changed");
      socket.disconnect();
    };
  }, []);

  // Fetch partners once
  useEffect(() => {
    api.get<any>("/admin/delivery/partners?limit=200").then(res => {
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setPartners(list);
    }).catch(() => {});
  }, []);

  const handleAssignPartner = async () => {
    if (!assignOrder || !selectedPartner) return;
    setAssigning(true);
    try {
      await api.patch<any>(`/admin/delivery/orders/${assignOrder.order_id}/assign`, { partner_id: selectedPartner });
      showSuccessToast("Delivery boy assigned!");
      setAssignOrder(null);
      setSelectedPartner("");
      fetchOrders(true);
    } catch {
      alert("Failed to assign partner.");
    } finally {
      setAssigning(false);
    }
  };

  const slotsList = useMemo(() => {
    const s = new Set<string>();
    allOrders.forEach(o => { if (o.delivery_slot) s.add(o.delivery_slot); });
    return Array.from(s).sort();
  }, [allOrders]);

  const branchesList = useMemo(() => {
    const m = new Map<string, string>();
    allOrders.forEach(o => { if (o.branch_id && o.branch_name) m.set(o.branch_id, o.branch_name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (branchFilter && o.branch_id !== branchFilter) return false;
      if (slotFilter && o.delivery_slot !== slotFilter) return false;
      if (assignmentFilter === "assigned" && !o.delivery_partner_id) return false;
      if (assignmentFilter === "unassigned" && o.delivery_partner_id) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !o.order_id?.toLowerCase().includes(q) &&
          !o.customer_name?.toLowerCase().includes(q) &&
          !o.contact_number?.includes(q) &&
          !o.address_line?.toLowerCase().includes(q) &&
          !o.partner_name?.toLowerCase().includes(q) &&
          !o.branch_name?.toLowerCase().includes(q) &&
          !o.items?.some(i => i.product_name?.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    });
  }, [allOrders, statusFilter, branchFilter, slotFilter, assignmentFilter, searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, branchFilter, slotFilter, assignmentFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const clearFilters = () => {
    setStatusFilter(""); setSearchQuery(""); setBranchFilter(""); setSlotFilter(""); setAssignmentFilter("");
    setCurrentPage(1);
  };

  const exportLiveOrders = (format: "excel" | "csv") => {
    if (filteredOrders.length === 0) {
      alert("No orders match the current filters.");
      return;
    }

    const filename = `live-orders-${selectedDate}`;
    if (format === "excel") {
      downloadExcel(filename, "Live Orders", LIVE_ORDER_EXPORT_COLUMNS, filteredOrders);
    } else {
      downloadCSV(filename, LIVE_ORDER_EXPORT_COLUMNS, filteredOrders);
    }
  };

  const tabs = [
    { id: "", label: "All Orders", count: allOrders.length },
    { id: "placed", label: "Placed", count: allOrders.filter(o => o.status === "placed").length },
    { id: "confirmed", label: "Confirmed", count: allOrders.filter(o => o.status === "confirmed").length },
    { id: "assigned", label: "Assigned", count: allOrders.filter(o => o.status === "assigned").length },
    { id: "packed", label: "Packed", count: allOrders.filter(o => o.status === "packed").length },
    { id: "out_for_delivery", label: "Out for Delivery", count: allOrders.filter(o => o.status === "out_for_delivery").length },
    { id: "delivered", label: "Delivered", count: allOrders.filter(o => o.status === "delivered").length },
    { id: "failed", label: "Failed", count: allOrders.filter(o => o.status === "failed").length },
    { id: "cancelled", label: "Cancelled", count: allOrders.filter(o => o.status === "cancelled").length },
  ];

  const formattedToday = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  }, []);

  const detailPricing = useMemo(() => {
    const items = detailOrder?.items ?? [];
    const itemSubtotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
    const promotionDiscount = items.reduce((sum, item) => sum + toAmount(item.discount_amount), 0);
    const couponDiscount = items.reduce((sum, item) => sum + toAmount(item.coupon_amount), 0);
    const storedDiscount = toAmount(detailOrder?.discount_amount);

    return {
      subtotal: detailOrder?.subtotal === null || detailOrder?.subtotal === undefined
        ? itemSubtotal
        : toAmount(detailOrder.subtotal),
      promotionDiscount,
      couponDiscount,
      otherDiscount: Math.max(0, storedDiscount - promotionDiscount - couponDiscount),
      gst: toAmount(detailOrder?.gst_amount),
    };
  }, [detailOrder]);

  return (
    <div className="space-y-4 p-3 md:p-5 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <Home size={12} /> Dashboard
        </Link>
        <ChevronRight size={10} className="text-slate-300" />
        <span>Operations</span>
        <ChevronRight size={10} className="text-slate-300" />
        <span className="font-bold text-slate-700">Live Orders</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {/* Title block */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow shrink-0">
              <ShoppingCart size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black text-slate-900 tracking-tight whitespace-nowrap">Live Orders</h1>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {allOrders.length} orders loaded · <span className="text-emerald-600 font-bold">Live WebSockets</span>
              </p>
            </div>
          </div>

          {/* Controls — fixed today date badge + Refresh + Create Runs */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5 bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 text-emerald-800">
              <Calendar size={12} className="text-emerald-600 shrink-0" />
              <span className="text-[11px] font-extrabold whitespace-nowrap">
                Today ({formattedToday})
              </span>
            </div>
            <button
              type="button"
              onClick={() => exportLiveOrders("excel")}
              disabled={loading || filteredOrders.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 border border-emerald-700 rounded-lg text-[11px] font-bold text-white hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Export filtered orders to Excel"
            >
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button
              type="button"
              onClick={() => exportLiveOrders("csv")}
              disabled={loading || filteredOrders.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Export filtered orders to CSV"
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin text-emerald-600" : "text-slate-400"} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-rose-800">{fetchError}</p>
            <button onClick={() => fetchOrders()} className="text-[10px] text-rose-600 underline mt-1">Retry</button>
          </div>
        </div>
      )}

      {/* Light-themed KPI Cards */}
      {summary && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {[
            { l: "Total",      v: summary.total_orders,    cls: "bg-emerald-50 border-emerald-200 text-emerald-950" },
            { l: "Unassigned", v: summary.unassigned,      cls: summary.unassigned > 0 ? "bg-amber-100/80 border-amber-300 text-amber-950" : "bg-amber-50 border-amber-200 text-amber-900" },
            { l: "Assigned",   v: summary.assigned,        cls: "bg-teal-50 border-teal-200 text-teal-900" },
            { l: "In Transit", v: summary.in_transit,      cls: "bg-blue-50 border-blue-200 text-blue-900" },
            { l: "Delivered",  v: summary.delivered,       cls: "bg-green-50 border-green-200 text-green-900" },
            { l: "Failed",     v: summary.failed,          cls: "bg-rose-50 border-rose-200 text-rose-900" },
            { l: "Cancelled",  v: summary.cancelled,       cls: "bg-slate-100 border-slate-200 text-slate-700" },
            { l: "Active Boys",v: summary.active_partners, cls: "bg-indigo-50 border-indigo-200 text-indigo-900" },
          ].map(c => (
            <div key={c.l} className={`${c.cls} rounded-xl border p-3 hover:scale-[1.02] transition-transform`}>
              <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-75">{c.l}</p>
              <p className="text-xl font-black mt-0.5">{c.v ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        {/* Row 1: Search + dropdowns */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search ID, customer, phone, item…"
              className="w-full pl-8 pr-7 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Branch */}
          {branchesList.length > 0 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-w-[160px]"
            >
              <option value="">🏢 All Branches</option>
              {branchesList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {/* Slot */}
          {slotsList.length > 0 && (
            <select
              value={slotFilter}
              onChange={e => setSlotFilter(e.target.value)}
              className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-w-[140px] capitalize"
            >
              <option value="">🕐 All Slots</option>
              {slotsList.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          )}

          {/* Assignment */}
          <select
            value={assignmentFilter}
            onChange={e => setAssignmentFilter(e.target.value)}
            className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-w-[170px]"
          >
            <option value="">👤 All Assignments</option>
            <option value="assigned">Assigned to Partner</option>
            <option value="unassigned">Unassigned Only</option>
          </select>

          {(statusFilter || searchQuery || branchFilter || slotFilter || assignmentFilter) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold hover:bg-rose-100 transition-all"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Row 2: Status tabs — light theme pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          {tabs.map(tab => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  isSelected
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                  isSelected ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-[11px] font-bold text-slate-500 mt-3">Loading live orders…</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <ShoppingCart size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-600">
            {allOrders.length === 0 ? `No live orders today (${formattedToday})` : "No orders match the filter"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {allOrders.length === 0 ? "Orders placed for today will appear here in real-time." : "Clear filters to see all orders."}
          </p>
          {(statusFilter || searchQuery || branchFilter || slotFilter || assignmentFilter) && (
            <button onClick={clearFilters} className="mt-3 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-all">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5 whitespace-nowrap">Order</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Branch / Slot</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Delivery Boy</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Items</th>
                  <th className="px-3 py-2.5 whitespace-nowrap text-right">Amt</th>
                  <th className="px-3 py-2.5 whitespace-nowrap text-center">Proof</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 whitespace-nowrap text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.map(o => {
                  const sc = statusConfig[o.status] || statusConfig.pending;
                  const Icon = sc.icon;
                  const itemsCnt = o.items?.length ?? 0;

                  return (
                    <tr key={o.order_id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Order */}
                      <td className="px-3 py-2.5 align-top">
                        <div>
                          <p className="font-mono font-bold text-slate-900 text-[10px] group-hover:text-emerald-700 transition-colors whitespace-nowrap">
                            #{o.order_id.slice(0, 16)}
                          </p>
                          <p className="text-[9px] text-slate-400 capitalize mt-0.5">{o.order_source || "app"}</p>
                          {o.created_at && (
                            <p className="text-[9px] text-slate-400">
                              {new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-2.5 align-top" style={{ maxWidth: 180 }}>
                        <p className="font-bold text-slate-900 text-[11px] truncate max-w-[160px]">{o.customer_name || "Guest"}</p>
                        {o.contact_number && (
                          <a href={`tel:${o.contact_number}`} className="flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold hover:underline mt-0.5 whitespace-nowrap">
                            <Phone size={9} /> {o.contact_number}
                          </a>
                        )}
                        <p className="text-[9px] text-slate-400 mt-0.5 flex items-start gap-0.5 max-w-[160px]">
                          <MapPin size={8} className="shrink-0 mt-0.5 text-slate-300" />
                          <span className="line-clamp-2 leading-tight">{o.address_line || "—"}</span>
                        </p>
                      </td>

                      {/* Branch / Slot */}
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                          <Building2 size={10} className="text-slate-400" />
                          <span className="truncate max-w-[110px]">{o.branch_name || "Branch"}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-slate-600 capitalize">
                          <Clock size={10} className="text-slate-400" />
                          {o.delivery_slot || "—"}
                        </div>
                      </td>

                      {/* Delivery Boy (Clean & Aligned UI) */}
                      <td className="px-3 py-2.5 align-top" style={{ minWidth: 120 }}>
                        {o.delivery_partner_id ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black flex items-center justify-center shrink-0">
                                {o.partner_name?.[0]?.toUpperCase() || "P"}
                              </span>
                              <span className="font-bold text-slate-900 text-[11px] truncate max-w-[90px]">{o.partner_name}</span>
                            </div>
                            {o.partner_phone && (
                              <p className="text-[9px] text-slate-400 pl-6 mt-0.5">{o.partner_phone}</p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold whitespace-nowrap">
                            Not Assigned
                          </span>
                        )}
                      </td>

                      {/* Items (Uniform Pill Display) */}
                      <td className="px-3 py-2.5 align-top">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => setDetailOrder(o)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-[10px] font-bold text-slate-700 transition-all"
                          >
                            <Package size={10} className="text-emerald-600" />
                            <span>{itemsCnt} {itemsCnt === 1 ? "Item" : "Items"}</span>
                            <Eye size={10} className="text-slate-400" />
                          </button>
                          {o.items?.[0] && (
                            <p className="text-[9px] text-slate-400 truncate max-w-[110px] pl-0.5">{o.items[0].product_name}</p>
                          )}
                        </div>
                      </td>

                      {/* Amount & Payment Status */}
                      <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-extrabold text-slate-900 text-[11px] leading-tight">{formatMoney(o.total_amount)}</span>
                          <PaymentStatusBadge
                            paymentStatus={o.payment_status}
                            paymentMode={o.payment_mode}
                          />
                        </div>
                      </td>

                      {/* Proof Photo */}
                      <td className="px-3 py-2.5 align-top text-center whitespace-nowrap">
                        <DeliveryProofCell
                          imageUrl={o.delivery_image}
                          orderId={o.order_id}
                          onPreview={(url, title) => setProofPreview({ url, title })}
                        />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${sc.bgColor} ${sc.borderColor} ${sc.color}`}>
                          <Icon size={10} /> {sc.label}
                        </span>
                        {o.status === "failed" && o.failed_reason && (
                          <div className="text-[10px] text-rose-600 mt-1 font-semibold max-w-[140px] truncate" title={o.failed_reason}>
                            ⚠ {o.failed_reason}
                          </div>
                        )}
                        {o.status === "cancelled" && o.cancel_reason && (
                          <div className="text-[10px] text-slate-600 mt-1 font-semibold max-w-[140px] truncate" title={o.cancel_reason}>
                            ⚠ {o.cancel_reason}
                          </div>
                        )}
                      </td>

                      {/* Action — Details ONLY (Admin cannot change status directly) */}
                      <td className="px-3 py-2.5 align-top text-center whitespace-nowrap">
                        <button
                          onClick={() => setDetailOrder(o)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all border border-slate-200"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination Controls */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-600">
            <div>
              Showing <strong className="text-slate-800">{filteredOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{" "}
              <strong className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</strong> of{" "}
              <strong className="text-slate-800">{filteredOrders.length}</strong> orders
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[24px] h-6 px-1.5 rounded-md text-[10px] font-bold transition-all ${
                        currentPage === page
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Assign Delivery Boy Modal ─── */}
      {assignOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <UserPlus size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Assign Delivery Boy</h3>
                  <p className="text-[10px] text-slate-400">Order #{assignOrder.order_id}</p>
                </div>
              </div>
              <button onClick={() => setAssignOrder(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Order Summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-bold text-slate-800">{assignOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Slot</span>
                  <span className="font-bold text-slate-800 capitalize">{assignOrder.delivery_slot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Branch</span>
                  <span className="font-bold text-slate-800">{assignOrder.branch_name || "Main"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-emerald-700">{formatMoney(assignOrder.total_amount)}</span>
                </div>
              </div>

              {/* Partner Select (Filtered strictly by order's branch) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                    Select Delivery Boy
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Branch: {assignOrder.branch_name || "Main Hub"}
                  </span>
                </div>
                {(() => {
                  const branchPartners = partners.filter(p => {
                    if (!p.branch_id && !p.branch_name) return true;
                    if (assignOrder.branch_id && p.branch_id) {
                      return String(p.branch_id) === String(assignOrder.branch_id);
                    }
                    if (assignOrder.branch_name && p.branch_name) {
                      return p.branch_name.toLowerCase().trim() === assignOrder.branch_name.toLowerCase().trim();
                    }
                    return true;
                  });

                  if (branchPartners.length > 0) {
                    return (
                      <select
                        value={selectedPartner}
                        onChange={e => setSelectedPartner(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="">— Select a delivery partner ({branchPartners.length} in branch) —</option>
                        {branchPartners.map(p => (
                          <option key={p.delivery_partner_id} value={p.delivery_partner_id}>
                            {p.full_name}{p.phone ? ` · ${p.phone}` : ""} ({p.branch_name || "Branch"})
                          </option>
                        ))}
                      </select>
                    );
                  }

                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                      <p className="font-bold">No delivery boys found for branch &quot;{assignOrder.branch_name || "Main"}&quot;.</p>
                      <p className="text-[11px] text-amber-700">Please assign a delivery partner to this branch under Delivery Management.</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setAssignOrder(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignPartner}
                disabled={!selectedPartner || assigning}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? <RefreshCw size={12} className="animate-spin" /> : <UserPlus size={12} />}
                {assigning ? "Assigning…" : "Assign Partner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Order Details Modal (Light Theme & Read-only) ─── */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col shadow-xl border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <Package size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Order Details</h3>
                  <p className="text-[10px] text-slate-400">
                    #{detailOrder.order_id} · {detailOrder.scheduled_date?.split("T")[0]} · <span className="capitalize">{detailOrder.delivery_slot}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailOrder(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Status Pipeline */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Order Status Pipeline</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${(statusConfig[detailOrder.status] || statusConfig.pending).bgColor} ${(statusConfig[detailOrder.status] || statusConfig.pending).borderColor} ${(statusConfig[detailOrder.status] || statusConfig.pending).color}`}>
                    {detailOrder.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {statusFlow.map((st, idx) => {
                    const reached = statusFlow.indexOf(detailOrder.status) >= idx;
                    const current = detailOrder.status === st;
                    return (
                      <div key={st} className="flex flex-col items-center gap-1">
                        <div className={`w-full h-1 rounded-full ${reached ? "bg-emerald-500" : "bg-slate-200"}`} />
                        <span className={`text-[8px] font-bold capitalize text-center leading-tight ${current ? "text-emerald-700" : reached ? "text-slate-600" : "text-slate-300"}`}>
                          {st.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Failure / Cancellation Reason Banner */}
              {detailOrder.status === "failed" && detailOrder.failed_reason && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-900 shadow-2xs">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-rose-900">Delivery Failure Reason</h4>
                    <p className="text-xs font-semibold text-rose-800 mt-0.5">{detailOrder.failed_reason}</p>
                  </div>
                </div>
              )}
              {detailOrder.status === "cancelled" && detailOrder.cancel_reason && (
                <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 flex items-start gap-2.5 text-slate-800 shadow-2xs">
                  <XCircle size={16} className="text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-900">Cancellation Reason</h4>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{detailOrder.cancel_reason}</p>
                  </div>
                </div>
              )}

              {/* Customer + Partner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                  <p className="text-[10px] font-black text-slate-700 flex items-center gap-1 border-b border-slate-100 pb-1.5">
                    <UserCheck size={12} className="text-emerald-600" /> Customer
                  </p>
                  <p className="font-bold text-slate-900 text-xs">{detailOrder.customer_name}</p>
                  <p className="text-[11px] text-emerald-700 font-semibold">📞 {detailOrder.contact_number || "—"}</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1">
                    <MapPin size={10} className="shrink-0 text-slate-400 mt-0.5" />
                    <span>{detailOrder.address_line || "—"}</span>
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                  <p className="text-[10px] font-black text-slate-700 flex items-center gap-1 border-b border-slate-100 pb-1.5">
                    <Truck size={12} className="text-blue-600" /> Delivery Boy
                  </p>
                  {detailOrder.delivery_partner_id ? (
                    <>
                      <p className="font-bold text-slate-900 text-xs">{detailOrder.partner_name}</p>
                      <p className="text-[11px] text-blue-700 font-semibold">📞 {detailOrder.partner_phone || "—"}</p>
                      <p className="text-[10px] text-slate-400 capitalize">Method: {detailOrder.assignment_method || "Manual"}</p>
                    </>
                  ) : (
                    <div className="bg-amber-50 rounded-lg border border-amber-200 p-2">
                      <p className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                        <AlertTriangle size={11} className="text-amber-600" /> Not Assigned
                      </p>
                      <button
                        onClick={() => { setDetailOrder(null); setAssignOrder(detailOrder); setSelectedPartner(""); }}
                        className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold"
                      >
                        <UserPlus size={10} /> Assign Now
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
                    Branch: <strong className="text-slate-700">{detailOrder.branch_name || "—"}</strong>
                  </p>
                </div>
              </div>

              {/* Delivery Proof Photo */}
              {detailOrder.delivery_image && (
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                  <p className="text-[10px] font-black text-slate-700 flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Camera size={12} className="text-emerald-600" /> Proof of Delivery
                    </span>
                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      PHOTO VERIFIED
                    </span>
                  </p>
                  <div
                    onClick={() => {
                      const url = getDeliveryImageUrl(detailOrder.delivery_image);
                      if (url) setProofPreview({ url, title: `Delivery Proof — #${detailOrder.order_id}` });
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 max-h-48 flex items-center justify-center shadow-xs"
                    title="Click to expand photo"
                  >
                    <img
                      src={getDeliveryImageUrl(detailOrder.delivery_image)!}
                      alt="Delivery Proof"
                      className="w-full max-h-48 object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                      <Eye size={14} /> Click to View Full Photo
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package size={12} className="text-emerald-600" /> Itemized Breakdown
                  <span className="text-slate-400 normal-case font-semibold">({detailOrder.items?.length || 0} items)</span>
                </p>
                {detailOrder.items && detailOrder.items.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase">
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Variant</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit</th>
                          <th className="px-3 py-2 text-right">Discount</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailOrder.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-bold text-slate-900">{item.product_name}</td>
                            <td className="px-3 py-2 text-slate-500 text-[10px]">{item.variant_name || "Default"}</td>
                            <td className="px-3 py-2 text-center font-bold text-slate-700">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatMoney(item.unit_price)}</td>
                            <td className="px-3 py-2 text-right text-rose-600">
                              {getItemDiscount(item) > 0 ? `-${formatMoney(getItemDiscount(item))}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatMoney(getItemTotal(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-100">
                          <td colSpan={5} className="px-3 pt-2 text-right text-[10px] font-bold text-slate-600">Items Subtotal:</td>
                          <td className="px-3 pt-2 text-right font-bold text-slate-800 text-[11px]">{formatMoney(detailPricing.subtotal)}</td>
                        </tr>
                        {detailPricing.promotionDiscount > 0 && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-3 py-1 text-right text-[10px] font-bold text-rose-600">Promotion Discount:</td>
                            <td className="px-3 py-1 text-right font-bold text-rose-600 text-[11px]">-{formatMoney(detailPricing.promotionDiscount)}</td>
                          </tr>
                        )}
                        {detailPricing.couponDiscount > 0 && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-3 py-1 text-right text-[10px] font-bold text-rose-600">Coupon Discount:</td>
                            <td className="px-3 py-1 text-right font-bold text-rose-600 text-[11px]">-{formatMoney(detailPricing.couponDiscount)}</td>
                          </tr>
                        )}
                        {detailPricing.otherDiscount > 0 && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-3 py-1 text-right text-[10px] font-bold text-rose-600">Other Discount:</td>
                            <td className="px-3 py-1 text-right font-bold text-rose-600 text-[11px]">-{formatMoney(detailPricing.otherDiscount)}</td>
                          </tr>
                        )}
                        {detailPricing.gst > 0 && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-3 py-1 text-right text-[10px] font-bold text-slate-600">GST:</td>
                            <td className="px-3 py-1 text-right font-bold text-slate-700 text-[11px]">+{formatMoney(detailPricing.gst)}</td>
                          </tr>
                        )}
                        <tr className="bg-emerald-50 border-t border-emerald-100">
                          <td colSpan={5} className="px-3 py-2 text-right text-[10px] font-black text-slate-700">Total Amount:</td>
                          <td className="px-3 py-2 text-right font-black text-emerald-700 text-xs">{formatMoney(detailOrder.total_amount)}</td>
                        </tr>
                        <tr className="bg-emerald-50/50 border-t border-emerald-100/70">
                          <td colSpan={5} className="px-3 py-1.5 text-right text-[10px] font-bold text-slate-600">Payment Status:</td>
                          <td className="px-3 py-1.5 text-right">
                            <PaymentStatusBadge
                              paymentStatus={detailOrder.payment_status}
                              paymentMode={detailOrder.payment_mode}
                            />
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-[11px] text-slate-400">
                    No item breakdown available.
                  </div>
                )}
              </div>
            </div>

            {/* Footer — Read-only Close button */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                onClick={() => setDetailOrder(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ImagePreviewModal
        isOpen={Boolean(proofPreview)}
        imageUrl={proofPreview?.url || null}
        title={proofPreview?.title}
        onClose={() => setProofPreview(null)}
      />
    </div>
  );
}
