"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api.client";
import {
  ShoppingCart, Package, Truck, MapPin, 
  TrendingUp, AlertCircle, Clock, Sparkles,
  Activity, ArrowRight, ArrowUpRight, CheckCircle2, 
  BarChart2, Bell, Search, RefreshCw,
  ChevronRight, Users, Box, Zap, ShieldAlert,
  Map as MapIcon, Layers, Orbit
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPI {
  total_customers: number;
  active_customers: number;
  total_riders: number;
  active_riders: number;
  total_products: number;
  active_products: number;
  low_stock_count: number;
  total_inventory: number;
}

interface DashData {
  kpi: KPI;
  lists: {
    recentCustomers: any[];
    deliveryPartnersList: any[];
    zoneSummary: any[];
  };
}

/* 
  Tailwind Safelist for dynamic classes:
  border-l-blue-500 border-l-amber-500 border-l-indigo-500 border-l-emerald-500 border-l-green-500 border-l-rose-500
  bg-blue-500/5 bg-amber-500/5 bg-indigo-500/5 bg-emerald-500/5 bg-green-500/5 bg-rose-500/5
  border-l-blue-400 border-l-amber-400 border-l-indigo-400 border-l-green-400 border-l-emerald-400
  bg-blue-50/50 bg-amber-50/50 bg-indigo-50/50 bg-green-50/50 bg-emerald-50/50
  text-blue-600 text-amber-600 text-indigo-600 text-green-600 text-emerald-600
  bg-blue-400 bg-amber-400 bg-indigo-400 bg-green-400 bg-emerald-400
  from-blue-300 from-amber-300 from-indigo-300 from-green-300 from-emerald-300
  to-blue-500 to-amber-500 to-indigo-500 to-green-500 to-emerald-500
  hover:border-blue-400 hover:border-amber-400 hover:border-indigo-400 hover:border-green-400 hover:border-emerald-400
*/

// ── Components ────────────────────────────────────────────────────────────────

function HUDCard({ label, value, icon: Icon, color, status }: any) {
  const colorStyles: any = {
    blue: { bg: 'bg-blue-50/30', border: 'border-l-blue-300', hover: 'hover:border-blue-300', iconBg: 'bg-blue-100/50', iconText: 'text-blue-500', dot: 'bg-blue-300', barFrom: 'from-blue-200', barTo: 'to-blue-400', glow: 'bg-blue-400/10' },
    amber: { bg: 'bg-amber-50/30', border: 'border-l-amber-300', hover: 'hover:border-amber-300', iconBg: 'bg-amber-100/50', iconText: 'text-amber-500', dot: 'bg-amber-300', barFrom: 'from-amber-200', barTo: 'to-amber-400', glow: 'bg-amber-400/10' },
    indigo: { bg: 'bg-indigo-50/30', border: 'border-l-indigo-300', hover: 'hover:border-indigo-300', iconBg: 'bg-indigo-100/50', iconText: 'text-indigo-500', dot: 'bg-indigo-300', barFrom: 'from-indigo-200', barTo: 'to-indigo-400', glow: 'bg-indigo-400/10' },
    green: { bg: 'bg-green-50/30', border: 'border-l-green-300', hover: 'hover:border-green-300', iconBg: 'bg-green-100/50', iconText: 'text-green-500', dot: 'bg-green-300', barFrom: 'from-green-200', barTo: 'to-green-400', glow: 'bg-green-400/10' },
    emerald: { bg: 'bg-emerald-50/30', border: 'border-l-emerald-300', hover: 'hover:border-emerald-300', iconBg: 'bg-emerald-100/50', iconText: 'text-emerald-500', dot: 'bg-emerald-300', barFrom: 'from-emerald-200', barTo: 'to-emerald-400', glow: 'bg-emerald-400/10' }
  };
  const s = colorStyles[color] || colorStyles.blue;

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      className={`${s.bg} backdrop-blur-md rounded-[16px] md:rounded-[20px] p-2 md:p-4 shadow-xl border border-white/40 border-l-[3px] md:border-l-[6px] ${s.border} ${s.hover} transition-all relative overflow-hidden group flex flex-col h-full`}
    >
      <div className={`absolute top-0 right-0 w-20 h-20 ${s.glow} rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-1000`} />
      
      <div className="flex items-center justify-between mb-2 md:mb-3 relative">
        <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl ${s.iconBg} ${s.iconText} shadow-sm`}>
          <Icon size={14} className="md:w-[18px] md:h-[18px]" />
        </div>
        <div className="flex flex-col items-end">
          <div className={`flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-white/60 backdrop-blur-sm border border-white/30`}>
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${s.dot} animate-pulse`} />
            <span className="text-[7px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
          </div>
        </div>
      </div>
      
      <div className="relative">
        <h3 className="text-sm md:text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-none break-words">{value}</h3>
        <p className="text-[7px] md:text-[9px] font-bold text-slate-400 mt-0.5 md:mt-1 uppercase tracking-[0.1em] md:tracking-[0.2em]">{label}</p>
      </div>
      
      <div className="mt-3 md:mt-4 flex items-center justify-between relative">
        <div className="h-1 flex-1 bg-slate-100/50 rounded-full overflow-hidden mr-3 md:mr-4 shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "75%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`h-full bg-gradient-to-r ${s.barFrom} ${s.barTo} rounded-full`}
          />
        </div>
        <button className="p-1.5 md:p-2 rounded-lg bg-white/50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
          <ChevronRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}

function StatCardSmall({ label, value, trend, icon: Icon, color }: any) {
  const colorStyles: any = {
    blue: { bg: 'bg-blue-50/30', border: 'border-l-blue-200', hover: 'hover:border-blue-200', iconBg: 'bg-blue-100/50', iconText: 'text-blue-500', glow: 'bg-blue-400/5', arrow: 'text-blue-200', arrowHover: 'group-hover:text-blue-500' },
    green: { bg: 'bg-green-50/30', border: 'border-l-green-200', hover: 'hover:border-green-200', iconBg: 'bg-green-100/50', iconText: 'text-green-500', glow: 'bg-green-400/5', arrow: 'text-green-200', arrowHover: 'group-hover:text-green-500' },
    rose: { bg: 'bg-rose-50/30', border: 'border-l-rose-200', hover: 'hover:border-rose-200', iconBg: 'bg-rose-100/50', iconText: 'text-rose-500', glow: 'bg-rose-400/5', arrow: 'text-rose-200', arrowHover: 'group-hover:text-rose-500' },
    emerald: { bg: 'bg-emerald-50/30', border: 'border-l-emerald-200', hover: 'hover:border-emerald-200', iconBg: 'bg-emerald-100/50', iconText: 'text-emerald-500', glow: 'bg-emerald-400/5', arrow: 'text-emerald-200', arrowHover: 'group-hover:text-emerald-500' },
    amber: { bg: 'bg-amber-50/30', border: 'border-l-amber-200', hover: 'hover:border-amber-200', iconBg: 'bg-amber-100/50', iconText: 'text-amber-500', glow: 'bg-amber-400/5', arrow: 'text-amber-200', arrowHover: 'group-hover:text-amber-500' }
  };
  const s = colorStyles[color] || colorStyles.blue;

  return (
    <div className={`${s.bg} backdrop-blur-md rounded-tl-[32px] rounded-br-[32px] rounded-tr-[10px] rounded-bl-[10px] p-2 md:p-3 shadow-lg border border-white/40 border-l-[3px] md:border-l-[4px] ${s.border} flex flex-col ${s.hover} transition-all cursor-pointer group relative overflow-hidden`}>
      <div className={`absolute -right-6 -top-6 w-12 h-12 ${s.glow} rounded-full group-hover:scale-150 transition-transform duration-500`} />
      <div className="flex justify-between items-start relative z-10 mb-1 md:mb-2">
        <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg ${s.iconBg} flex items-center justify-center ${s.iconText}`}>
          <Icon size={12} className="md:w-4 md:h-4" />
        </div>
        <div className={`${s.arrow} ${s.arrowHover} group-hover:translate-x-1 group-hover:-translate-y-1 transition-all`}>
          <ArrowUpRight size={12} className="md:w-3.5 md:h-3.5" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{label}</p>
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="text-sm md:text-lg font-black text-slate-900 tracking-tight leading-none">{value}</span>
          {trend && (
            <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[6px] md:text-[8px] font-black ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingSubtitle() {
  const [textIndex, setTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  const texts = [
    "Your retail network is currently performing at peak efficiency.",
    "Real-time monitoring active across 12 dispatch units.",
    "Optimization patterns detected in North Zone logistics.",
    "Operational HUD stabilized. All systems nominal."
  ];

  useEffect(() => {
    const currentFullText = texts[textIndex];
    const speed = isDeleting ? 30 : 70;
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(currentFullText.substring(0, displayText.length + 1));
        if (displayText.length === currentFullText.length) {
          setTimeout(() => setIsDeleting(true), 3000);
        }
      } else {
        setDisplayText(currentFullText.substring(0, displayText.length - 1));
        if (displayText.length === 0) {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, speed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, textIndex]);

  return (
    <div className="flex items-center gap-2 h-6">
      <span className="text-slate-400 text-xs md:text-sm font-medium tracking-tight">
        {displayText}
      </span>
      <motion.span 
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="w-[2px] h-4 bg-brand-blue/40"
      />
    </div>
  );
}

function AlertCard({ title, time, status, type }: any) {
  const colorStyles: any = {
    critical: { text: 'text-rose-400', iconBg: 'bg-rose-100/30', statusText: 'text-rose-500' },
    warning: { text: 'text-amber-400', iconBg: 'bg-amber-100/30', statusText: 'text-amber-500' },
    info: { text: 'text-blue-400', iconBg: 'bg-blue-100/30', statusText: 'text-blue-500' }
  };
  const s = colorStyles[type as keyof typeof colorStyles] || colorStyles.info;

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/30 transition-all group cursor-pointer border-l-[3px] border-l-transparent hover:border-l-rose-400">
      <div className={`w-10 h-10 shrink-0 rounded-full ${s.iconBg} backdrop-blur-sm flex items-center justify-center ${s.text}`}>
        <AlertCircle size={18} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-[8px] font-black ${s.statusText} uppercase tracking-widest`}>{status}</span>
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{time}</span>
        </div>
        <p className="text-xs font-bold text-slate-800 leading-tight truncate">{title}</p>
      </div>

      <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-all ${status === 'Offline' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-50/50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}>
        <ChevronRight size={12} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [typeIndex, setTypeIndex] = useState(0);

  const typingWords = ["Overview", "Intelligence", "Operations", "Insights"];

  const welcomeLines = [
    "Your retail network is currently performing at peak efficiency.",
    "The freshest harvest is on its way to 124 doorsteps today.",
    "Operations are synchronized. 85 units are on their last mile.",
    "Customer satisfaction is at an all-time high of 98%.",
    "New opportunities detected in the North Zone. Ready to expand?"
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const { data: res } = await api.get<DashData>("/f2h/dashboard/stats");
      if (res) setData(res);
    } catch { /* silent */ } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
    const interval = setInterval(() => {
      setWelcomeIndex((prev) => (prev + 1) % welcomeLines.length);
    }, 5000);
    const typeInterval = setInterval(() => {
      setTypeIndex((prev) => (prev + 1) % typingWords.length);
    }, 3000);
    return () => {
      clearInterval(interval);
      clearInterval(typeInterval);
    };
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-[6px] border-[#388e3c]/10 border-t-[#388e3c] rounded-full" 
          />
          <Orbit className="absolute inset-0 m-auto text-[#388e3c] animate-pulse" size={32} />
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">F2H COMMAND</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">Establishing Secure Connection...</p>
        </div>
      </div>
    );
  }

  // Mocked Ops for HUD (can be integrated later)
  const ops = {
    new_orders: 124,
    packing: 42,
    out_for_dispatch: 18,
    in_transit: 85
  };

  const alerts = [
    { id: 1, title: "Delayed Dispatch for Zone A", time: "10 mins ago", type: "critical", status: "Delayed" },
    { id: 2, title: "Inventory Low: A2 Pure Milk", time: "25 mins ago", type: "warning", status: "Critical" },
    { id: 3, title: "Rider #402 offline", time: "1 hour ago", type: "info", status: "Offline" },
  ];

  return (
    <div className="max-w-[1400px] w-full mx-auto px-2 sm:px-6 lg:px-8 space-y-2 md:space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      
      {/* ── Header Section ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-3">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#388e3c]/10 border border-[#388e3c]/20 shadow-sm"
          >
            <Sparkles size={14} className="text-[#388e3c]" />
            <span className="text-[10px] font-black text-[#388e3c] uppercase tracking-[0.2em]">{getGreeting()}, {user?.first_name || "Admin"}</span>
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight flex flex-wrap items-center gap-2">
            Strategic 
            <AnimatePresence mode="wait">
              <motion.span 
                key={typeIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-brand-gradient inline-block min-w-[200px]"
              >
                {typingWords[typeIndex]}
              </motion.span>
            </AnimatePresence>
          </h1>
          <div className="h-6 flex items-center">
            <AnimatePresence mode="wait">
              <motion.p 
                key={welcomeIndex}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                className="text-xs text-slate-400 font-medium max-w-xl"
              >
                {welcomeLines[welcomeIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] shadow-retail hover:bg-slate-50 transition-all active:scale-95"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin text-brand-blue" : ""} /> Sync
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#388e3c] text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-green-glow hover:scale-105 transition-all active:scale-95">
            <Zap size={12} /> New Batch
          </button>
        </div>
      </div>

      {/* ── New Member Welcome Ticker ── */}
      <AnimatePresence>
        {data?.lists.recentCustomers?.[0] && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-blue/5 border border-brand-blue/10 rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center justify-between group overflow-hidden relative gap-4"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-blue" />
            <div className="flex items-center gap-3 relative z-10 flex-1">
              <div className="w-8 h-8 shrink-0 rounded-full bg-brand-blue text-white flex items-center justify-center font-black text-xs shadow-lg shadow-brand-blue/20">
                {data.lists.recentCustomers[0].first_name?.[0] || "U"}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest break-words">New Member Joined</p>
                <p className="text-xs text-slate-500 font-medium break-words">
                  Welcome to the family, <span className="text-brand-blue font-bold">{data.lists.recentCustomers[0].first_name} {data.lists.recentCustomers[0].last_name}</span> from {data.lists.recentCustomers[0].zone_name}!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
               <motion.div 
                 animate={{ scale: [1, 1.2, 1] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest"
               >
                 Automation Active
               </motion.div>
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 {new Date(data.lists.recentCustomers[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live Operational HUD ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        <HUDCard label="Order Queue" value={ops.new_orders} icon={ShoppingCart} color="blue" status="LIVE FEED" />
        <HUDCard label="Warehouse Flow" value={ops.packing} icon={Package} color="amber" status="PACKING" />
        <HUDCard label="Dispatch Hub" value={ops.out_for_dispatch} icon={Truck} color="indigo" status="LOADING" />
        <HUDCard label="On-Road Units" value={ops.in_transit} icon={MapPin} color="emerald" status="TRANSIT" />
      </section>

      {/* ── Main Operations Grid ── */}
      <div className="grid grid-cols-12 gap-2 md:gap-6">
        
        {/* Left Column (8 cols): Fleet & Insights */}
        <div className="col-span-12 lg:col-span-8 space-y-2 md:space-y-6">
          
          {/* Quick Metrics from API */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 md:gap-6">
            <StatCardSmall label="Total Customers" value={data?.kpi.total_customers ?? 0} trend={12} icon={Users} color="blue" />
            <StatCardSmall label="Active Products" value={data?.kpi.active_products ?? 0} trend={5} icon={Package} color="green" />
            <StatCardSmall label="Inventory Risks" value={data?.kpi.low_stock_count ?? 0} trend={-2} icon={Box} color="rose" />
          </div>

          {/* Live Fleet Tracking Preview */}
          <div className="bg-white/20 backdrop-blur-md rounded-[24px] p-4 shadow-xl border border-white/30 overflow-hidden relative">
             <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-inner">
                    <MapIcon size={16} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Live Fleet Intelligence</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time geospatial tracking</p>
                  </div>
                </div>
                <Link href="/admin/delivery-boys/tracking" className="px-3 py-1.5 shrink-0 rounded-lg bg-slate-50 text-[10px] font-black text-indigo-600 hover:bg-slate-900 hover:text-white transition-all uppercase tracking-[0.2em] flex items-center gap-1.5">
                  Expand Map <ArrowRight size={12} />
                </Link>
             </div>
             
             <div className="aspect-[21/9] w-full bg-slate-50 rounded-[32px] relative overflow-hidden group border border-slate-100">
                <img src="/assets/bghero.webp" alt="Map Preview" className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale group-hover:scale-105 transition-transform duration-[2000ms]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white/80" />
                <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-[#388e3c]/30 to-transparent pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-[#388e3c]/30 to-transparent pointer-events-none" />
                
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                        <div className="relative p-6 rounded-full bg-white shadow-2xl border border-indigo-50">
                          <Activity size={40} className="text-indigo-500" />
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] bg-white/50 backdrop-blur-sm px-4 py-1 rounded-full border border-white/50">GEO-SYNC ACTIVE</span>
                   </div>
                </div>
             </div>
          </div>

          {/* Workflow Orchestrator */}
          <div className="bg-white/20 backdrop-blur-md rounded-[24px] p-4 text-slate-900 border border-white/30 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-1000 text-brand-blue">
              <Layers size={150} />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-none mb-1">
                Operations <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">HUD</span>
              </h1>
              <TypingSubtitle />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 mt-6">
                <Link href="/admin/Orders/allorders" className="p-2.5 rounded-2xl bg-white/20 border border-white/30 border-l-[4px] border-l-blue-400 hover:bg-white/40 hover:border-blue-400 hover:shadow-md transition-all group/card flex items-center gap-3">
                   <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover/card:scale-110 transition-transform">
                     <ShoppingCart size={16} />
                   </div>
                   <div className="min-w-0">
                     <h4 className="text-xs font-black text-slate-900 leading-tight truncate">Live Orders</h4>
                     <p className="text-[7px] md:text-[8px] text-slate-500 leading-tight font-medium line-clamp-1">Real-time validation</p>
                   </div>
                </Link>

                <Link href="/admin/Orders/today" className="p-2.5 rounded-2xl bg-white/20 border border-white/30 border-l-[4px] border-l-amber-400 hover:bg-white/40 hover:border-amber-400 hover:shadow-md transition-all group/card flex items-center gap-3">
                   <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 group-hover/card:scale-110 transition-transform">
                     <Package size={16} />
                   </div>
                   <div className="min-w-0">
                     <h4 className="text-xs font-black text-slate-900 leading-tight truncate">Packing Hub</h4>
                     <p className="text-[7px] md:text-[8px] text-slate-500 leading-tight font-medium line-clamp-1">Warehouse batching</p>
                   </div>
                </Link>

                <Link href="/admin/delivery-boys/tracking" className="p-2.5 rounded-2xl bg-white/20 border border-white/30 border-l-[4px] border-l-emerald-400 hover:bg-white/40 hover:border-emerald-400 hover:shadow-md transition-all group/card flex items-center gap-3">
                   <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover/card:scale-110 transition-transform">
                     <Truck size={16} />
                   </div>
                   <div className="min-w-0">
                     <h4 className="text-xs font-black text-slate-900 leading-tight truncate">Last Mile</h4>
                     <p className="text-[7px] md:text-[8px] text-slate-500 leading-tight font-medium line-clamp-1">Fleet coordination</p>
                   </div>
                </Link>
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Alerts & Tasks */}
        <div className="col-span-12 lg:col-span-4 space-y-4 md:space-y-6">
          
          {/* Alerts & Exceptions */}
          <div className="bg-white/20 backdrop-blur-md rounded-[20px] p-4 shadow-xl border border-white/30 flex flex-col">
            <div className="flex items-center justify-between mb-6 px-1">
               <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                 <Bell size={20} className="text-rose-400" /> Exceptions
               </h2>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Active</span>
               </div>
            </div>
            <div className="space-y-2 flex-1">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} title={alert.title} time={alert.time} type={alert.type} status={alert.status} />
              ))}
            </div>
            <button className="w-full mt-4 py-3 rounded-xl border-2 border-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] hover:bg-slate-900 hover:text-white transition-all">
              View All Alerts
            </button>
          </div>



          {/* Efficiency Pulse */}
          <div className="bg-white/20 backdrop-blur-md rounded-[20px] p-4 shadow-xl border border-white/30 overflow-hidden relative">
             <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
               <Activity size={18} className="text-[#388e3c]" /> Dispatch Pulse
             </h3>
             <div className="h-24 flex items-end gap-1.5 px-1">
                {[40, 70, 45, 90, 65, 80, 50, 95, 75, 85].map((h, i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.1, duration: 1, ease: "circOut" }}
                    className="flex-1 bg-gradient-to-t from-[#388e3c] to-emerald-400 rounded-t-xl"
                  />
                ))}
             </div>
             <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                <div className="space-y-0.5">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">System Efficiency</span>
                   <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">92.4%</span>
                </div>
                <div className="text-right">
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">+4.2%</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase">vs Last Hour</span>
                </div>
             </div>
          </div>

        </div>
      </div>

    </div>
  );
}
