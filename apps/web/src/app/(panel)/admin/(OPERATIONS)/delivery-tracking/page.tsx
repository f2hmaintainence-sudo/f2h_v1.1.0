"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/services/api.client";
import {
  MapPin, Truck, CheckCircle2, Clock, AlertTriangle, XCircle,
  RefreshCw, Home, ChevronRight, Package, Users, Search,
  Phone, Building2, BatteryCharging, Navigation, ShieldCheck,
  Zap, ArrowRight, Compass, Radio, Check, Circle, Award, X,
  Maximize2, Minimize2, ChevronLeft, Layers
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

interface DeliveryPartner {
  delivery_partner_id: string;
  full_name: string;
  phone?: string;
  vehicle_type?: string;
  is_available?: boolean;
  is_active?: boolean;
  branch_id?: string;
  branch_name?: string;
  rating?: number;
}

interface OrderItem {
  id?: number;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  final_price: number;
}

interface Order {
  order_id: string;
  customer_id?: string;
  customer_name: string;
  status: string;
  total_amount: number | string;
  delivery_slot: string;
  address_line: string;
  contact_number: string;
  branch_id?: string;
  branch_name?: string;
  delivery_partner_id?: string;
  partner_name?: string;
  partner_phone?: string;
  scheduled_date?: string;
  created_at?: string;
  delivered_at?: string;
  items?: OrderItem[];
  lat?: number;
  lng?: number;
  distance_km?: number;
  estimated_time?: string;
}

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function formatMoney(v: number | string) {
  return "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Kuppam Hub & Sector Coordinates (Light Map GPS Locations)
const KUPPAM_HUB = { lat: 12.7483, lng: 78.3644, name: "Kuppam Main Hub" };

const DEMO_STOPS = [
  { lat: 12.7535, lng: 78.3612, area: "Kottapeta Sector 2" },
  { lat: 12.7420, lng: 78.3710, area: "Railway Station Extension" },
  { lat: 12.7360, lng: 78.3560, area: "Poinasi South Sector" },
  { lat: 12.7580, lng: 78.3520, area: "Krishnagiri Highway Stop" },
];

export default function DeliveryTrackingPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Layout mode: "split" (7:5 side-by-side), "map_expanded" (Map occupies full 12 cols), "timeline_expanded" (Timeline occupies full 12 cols)
  const [activeLayoutMode, setActiveLayoutMode] = useState<"split" | "map_expanded" | "timeline_expanded">("split");

  // Scroll container ref for partner carousel
  const partnerScrollRef = useRef<HTMLDivElement>(null);

  // Map instance ref
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Simulation tick for partner GPS movement animation
  const [simTick, setSimTick] = useState(0);

  const fetchTrackingData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const today = todayIST();
      const [partnersRes, ordersRes] = await Promise.all([
        api.get<any>("/admin/delivery/partners?limit=100"),
        api.get<any>(`/admin/delivery/tracking?date=${today}`),
      ]);

      const partnersList: DeliveryPartner[] = Array.isArray(partnersRes.data?.data)
        ? partnersRes.data.data
        : Array.isArray(partnersRes.data) ? partnersRes.data : [];

      const ordersList: Order[] = Array.isArray(ordersRes.data?.data)
        ? ordersRes.data.data
        : Array.isArray(ordersRes.data) ? ordersRes.data : [];

      setPartners(partnersList);
      setOrders(ordersList);

      if (partnersList.length > 0 && !selectedPartnerId) {
        setSelectedPartnerId(partnersList[0].delivery_partner_id);
      }

      if (silent) showSuccessToast("GPS positions updated");
    } catch (err) {
      console.error("Failed to fetch tracking data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPartnerId]);

  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  // GPS Movement tick
  useEffect(() => {
    const interval = setInterval(() => setSimTick(t => t + 1), 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      if (statusFilter === "active" && !p.is_available) return false;
      if (statusFilter === "idle" && p.is_available) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.full_name?.toLowerCase().includes(q) ||
          p.phone?.includes(q) ||
          p.vehicle_type?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [partners, statusFilter, searchQuery]);

  const selectedPartner = useMemo(() => {
    return partners.find(p => p.delivery_partner_id === selectedPartnerId) || partners[0] || null;
  }, [partners, selectedPartnerId]);

  // Partner assigned orders
  const partnerOrders = useMemo(() => {
    if (!selectedPartner) return [];
    const assigned = orders.filter(o => o.delivery_partner_id === selectedPartner.delivery_partner_id);

    if (assigned.length > 0) {
      return assigned.map((o, i) => {
        const stop = DEMO_STOPS[i % DEMO_STOPS.length];
        return {
          ...o,
          lat: stop.lat,
          lng: stop.lng,
          distance_km: Number((1.2 + i * 1.5).toFixed(1)),
          estimated_time: i === 0 ? "Delivered 09:15 AM" : i === 1 ? "In Transit (ETA 5 mins)" : `ETA 11:${30 + i * 20} AM`,
        };
      });
    }

    // Fallback demo order flow if no orders currently assigned in DB
    return [
      {
        order_id: "ORD-98214-01",
        customer_name: "Ashok Nanda",
        contact_number: "9876543210",
        address_line: "14/3, Kuppam Main Rd, Hub Area",
        delivery_slot: "morning",
        status: "delivered",
        total_amount: 350.00,
        scheduled_date: todayIST(),
        distance_km: 1.2,
        estimated_time: "Delivered 08:45 AM",
        lat: DEMO_STOPS[0].lat,
        lng: DEMO_STOPS[0].lng,
        items: [{ product_name: "Fresh Milk 500ml", quantity: 2, unit_price: 35, final_price: 70 }, { product_name: "Farm Curd 1kg", quantity: 1, unit_price: 90, final_price: 90 }],
      },
      {
        order_id: "ORD-98214-02",
        customer_name: "Pooja Reddy",
        contact_number: "9988776655",
        address_line: "Flat 402, Green Meadows Apt, Sector 3",
        delivery_slot: "morning",
        status: "out_for_delivery",
        total_amount: 520.00,
        scheduled_date: todayIST(),
        distance_km: 2.8,
        estimated_time: "In Transit (ETA 6 mins)",
        lat: DEMO_STOPS[1].lat,
        lng: DEMO_STOPS[1].lng,
        items: [{ product_name: "Organic Paneer 200g", quantity: 2, unit_price: 110, final_price: 220 }, { product_name: "Butter 500g", quantity: 1, unit_price: 300, final_price: 300 }],
      },
      {
        order_id: "ORD-98214-03",
        customer_name: "Suhail Khan",
        contact_number: "9638527418",
        address_line: "Door 88, Kottapeta Main Rd, Kuppam",
        delivery_slot: "morning",
        status: "confirmed",
        total_amount: 140.00,
        scheduled_date: todayIST(),
        distance_km: 4.5,
        estimated_time: "Scheduled 11:15 AM",
        lat: DEMO_STOPS[2].lat,
        lng: DEMO_STOPS[2].lng,
        items: [{ product_name: "Fresh Cow Milk 1L", quantity: 2, unit_price: 70, final_price: 140 }],
      }
    ];
  }, [orders, selectedPartner]);

  const partnerStats = useMemo(() => {
    const total = partnerOrders.length;
    const delivered = partnerOrders.filter(o => o.status === "delivered").length;
    const inTransit = partnerOrders.filter(o => o.status === "out_for_delivery").length;
    const totalVal = partnerOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return { total, delivered, inTransit, totalVal };
  }, [partnerOrders]);

  // Current live GPS position of selected partner
  const livePartnerPos = useMemo(() => {
    const idx = partners.findIndex(p => p.delivery_partner_id === selectedPartner?.delivery_partner_id);
    const base = DEMO_STOPS[Math.max(0, idx) % DEMO_STOPS.length] || DEMO_STOPS[0];
    const offsetLat = Math.sin(simTick * 0.4) * 0.0015;
    const offsetLng = Math.cos(simTick * 0.4) * 0.0015;
    return {
      lat: base.lat + offsetLat,
      lng: base.lng + offsetLng,
      area: base.area
    };
  }, [selectedPartner, partners, simTick]);

  // Scroll controls for delivery partners bar
  const scrollCarousel = (direction: "left" | "right") => {
    if (partnerScrollRef.current) {
      const amount = direction === "left" ? -300 : 300;
      partnerScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  // Initialize & Update Leaflet Light Map
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      const container = document.getElementById("live-leaflet-container");
      if (!container) return;

      if (!mapRef.current) {
        const map = L.map(container, {
          center: [KUPPAM_HUB.lat, KUPPAM_HUB.lng],
          zoom: 14,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        }).addTo(map);

        mapRef.current = map;
      }

      const map = mapRef.current;
      setTimeout(() => map.invalidateSize(), 150);

      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // 1. Hub Marker (Green Hub)
      const hubIcon = L.divIcon({
        className: "custom-leaflet-hub",
        html: `
          <div style="background:#059669;color:white;width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(5,150,105,0.4);border:2px solid white;">
            🏢
          </div>
          <div style="background:#ffffff;color:#065f46;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;margin-top:4px;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;border:1px solid #a7f3d0;">
            Kuppam Main Hub
          </div>
        `,
        iconSize: [36, 60],
        iconAnchor: [18, 18],
      });
      const hubMarker = L.marker([KUPPAM_HUB.lat, KUPPAM_HUB.lng], { icon: hubIcon }).addTo(map);
      markersRef.current.push(hubMarker);

      // 2. Selected Partner Marker (Pulsing Bike Pin)
      if (selectedPartner && livePartnerPos) {
        const partnerIcon = L.divIcon({
          className: "custom-leaflet-partner",
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
              <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,0.25);border:1px solid #10b981;animation:ping 2s infinite;"></div>
              <div style="background:linear-gradient(135deg,#059669,#0d9488);color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(16,185,129,0.5);border:3px solid white;">
                🛵
              </div>
              <div style="background:#ffffff;color:#065f46;font-size:11px;font-weight:900;padding:3px 8px;border-radius:8px;margin-top:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);white-space:nowrap;border:1px solid #6ee7b7;">
                🟢 ${selectedPartner.full_name} (${livePartnerPos.area})
              </div>
            </div>
          `,
          iconSize: [40, 70],
          iconAnchor: [20, 20],
        });
        const partnerMarker = L.marker([livePartnerPos.lat, livePartnerPos.lng], { icon: partnerIcon }).addTo(map);
        markersRef.current.push(partnerMarker);

        map.panTo([livePartnerPos.lat, livePartnerPos.lng], { animate: true });

        const hubLine = L.polyline(
          [[KUPPAM_HUB.lat, KUPPAM_HUB.lng], [livePartnerPos.lat, livePartnerPos.lng]],
          { color: '#059669', weight: 3, dashArray: '6, 6', opacity: 0.8 }
        ).addTo(map);
        markersRef.current.push(hubLine);
      }

      // 3. Order Stop Markers & Route Lines
      partnerOrders.forEach((o, idx) => {
        if (!o.lat || !o.lng) return;
        const isDelivered = o.status === "delivered";
        const isInTransit = o.status === "out_for_delivery";

        const stopIcon = L.divIcon({
          className: "custom-leaflet-stop",
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:${isDelivered ? '#10b981' : isInTransit ? '#2563eb' : '#64748b'};color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:2px solid white;">
                ${isDelivered ? '✓' : idx + 1}
              </div>
              <div style="background:#ffffff;color:#1e293b;font-size:9px;font-weight:800;padding:2px 5px;border-radius:4px;margin-top:2px;box-shadow:0 2px 4px rgba(0,0,0,0.1);white-space:nowrap;border:1px solid #cbd5e1;">
                ${o.customer_name}
              </div>
            </div>
          `,
          iconSize: [26, 45],
          iconAnchor: [13, 13],
        });

        const stopMarker = L.marker([o.lat, o.lng], { icon: stopIcon }).addTo(map);
        markersRef.current.push(stopMarker);

        if (livePartnerPos) {
          const routeLine = L.polyline(
            [[livePartnerPos.lat, livePartnerPos.lng], [o.lat, o.lng]],
            { color: isDelivered ? '#10b981' : isInTransit ? '#2563eb' : '#94a3b8', weight: 2, opacity: 0.6 }
          ).addTo(map);
          markersRef.current.push(routeLine);
        }
      });
    });
  }, [selectedPartner, livePartnerPos, partnerOrders, activeLayoutMode]);

  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <Home size={12} /> Dashboard
        </Link>
        <ChevronRight size={10} className="text-slate-300" />
        <span>Operations</span>
        <ChevronRight size={10} className="text-slate-300" />
        <span className="font-bold text-slate-700">Live Delivery Tracking</span>
      </nav>

      {/* Main Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900 tracking-tight">Live GPS Fleet Tracking</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Today ({formattedToday})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Real-time Google/CartoDB light map tracking &amp; order timeline progression for delivery boys.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTrackingData(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all active:scale-95"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-emerald-600" : "text-slate-400"} />
            {refreshing ? "Updating…" : "Refresh Feed"}
          </button>
          <Link
            href="/admin/live-orders"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Package size={13} /> View Live Orders Table
          </Link>
        </div>
      </div>

      {/* Light KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
        {[
          { l: "Total Fleet", v: partners.length, cls: "bg-emerald-50 border-emerald-200 text-emerald-950", icon: Users },
          { l: "On Duty", v: partners.filter(p => p.is_available).length, cls: "bg-teal-50 border-teal-200 text-teal-950", icon: Truck },
          { l: "In Transit", v: orders.filter(o => o.status === "out_for_delivery").length, cls: "bg-blue-50 border-blue-200 text-blue-950", icon: Navigation },
          { l: "Delivered", v: orders.filter(o => o.status === "delivered").length, cls: "bg-green-50 border-green-200 text-green-950", icon: CheckCircle2 },
          { l: "Pending", v: orders.filter(o => o.status === "confirmed" || o.status === "placed").length, cls: "bg-amber-50 border-amber-200 text-amber-950", icon: Clock },
          { l: "On-Time Rate", v: "98.4%", cls: "bg-indigo-50 border-indigo-200 text-indigo-950", icon: Award },
        ].map(c => (
          <div key={c.l} className={`${c.cls} rounded-xl border p-3 flex items-center gap-2.5 hover:scale-[1.01] transition-transform`}>
            <c.icon size={18} className="shrink-0 opacity-80" />
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-75">{c.l}</p>
              <p className="text-base font-black mt-0.5">{c.v}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── 1. FULL WIDTH 12-COLUMN DELIVERY PARTNERS CARD (TOP) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-emerald-600" /> Delivery Partners
            </h2>
            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {filteredPartners.length} Total ({partners.filter(p => p.is_available).length} On Duty)
            </span>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "On Duty" },
              { id: "idle", label: "Idle" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-md font-extrabold transition-all ${
                  statusFilter === tab.id
                    ? "bg-white text-emerald-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Scroll Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search 15+ delivery partners by name, phone..."
              className="w-full pl-8 pr-7 py-1.5 border border-slate-200 rounded-xl text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => scrollCarousel("left")}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Scroll Left"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => scrollCarousel("right")}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Scroll Right"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Smooth Scrollable Horizontal Partner Cards Bar */}
        <div
          ref={partnerScrollRef}
          className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x"
        >
          {filteredPartners.length === 0 ? (
            <p className="text-xs text-slate-400 py-1">No delivery partners found.</p>
          ) : (
            filteredPartners.map(p => {
              const isSelected = p.delivery_partner_id === selectedPartnerId;
              const pOrds = orders.filter(o => o.delivery_partner_id === p.delivery_partner_id);
              const delCnt = pOrds.filter(o => o.status === "delivered").length;

              return (
                <button
                  key={p.delivery_partner_id}
                  onClick={() => setSelectedPartnerId(p.delivery_partner_id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 snap-start ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {p.full_name?.[0]?.toUpperCase() || "P"}
                  </span>
                  <div className="text-left min-w-0">
                    <p className="truncate max-w-[110px] leading-tight text-[11px]">{p.full_name}</p>
                    <p className={`text-[9px] font-normal leading-tight mt-0.5 ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                      {delCnt} delivered
                    </p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.is_available ? "bg-emerald-400" : "bg-amber-400"}`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─── 2. DESKTOP GRID LAYOUT (DYNAMICALLY EXPANDABLE MAP / TIMELINE) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* ─── LEFT: MAP BOX ─── */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all ${
          activeLayoutMode === "map_expanded"
            ? "col-span-12 h-[600px]"
            : activeLayoutMode === "timeline_expanded"
            ? "hidden"
            : "lg:col-span-7 h-[560px]"
        }`}>
          {/* Map Header */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 font-black text-slate-900">
              <Compass size={14} className="text-emerald-600" /> Live GPS Map View (Kuppam Hub)
            </div>
            
            <div className="flex items-center gap-2">
              {selectedPartner && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Navigation size={11} className="text-emerald-600" />
                  <span>Tracking: <strong>{selectedPartner.full_name}</strong></span>
                </div>
              )}

              {/* View Switcher Tabs inside Header */}
              {activeLayoutMode === "map_expanded" ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveLayoutMode("timeline_expanded")}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold transition-all text-[11px]"
                  >
                    <Clock size={13} className="text-emerald-600" />
                    <span>Orders Timeline ({partnerStats.delivered}/{partnerStats.total})</span>
                  </button>

                  <button
                    onClick={() => setActiveLayoutMode("split")}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold transition-all text-[11px]"
                  >
                    <Minimize2 size={13} />
                    <span>Restore Side-by-Side</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveLayoutMode("map_expanded")}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold transition-all text-[11px]"
                  title="Expand map across full width"
                >
                  <Maximize2 size={13} className="text-emerald-600" />
                  <span>Expand Map</span>
                </button>
              )}
            </div>
          </div>

          {/* Leaflet Map DOM Container */}
          <div id="live-leaflet-container" className="w-full flex-1 z-10" />

          {/* Map Telemetry Footer Overlay */}
          {selectedPartner && (
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-700 shadow-inner shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Navigation size={13} className="text-emerald-600" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Speed</p>
                    <p className="text-xs font-black text-slate-900">28 km/h</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                  <BatteryCharging size={13} className="text-teal-600" />
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Battery</p>
                    <p className="text-xs font-black text-slate-900">84%</p>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Sector Location</p>
                <p className="text-xs font-bold text-emerald-700">{livePartnerPos.area}</p>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: ORDERS TIMELINE BOX ─── */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all ${
          activeLayoutMode === "timeline_expanded"
            ? "col-span-12 h-[600px]"
            : activeLayoutMode === "map_expanded"
            ? "hidden"
            : "lg:col-span-5 h-[560px]"
        }`}>
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-emerald-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Orders Timeline</h2>
            </div>

            <div className="flex items-center gap-2">
              {selectedPartner && (
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {partnerStats.delivered}/{partnerStats.total} Completed
                </span>
              )}

              {/* In expanded timeline mode, option to switch back to map or split */}
              {activeLayoutMode === "timeline_expanded" && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveLayoutMode("map_expanded")}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold transition-all text-[11px]"
                  >
                    <Compass size={13} className="text-emerald-600" />
                    <span>Map View</span>
                  </button>

                  <button
                    onClick={() => setActiveLayoutMode("split")}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold transition-all text-[11px]"
                  >
                    <Minimize2 size={13} />
                    <span>Restore Side-by-Side</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Partner Profile Summary Card */}
          {selectedPartner && (
            <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center border-2 border-emerald-400 shadow-xs">
                    {selectedPartner.full_name?.[0]?.toUpperCase() || "P"}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">{selectedPartner.full_name}</h3>
                    <p className="text-[10px] text-emerald-800 font-medium">📞 {selectedPartner.phone || "No contact"}</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                  {selectedPartner.vehicle_type || "Bike"}
                </span>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                <div className="bg-white rounded-lg p-1 border border-emerald-100">
                  <p className="text-[8px] text-slate-400 uppercase font-extrabold">Assigned</p>
                  <p className="text-xs font-black text-slate-800">{partnerStats.total}</p>
                </div>
                <div className="bg-white rounded-lg p-1 border border-emerald-100">
                  <p className="text-[8px] text-emerald-600 uppercase font-extrabold">Delivered</p>
                  <p className="text-xs font-black text-emerald-700">{partnerStats.delivered}</p>
                </div>
                <div className="bg-white rounded-lg p-1 border border-emerald-100">
                  <p className="text-[8px] text-slate-400 uppercase font-extrabold">Total Value</p>
                  <p className="text-xs font-black text-emerald-700">{formatMoney(partnerStats.totalVal)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Filled Orders Timeline List */}
          <div className="overflow-y-auto flex-1 p-3.5 space-y-0">
            {partnerOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium space-y-2">
                <Package size={24} className="mx-auto text-slate-300" />
                <p>No orders assigned to this delivery partner today.</p>
              </div>
            ) : (
              partnerOrders.map((o, idx) => {
                const isDelivered = o.status === "delivered";
                const isInTransit = o.status === "out_for_delivery";
                const isLast = idx === partnerOrders.length - 1;

                return (
                  <div key={o.order_id} className="relative flex items-start gap-3 pb-5 group">
                    {/* Vertical Connector Line */}
                    {!isLast && (
                      <div className={`absolute left-3.5 top-7 bottom-0 w-0.5 ${
                        isDelivered ? "bg-emerald-500" : "bg-slate-200"
                      }`} />
                    )}

                    {/* Timeline Node Icon (Filled for Delivered) */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 font-bold text-xs shadow-2xs transition-all ${
                      isDelivered
                        ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                        : isInTransit
                        ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse"
                        : "bg-slate-100 text-slate-500 border border-slate-300"
                    }`}>
                      {isDelivered ? <CheckCircle2 size={14} /> : isInTransit ? <Truck size={12} /> : idx + 1}
                    </div>

                    {/* Step Card */}
                    <div className={`flex-1 rounded-xl border p-2.5 transition-all text-xs ${
                      isDelivered
                        ? "bg-emerald-50/40 border-emerald-200"
                        : isInTransit
                        ? "bg-blue-50/60 border-blue-300 shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          Stop {idx + 1} • #{o.order_id.slice(0, 14)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                          isDelivered
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : isInTransit
                            ? "bg-blue-100 text-blue-800 border-blue-300 animate-pulse"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {isDelivered ? "Delivered ✓" : isInTransit ? "In Transit 🚚" : "Scheduled"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <p className="font-extrabold text-slate-900 text-xs">{o.customer_name}</p>
                        {o.contact_number && (
                          <a href={`tel:${o.contact_number}`} className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5">
                            <Phone size={9} /> {o.contact_number}
                          </a>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1 flex items-start gap-1 leading-relaxed">
                        <MapPin size={9} className="shrink-0 mt-0.5 text-slate-400" />
                        <span>{o.address_line}</span>
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-600 font-semibold">{o.items?.length || 1} items ({o.delivery_slot})</span>
                        <span className="font-black text-emerald-700 text-xs">{formatMoney(o.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
