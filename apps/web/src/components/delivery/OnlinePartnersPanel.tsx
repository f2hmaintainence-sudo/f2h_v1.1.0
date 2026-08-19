// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OnlinePartnersPanel.tsx
// Description : Full Detailed Operational View of Online Delivery Partners
//               Including Complete Leave Standing, Pending Leave Requests,
//               GPS Location, Shift Progress, and Partner Specifications.
// ============================================================================

"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Activity, AlertTriangle, BatteryWarning, CalendarClock, CalendarOff,
  CheckCircle2, ChevronDown, ChevronUp, Loader2, MapPin, Phone, RefreshCw,
  Star, Truck, Wifi, WifiOff, Mail, ShieldCheck, ShieldAlert,
  Search, ExternalLink, IndianRupee, Clock, Award, User, AlertCircle, FileText
} from "lucide-react";
import Link from "next/link";
import { api } from "@/services/api.client";

export interface PendingLeaveDetail {
  id: number | string;
  leave_date: string;
  end_date?: string | null;
  leave_type: string;
  half_day_shift?: string | null;
  reason?: string | null;
  created_at?: string;
}

export interface UpcomingLeaveDetail {
  id: number | string;
  leave_date: string;
  end_date?: string | null;
  leave_type: string;
  half_day_shift?: string | null;
  reason?: string | null;
}

export interface TodayLeaveDetail {
  id: number | string;
  leave_type: string;
  leave_from: string;
  leave_to: string;
  half_day_shift?: string | null;
  reason?: string | null;
  status: string;
}

export interface OnlinePartner {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  profile_photo_url?: string | null;
  duty_status?: string | null;
  is_online?: boolean;
  is_available?: boolean;
  is_active?: boolean;
  is_verified?: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  last_location_at?: string | null;
  location_age_seconds?: number | null;
  is_location_stale?: boolean;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  driving_license_number?: string | null;
  salary_type?: string | null;
  monthly_fixed_salary?: number | null;
  per_order_commission?: number | null;
  fuel_allowance_daily?: number | null;
  joining_date?: string | null;
  average_rating?: number | null;
  total_deliveries?: number | null;
  total_runs?: number | null;
  max_daily_orders?: number | null;
  branch_id?: string | null;
  branch_name?: string | null;
  breakdown_reason?: string | null;
  breakdown_reported_at?: string | null;
  on_leave_today?: boolean;
  today_leave_details?: TodayLeaveDetail | null;
  pending_leave_requests?: number;
  has_pending_leave?: boolean;
  pending_leaves?: PendingLeaveDetail[];
  upcoming_leaves?: UpcomingLeaveDetail[];
  next_leave_date?: string | null;
  run_id?: string | null;
  run_status?: string | null;
  slot?: string | null;
  assigned_stops?: number;
  completed_stops?: number;
  failed_stops?: number;
}

interface Summary {
  total_online: number;
  on_duty: number;
  available: number;
  online_while_on_leave: number;
  with_pending_leave: number;
  stale_location: number;
}

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function relativeAge(seconds?: number | null): string {
  if (seconds == null) return "never";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  icon: React.ElementType;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer select-none ${tone} ${
        isActive ? "ring-2 ring-offset-1 ring-slate-900 shadow-md font-bold" : "hover:shadow-sm"
      }`}
    >
      <div className="rounded-xl bg-white/80 p-2 shadow-2xs">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wider opacity-75">{label}</p>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100/90 space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate ${mono ? "font-mono" : ""}`}>
        {Icon && <Icon size={13} className="shrink-0 text-slate-400" />}
        <span className="truncate">{value || "—"}</span>
      </p>
    </div>
  );
}

function OnlinePartnerDetailedCard({ partner }: { partner: OnlinePartner }) {
  const [expanded, setExpanded] = useState(false);
  const stops = `${partner.completed_stops ?? 0}/${partner.assigned_stops ?? 0}`;
  const stopsProgress = partner.assigned_stops && partner.assigned_stops > 0
    ? Math.min(100, Math.round(((partner.completed_stops ?? 0) / partner.assigned_stops) * 100))
    : 0;

  return (
    <div className={`rounded-3xl border transition-all bg-white overflow-hidden ${
      partner.on_leave_today
        ? "border-rose-300 shadow-sm ring-1 ring-rose-300/40"
        : partner.has_pending_leave
        ? "border-amber-300 shadow-sm"
        : "border-slate-200/90 hover:border-slate-300 hover:shadow-md"
    }`}>
      {/* Top Banner if On Leave Today */}
      {partner.on_leave_today && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 px-4 py-2 text-white flex items-center justify-between text-xs font-black">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="animate-bounce" />
            <span>CRITICAL: ONLINE WHILE ON APPROVED LEAVE TODAY</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] uppercase font-mono">
            {partner.today_leave_details?.leave_type || "Leave"}
          </span>
        </div>
      )}

      {/* Main Card Header */}
      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          {/* Partner Identity */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex items-center justify-center font-black text-sm shadow-md">
                {(partner.full_name || "D")[0].toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                  partner.is_location_stale ? "bg-amber-500" : "bg-emerald-500"
                }`}
                title={partner.is_location_stale ? "Stale GPS Fix" : "Live Active GPS"}
              >
                <span className={`h-2 w-2 rounded-full bg-white ${partner.is_location_stale ? "" : "animate-ping opacity-75"}`} />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/admin/delivery/partners/${partner.id}`}
                  className="text-sm font-black text-slate-900 hover:text-indigo-600 transition-colors truncate flex items-center gap-1.5"
                >
                  <span>{partner.full_name}</span>
                  <ExternalLink size={12} className="text-slate-400 opacity-60" />
                </Link>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {partner.id}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-1 flex-wrap">
                <a
                  href={`tel:${partner.phone}`}
                  className="font-semibold text-slate-700 hover:text-indigo-600 flex items-center gap-1 font-mono text-[11px]"
                >
                  <Phone size={11} className="text-slate-400" />
                  {partner.phone || "No phone"}
                </a>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                  <MapPin size={11} className="text-slate-400" />
                  {partner.branch_name || partner.branch_id || "Unassigned Hub"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  {partner.is_location_stale ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <WifiOff size={11} /> Stale GPS ({relativeAge(partner.location_age_seconds)})
                    </span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Wifi size={11} /> Live ({relativeAge(partner.location_age_seconds)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                partner.duty_status === "on_duty"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {partner.duty_status?.replace("_", " ") || "Off Duty"}
            </span>

            <span
              className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                partner.is_available
                  ? "bg-teal-100 text-teal-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {partner.is_available ? "Available" : "Busy"}
            </span>

            {partner.is_verified ? (
              <span className="px-2 py-1 rounded-xl text-[10px] font-bold bg-indigo-50 text-indigo-700 flex items-center gap-1 border border-indigo-100">
                <ShieldCheck size={12} /> Verified KYC
              </span>
            ) : (
              <span className="px-2 py-1 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-700 flex items-center gap-1 border border-amber-200">
                <ShieldAlert size={12} /> Pending KYC
              </span>
            )}
          </div>
        </div>

        {/* Breakdown Warning */}
        {partner.breakdown_reason && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-3.5 flex items-start gap-2.5 text-xs text-orange-900">
            <BatteryWarning size={17} className="text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Vehicle Breakdown Reported</p>
              <p className="text-[11px] text-orange-800 mt-0.5">{partner.breakdown_reason}</p>
            </div>
          </div>
        )}

        {/* ── LEAVE SECTION 1: ON LEAVE TODAY DETAILS ── */}
        {partner.on_leave_today && partner.today_leave_details && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-rose-900">
              <span className="flex items-center gap-1.5">
                <CalendarOff size={14} className="text-rose-600" />
                Approved Leave Details (Today)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px]">
                {partner.today_leave_details.leave_type}
                {partner.today_leave_details.half_day_shift ? ` (${partner.today_leave_details.half_day_shift})` : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-rose-800 pt-1">
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Leave Dates</span>
                <span className="font-bold">
                  {fmtDate(partner.today_leave_details.leave_from)} &rarr; {fmtDate(partner.today_leave_details.leave_to)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Reason Given</span>
                <span className="italic font-medium">{partner.today_leave_details.reason || "No reason specified"}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── LEAVE SECTION 2: PENDING LEAVE REQUESTS ── */}
        {partner.has_pending_leave && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-amber-900">
              <span className="flex items-center gap-1.5">
                <CalendarClock size={14} className="text-amber-600" />
                Pending Leave Request{partner.pending_leaves && partner.pending_leaves.length > 1 ? "s" : ""} Submitted ({partner.pending_leave_requests || 1})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] uppercase font-bold">
                Awaiting Admin Approval
              </span>
            </div>

            {partner.pending_leaves && partner.pending_leaves.length > 0 ? (
              <div className="space-y-2 pt-1">
                {partner.pending_leaves.map((pl, idx) => (
                  <div key={pl.id || idx} className="bg-white rounded-xl p-2.5 border border-amber-200/80 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <FileText size={12} className="text-amber-600" />
                        {fmtDate(pl.leave_date)} {pl.end_date ? `→ ${fmtDate(pl.end_date)}` : ""}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">
                        {pl.leave_type} {pl.half_day_shift ? `(${pl.half_day_shift})` : ""}
                      </span>
                    </div>
                    {pl.reason && (
                      <p className="text-[11px] text-slate-600 italic pl-4">
                        "{pl.reason}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-800">
                Partner has submitted {partner.pending_leave_requests} leave request(s) awaiting approval.
              </p>
            )}
          </div>
        )}

        {/* ── KEY PERFORMANCE & TODAY RUN METRICS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today Run</span>
            <p className="text-xs font-black text-slate-900 truncate">
              {partner.run_id ? (
                <span className="font-mono text-indigo-700">{partner.run_id}</span>
              ) : (
                <span className="text-slate-400">No active run</span>
              )}
            </p>
            {partner.slot && (
              <span className="text-[10px] font-bold capitalize text-slate-500 block">{partner.slot} Slot</span>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Stops Progress</span>
              <span className="text-slate-700">{stopsProgress}%</span>
            </div>
            <p className="text-xs font-black text-slate-900">{stops} Completed</p>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${stopsProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle</span>
            <p className="text-xs font-black text-slate-900 truncate">
              {partner.vehicle_number || "No Plate"}
            </p>
            <span className="text-[10px] font-bold capitalize text-slate-500 block">
              {partner.vehicle_type || "Two Wheeler"}
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rating & Deliveries</span>
            <div className="flex items-center gap-1 text-xs font-black text-amber-600">
              <Star size={13} fill="currentColor" />
              <span>{partner.average_rating ? partner.average_rating.toFixed(1) : "Unrated"}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 block">
              {partner.total_deliveries ?? 0} lifetime
            </span>
          </div>
        </div>

        {/* Toggle Details Button */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            <span>{expanded ? "Hide Partner Specifications" : "View Full Partner Details & Compensation"}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <Link
            href={`/admin/delivery/partners/${partner.id}`}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <User size={12} />
            <span>Partner 360 View</span>
          </Link>
        </div>

        {/* Expandable Full Partner Details */}
        {expanded && (
          <div className="border-t border-slate-100 pt-4 space-y-4 animate-in fade-in duration-200">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Personal, Vehicle & Operational Details
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                <DetailItem label="Partner ID" value={partner.id} mono />
                <DetailItem label="Full Name" value={partner.full_name} />
                <DetailItem label="Phone" value={partner.phone} icon={Phone} />
                <DetailItem label="Email" value={partner.email} icon={Mail} />
                <DetailItem label="Vehicle Type" value={partner.vehicle_type} />
                <DetailItem label="Vehicle Plate" value={partner.vehicle_number} mono />
                <DetailItem label="Driving License" value={partner.driving_license_number} mono />
                <DetailItem label="Assigned Branch" value={partner.branch_name || partner.branch_id} icon={MapPin} />
                <DetailItem
                  label="GPS Coordinates"
                  value={
                    partner.current_lat && partner.current_lng
                      ? `${partner.current_lat.toFixed(5)}, ${partner.current_lng.toFixed(5)}`
                      : "No Fix"
                  }
                  icon={MapPin}
                  mono
                />
                <DetailItem label="Last Location Update" value={relativeAge(partner.location_age_seconds)} icon={Clock} />
                <DetailItem label="Max Daily Capacity" value={`${partner.max_daily_orders || 50} orders`} />
                <DetailItem label="Joining Date" value={fmtDate(partner.joining_date)} />
              </div>
            </div>

            {/* Compensation Details */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Compensation & Salary Setup
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <DetailItem label="Salary Model" value={partner.salary_type || "Per Order / Commission"} />
                <DetailItem
                  label="Monthly Fixed Salary"
                  value={partner.monthly_fixed_salary ? `₹${partner.monthly_fixed_salary.toLocaleString()}` : "N/A"}
                  icon={IndianRupee}
                />
                <DetailItem
                  label="Per Order Commission"
                  value={partner.per_order_commission ? `₹${partner.per_order_commission}` : "N/A"}
                  icon={IndianRupee}
                />
                <DetailItem
                  label="Daily Fuel Allowance"
                  value={partner.fuel_allowance_daily ? `₹${partner.fuel_allowance_daily}/day` : "N/A"}
                  icon={IndianRupee}
                />
              </div>
            </div>

            {/* Upcoming Leaves */}
            {partner.upcoming_leaves && partner.upcoming_leaves.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                <p className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <CalendarClock size={14} className="text-indigo-600" />
                  Upcoming Approved Leaves
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {partner.upcoming_leaves.map((ul, idx) => (
                    <div key={ul.id || idx} className="bg-white p-2.5 rounded-xl border border-indigo-100 space-y-1">
                      <p className="font-bold text-slate-800">
                        {fmtDate(ul.leave_date)} {ul.end_date ? `→ ${fmtDate(ul.end_date)}` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {ul.leave_type} {ul.half_day_shift ? `(${ul.half_day_shift})` : ""} {ul.reason ? `• ${ul.reason}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnlinePartnersPanel({ branchId }: { branchId?: string }) {
  const [partners, setPartners] = useState<OnlinePartner[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "on_duty" | "available" | "on_leave" | "pending_leave" | "stale_gps">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const query = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : "";
    try {
      const res = await api.get<any>(`/admin/delivery/partners/online${query}`);
      if (res.data?.status && Array.isArray(res.data.data)) {
        setPartners(res.data.data);
        setSummary(res.data.summary ?? null);
        setError(null);
      } else {
        setError(res.data?.message || "Could not load online delivery partners");
        setPartners([]);
        setSummary(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not load online delivery partners");
      setPartners([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, [load]);

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      // 1. Filter mode
      if (filterMode === "on_duty" && p.duty_status !== "on_duty") return false;
      if (filterMode === "available" && !p.is_available) return false;
      if (filterMode === "on_leave" && !p.on_leave_today) return false;
      if (filterMode === "pending_leave" && !p.has_pending_leave) return false;
      if (filterMode === "stale_gps" && !p.is_location_stale) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (p.full_name || "").toLowerCase().includes(q) ||
          (p.id || "").toLowerCase().includes(q) ||
          (p.phone || "").toLowerCase().includes(q) ||
          (p.vehicle_number || "").toLowerCase().includes(q) ||
          (p.branch_name || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [partners, filterMode, searchQuery]);

  return (
    <section className="space-y-5 animate-in fade-in duration-300">
      {/* Header & Quick Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-lg font-black text-slate-900">
              Live Online Delivery Fleet
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational dashboard of active delivery partners on shift, live location, run progress, and leave requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span>Refresh Fleet</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Online"
            value={summary.total_online}
            tone="border-emerald-200 bg-emerald-50 text-emerald-800"
            icon={Wifi}
            isActive={filterMode === "all"}
            onClick={() => setFilterMode("all")}
          />
          <StatCard
            label="On Duty"
            value={summary.on_duty}
            tone="border-sky-200 bg-sky-50 text-sky-800"
            icon={Activity}
            isActive={filterMode === "on_duty"}
            onClick={() => setFilterMode("on_duty")}
          />
          <StatCard
            label="Available"
            value={summary.available}
            tone="border-teal-200 bg-teal-50 text-teal-800"
            icon={CheckCircle2}
            isActive={filterMode === "available"}
            onClick={() => setFilterMode("available")}
          />
          <StatCard
            label="On Leave Today"
            value={summary.online_while_on_leave}
            tone="border-rose-300 bg-rose-50 text-rose-800"
            icon={CalendarOff}
            isActive={filterMode === "on_leave"}
            onClick={() => setFilterMode("on_leave")}
          />
          <StatCard
            label="Pending Leave"
            value={summary.with_pending_leave}
            tone="border-amber-300 bg-amber-50 text-amber-800"
            icon={CalendarClock}
            isActive={filterMode === "pending_leave"}
            onClick={() => setFilterMode("pending_leave")}
          />
          <StatCard
            label="Stale GPS"
            value={summary.stale_location}
            tone="border-slate-200 bg-slate-50 text-slate-700"
            icon={WifiOff}
            isActive={filterMode === "stale_gps"}
            onClick={() => setFilterMode("stale_gps")}
          />
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Partner Name, Phone, Vehicle, Branch..."
            className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          {(
            [
              { key: "all", label: "All Online" },
              { key: "on_duty", label: "On Duty" },
              { key: "available", label: "Available" },
              { key: "on_leave", label: "On Leave" },
              { key: "pending_leave", label: "Pending Leave" },
              { key: "stale_gps", label: "Stale GPS" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setFilterMode(m.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === m.key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Online Partners List */}
      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center space-y-2">
          <AlertCircle size={24} className="mx-auto text-rose-600" />
          <p className="text-sm font-bold text-rose-800">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : loading && partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200/80 text-slate-400 gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="text-xs font-bold">Scanning active online delivery partners...</p>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <WifiOff size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-800">
            {partners.length === 0 ? "No Delivery Partners Currently Online" : "No Online Partners Match Filter"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {partners.length === 0
              ? "Delivery boys will appear in this live section as soon as they log into the app and mark their shift online."
              : "Try adjusting your search query or clicking 'All Online' to view all active partners."}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPartners.map((partner) => (
            <OnlinePartnerDetailedCard key={partner.id} partner={partner} />
          ))}
        </div>
      )}
    </section>
  );
}
