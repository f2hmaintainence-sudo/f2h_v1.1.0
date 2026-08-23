// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : referral-payments/page.tsx
// Description : Delivery Partner Referral Payments Management Panel
//               Enables month-wise tracking of delivery partner referrals,
//               eligibility status, ₹75 payouts, and offline payment logging.
// ============================================================================

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Home,
  Gift,
  Building2,
  Calendar,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  CreditCard,
  Banknote,
  AlertCircle,
  Users,
  CheckSquare,
  Square,
  ShieldCheck,
  UserCheck,
  X,
  IndianRupee,
  Receipt,
} from "lucide-react";
import { api } from "@/services/api.client";

interface ReferralBonus {
  id: number;
  bonus_id: string;
  partner_id: string;
  partner_name: string;
  partner_phone: string;
  branch_id?: string | null;
  branch_name: string;
  refer_id?: string | null;
  referee_name: string;
  referee_phone?: string | null;
  order_id?: string | null;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  remarks?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  paid_by_name?: string | null;
  paid_amount?: number | null;
  payment_reference?: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentSummary {
  total_referrals: number;
  eligible_paid_count: number;
  eligible_unpaid_count: number;
  total_amount_earned: number;
  total_amount_paid: number;
  outstanding_amount: number;
  reward_per_referral: number;
}

export default function DeliveryPartnerReferralPaymentsPage() {
  const [bonuses, setBonuses] = useState<ReferralBonus[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selection for bulk payment
  const [selectedBonusIds, setSelectedBonusIds] = useState<string[]>([]);
  
  // Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetBonus, setTargetBonus] = useState<ReferralBonus | null>(null);
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>("");
  const [paymentRemarks, setPaymentRemarks] = useState<string>("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    api.get<any>("/admin/zone/branches-list?all=true")
      .then((res) => {
        if (res.data?.data) setBranches(res.data.data);
        else if (Array.isArray(res.data)) setBranches(res.data);
      })
      .catch(() => {
        api.get<any>("/admin/branches")
          .then((res) => {
            if (res.data?.data) setBranches(res.data.data);
          })
          .catch(() => {});
      });
  }, []);

  // Fetch Referral Bonuses
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== "all") params.append("month", selectedMonth);
      if (selectedBranchId) params.append("branch_id", selectedBranchId);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const url = `/admin/delivery/referral-payments?${params.toString()}`;
      const res = await api.get<any>(url);

      if (res.data?.status && res.data?.data) {
        setBonuses(res.data.data.bonuses || []);
        setSummary(res.data.data.summary || null);
      } else {
        throw new Error("Failed to load referral payment records");
      }
    } catch {
      setError("Unable to load delivery partner referral payments.");
      setBonuses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedBranchId, statusFilter, searchQuery]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  // Handle single pay button
  const handleOpenPayModalSingle = (bonus: ReferralBonus) => {
    setTargetBonus(bonus);
    setSelectedBonusIds([bonus.bonus_id]);
    setPaymentMode("Cash");
    setPaymentRefNumber(`CASH-${Date.now().toString().slice(-6)}`);
    setPaymentRemarks(`Referral bonus payout for ${bonus.referee_name}`);
    setIsModalOpen(true);
  };

  // Handle bulk pay button
  const handleOpenPayModalBulk = () => {
    if (selectedBonusIds.length === 0) return;
    setTargetBonus(null);
    setPaymentMode("Bank Transfer");
    setPaymentRefNumber(`BATCH-REF-${Date.now().toString().slice(-6)}`);
    setPaymentRemarks(`Batch referral payout for ${selectedBonusIds.length} referrals`);
    setIsModalOpen(true);
  };

  // Submit offline payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBonusIds.length === 0) return;

    setSubmittingPayment(true);
    try {
      const paymentReference = `${paymentMode} : ${paymentRefNumber}`.trim();
      const res = await api.post<any>("/admin/delivery/referral-payments/mark-paid", {
        bonus_ids: selectedBonusIds,
        payment_reference: paymentReference,
        remarks: paymentRemarks,
      });

      if (res.data?.status) {
        setActionSuccessMsg(res.data.message || `Successfully marked ${selectedBonusIds.length} referral(s) as paid offline.`);
        setIsModalOpen(false);
        setSelectedBonusIds([]);
        void fetchPayments();
        setTimeout(() => setActionSuccessMsg(null), 5000);
      } else {
        alert(res.data?.message || "Failed to mark payment.");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Select all pending checkbox
  const pendingBonuses = useMemo(() => bonuses.filter((b) => b.status === "pending"), [bonuses]);
  const isAllPendingSelected = pendingBonuses.length > 0 && pendingBonuses.every((b) => selectedBonusIds.includes(b.bonus_id));

  const toggleSelectAll = () => {
    if (isAllPendingSelected) {
      setSelectedBonusIds([]);
    } else {
      setSelectedBonusIds(pendingBonuses.map((b) => b.bonus_id));
    }
  };

  const toggleSelectBonus = (bonusId: string) => {
    setSelectedBonusIds((prev) =>
      prev.includes(bonusId) ? prev.filter((id) => id !== bonusId) : [...prev, bonusId]
    );
  };

  // Generate Month Options (Current + past 11 months + "all")
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      options.push({ value: val, label });
    }
    return options;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-300 font-sans">
      {/* ── Breadcrumb & Top Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Link href="/admin/dashboard" className="hover:text-emerald-700 flex items-center gap-1 transition-colors">
              <Home size={13} className="text-emerald-600" /> Dashboard
            </Link>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="text-slate-400">Deliveries Partners</span>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="font-bold text-emerald-800">Referral Payments</span>
          </nav>
          <div className="flex items-center gap-2.5 mt-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20">
              <Gift size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Delivery Partner Referral Payments
              </h1>
              <p className="text-xs text-slate-500">
                Track referral rewards (₹75 per eligible partner) and log physical offline payouts at month end.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-2xl px-3 py-2 shadow-2xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              aria-label="Filter by month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-2xl px-3 py-2 shadow-2xs">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <select
              aria-label="Filter by branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.branch_id || b.id} value={b.branch_id || b.id}>
                  {b.branch_name || b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void fetchPayments()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-emerald-600" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Success Alert Banner ── */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-black">{actionSuccessMsg}</span>
          </div>
          <button type="button" onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Referrals */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Total Referrals</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{summary?.total_referrals ?? bonuses.length}</span>
            <span className="text-[11px] font-semibold text-slate-400">records</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            ₹75 per eligible partner
          </div>
        </div>

        {/* Unpaid / Outstanding Referrals */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">Eligible Unpaid</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-700">{summary?.eligible_unpaid_count ?? pendingBonuses.length}</span>
            <span className="text-[11px] font-bold text-amber-600">awaiting payout</span>
          </div>
          <div className="mt-1 text-[11px] font-black text-amber-800">
            ₹{summary?.outstanding_amount?.toFixed(2) ?? (pendingBonuses.length * 75).toFixed(2)} outstanding
          </div>
        </div>

        {/* Paid Referrals */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Paid Out</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{summary?.eligible_paid_count ?? bonuses.filter((b) => b.status === "paid").length}</span>
            <span className="text-[11px] font-bold text-emerald-600">completed</span>
          </div>
          <div className="mt-1 text-[11px] font-black text-emerald-800">
            ₹{summary?.total_amount_paid?.toFixed(2) ?? "0.00"} disbursed
          </div>
        </div>

        {/* Total Earned Value */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 rounded-2xl p-4 text-white shadow-sm shadow-emerald-900/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">Total Program Value</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md text-emerald-300 flex items-center justify-center">
              <IndianRupee size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">₹{summary?.total_amount_earned?.toFixed(2) ?? (bonuses.length * 75).toFixed(2)}</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-200/90 font-medium">
            Physical / Offline Payout Mode
          </div>
        </div>
      </div>

      {/* ── Main Data Section ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {/* Controls & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3.5 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(
                [
                  { id: "all", label: "All Referrals", count: bonuses.length },
                  {
                    id: "pending",
                    label: "Eligible Unpaid",
                    count: pendingBonuses.length,
                  },
                  {
                    id: "paid",
                    label: "Paid Out",
                    count: bonuses.filter((b) => b.status === "paid").length,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs flex items-center gap-1.5 border ${
                    statusFilter === tab.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      statusFilter === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Live Search & Bulk Action Button */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search partner, referee, ref #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 placeholder:text-slate-400"
                />
              </div>

              {selectedBonusIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenPayModalBulk}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 transition-all"
                >
                  <Banknote size={14} />
                  <span>Pay Selected ({selectedBonusIds.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        {error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <AlertCircle size={26} className="text-rose-600" />
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchPayments()}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : loading && bonuses.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 px-4 py-16 text-sm font-semibold text-slate-500">
            <Loader2 size={20} className="animate-spin text-emerald-700" />
            Loading referral payments...
          </div>
        ) : bonuses.length === 0 ? (
          <div className="px-4 py-16 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">No referral records found</p>
            <p className="text-xs text-slate-400">Try choosing a different month or clearing your search filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-700"
                      title="Select all unpaid"
                    >
                      {isAllPendingSelected ? (
                        <CheckSquare size={16} className="text-emerald-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3.5">Referring Partner</th>
                  <th scope="col" className="px-4 py-3.5">Branch</th>
                  <th scope="col" className="px-4 py-3.5">Referred Partner / Referee</th>
                  <th scope="col" className="px-4 py-3.5">Referral Date</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Reward</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Payment Status</th>
                  <th scope="col" className="px-4 py-3.5">Payment Details</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {bonuses.map((bonus) => {
                  const isPaid = bonus.status === "paid";
                  const isPending = bonus.status === "pending";
                  const isSelected = selectedBonusIds.includes(bonus.bonus_id);

                  return (
                    <tr
                      key={bonus.id || bonus.bonus_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => toggleSelectBonus(bonus.bonus_id)}
                            className="text-slate-400 hover:text-emerald-600"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-emerald-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        ) : (
                          <CheckCircle2 size={16} className="text-slate-300 mx-auto" />
                        )}
                      </td>

                      {/* Referring Partner */}
                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          <Link
                            href={`/admin/delivery/partners/${bonus.partner_id}`}
                            className="hover:text-emerald-700 hover:underline"
                          >
                            {bonus.partner_name}
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          <span>{bonus.partner_phone || bonus.partner_id}</span>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        {bonus.branch_name || "Main Branch"}
                      </td>

                      {/* Referee */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">
                          {bonus.referee_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {bonus.referee_phone || "No phone"}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-600">
                        {new Date(bonus.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Reward */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-black text-slate-900 text-xs sm:text-sm">
                          ₹{Number(bonus.amount || 75).toFixed(2)}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-3.5 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={11} /> PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800 border border-amber-300">
                            <Clock size={11} /> UNPAID
                          </span>
                        )}
                      </td>

                      {/* Payment Details */}
                      <td className="px-4 py-3.5">
                        {isPaid ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-slate-800">
                              {bonus.payment_reference || "Physical Payout"}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Paid on {bonus.paid_at ? new Date(bonus.paid_at).toLocaleDateString("en-IN") : "N/A"}
                              {bonus.paid_by_name ? ` by ${bonus.paid_by_name}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Pending offline settlement</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-center">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModalSingle(bonus)}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-300 text-xs font-black rounded-lg transition-all shadow-2xs"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Offline Payment Confirmation Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Banknote size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Record Offline Referral Payment</h3>
                  <p className="text-[11px] text-slate-500">Delivery partners do not have a wallet; log physical payout.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {/* Payment Summary Box */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1 text-xs">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Selected Referrals:</span>
                  <span className="font-bold text-slate-900">{selectedBonusIds.length} item(s)</span>
                </div>
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Reward Rate:</span>
                  <span className="font-bold text-slate-900">₹75.00 / referral</span>
                </div>
                <div className="flex justify-between text-sm font-black text-emerald-900 pt-1 border-t border-emerald-200">
                  <span>Total Payout Amount:</span>
                  <span>₹{(selectedBonusIds.length * 75).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Cash", "Bank Transfer", "Cheque"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 text-xs font-black rounded-xl border transition-all ${
                        paymentMode === mode
                          ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Reference / Receipt No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Reference / Voucher / UTR No. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CASH-AUG-01, NEFT-8492048, Cheque #10294"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-xs font-semibold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Month-end offline cash disbursement approved by branch manager."
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-xs font-semibold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submittingPayment}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment || !paymentRefNumber.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {submittingPayment ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Confirm Physical Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
