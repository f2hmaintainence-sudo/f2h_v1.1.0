// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Developer System Configurations - Cron run times, slot cutoffs,
//               delivery charges, discount rules, and customer ordering limits.
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Sliders,
  Clock,
  Truck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Loader2,
  Calendar,
  IndianRupee,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Sun,
  Moon,
  Info,
  ChevronRight,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

export default function SystemConfigPage() {
  const [activeTab, setActiveTab] = useState<"slots" | "crons" | "delivery" | "ordering">("slots");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // ── State for Configuration Sections ──
  const [slotTimings, setSlotTimings] = useState({
    morning_slot: {
      slot_name: "Morning",
      slot_key: "morning",
      delivery_window_start: "06:00",
      delivery_window_end: "08:30",
      customer_cutoff_time: "20:00",
      customer_cutoff_day_offset: -1,
      customer_cutoff_description: "8:00 PM previous evening",
      cron_run_time: "20:30",
      cron_run_day_offset: -1,
      cron_run_description: "Runs at 8:30 PM previous evening to generate morning runs",
      dispatch_start_time: "05:00",
      is_enabled: true,
    },
    evening_slot: {
      slot_name: "Evening",
      slot_key: "evening",
      delivery_window_start: "17:00",
      delivery_window_end: "20:00",
      customer_cutoff_time: "14:00",
      customer_cutoff_day_offset: 0,
      customer_cutoff_description: "2:00 PM same day",
      cron_run_time: "14:30",
      cron_run_day_offset: 0,
      cron_run_description: "Runs at 2:30 PM same day to generate evening runs",
      dispatch_start_time: "16:00",
      is_enabled: true,
    },
  });

  const [cronSchedules, setCronSchedules] = useState({
    subscription_order_generator: {
      name: "Subscription Daily Order Generator",
      is_enabled: true,
      schedule_time: "03:30",
      frequency: "daily",
      description: "Generates recurring daily subscription order instances for active schedules.",
    },
    auto_run_creation: {
      name: "Automated Delivery Run Creation & Assignment",
      is_enabled: true,
      cron_expression: "0 4,14 * * *",
      frequency: "twice_daily",
      description: "Optimizes and assigns delivery routes to active delivery partners for upcoming morning & evening slots.",
    },
    payment_reconciliation_sweeper: {
      name: "Payment Reconciliation & Wallet Sweeper",
      is_enabled: true,
      cron_expression: "*/15 * * * *",
      frequency: "every_15_minutes",
      description: "Sweeps stranded online payments into customer wallets and reconciles pending gateway transactions.",
    },
    stranded_cart_cleaner: {
      name: "Abandoned Cart & Temporary Reservation Cleaner",
      is_enabled: true,
      cron_expression: "0 * * * *",
      frequency: "hourly",
      description: "Releases unconfirmed product reservations and cleans stale checkout sessions.",
    },
  });

  const [deliveryRules, setDeliveryRules] = useState({
    base_delivery_fee: 39.0,
    free_delivery_threshold: 199.0,
    free_delivery_for_subscriptions: true,
    free_delivery_first_order: true,
    surge_fee_enabled: false,
    surge_fee_amount: 0.0,
    taxes_and_handling_fee: 0.0,
    container_deposit_fee: 0.0,
    currency: "INR",
    currency_symbol: "₹",
    display_notes: "Zero delivery fee on all active daily subscriptions. Standard delivery fee applies on single orders below ₹199.",
  });

  const [orderRules, setOrderRules] = useState({
    min_order_subtotal: 40.0,
    max_advance_days: 7,
    auto_pause_subscription_low_balance: true,
    subscription_advance_notice_hours: 12,
    allow_instant_slot_switching: true,
  });

  // ── Load Configurations from Backend ──
  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>("/api/v1/admin/developer/config");
      const root = res?.data || res;
      const configMap = root?.data || root || {};

      if (configMap.slot_timings?.config_data) {
        setSlotTimings((prev) => ({ ...prev, ...configMap.slot_timings.config_data }));
      }
      if (configMap.cron_schedules?.config_data) {
        setCronSchedules((prev) => ({ ...prev, ...configMap.cron_schedules.config_data }));
      }
      if (configMap.delivery_rules?.config_data) {
        setDeliveryRules((prev) => ({ ...prev, ...configMap.delivery_rules.config_data }));
      }
      if (configMap.order_rules?.config_data) {
        setOrderRules((prev) => ({ ...prev, ...configMap.order_rules.config_data }));
      }
      setLastSaved(configMap.slot_timings?.updated_at || new Date().toISOString());
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load system configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // ── Save Current Active Section ──
  const handleSaveSection = async (key: string, data: any, sectionName: string) => {
    try {
      setSaving(true);
      const res = await api.put<any>(`/api/v1/admin/developer/config/${key}`, {
        config_data: data,
      });
      const root = res?.data || res;
      if (root?.status || res?.status) {
        showSuccessToast(`${sectionName} updated successfully`);
        setLastSaved(new Date().toISOString());
      } else {
        showErrorToast(root?.message || "Failed to update configuration");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      await Promise.all([
        api.put("/api/v1/admin/developer/config/slot_timings", { config_data: slotTimings }),
        api.put("/api/v1/admin/developer/config/cron_schedules", { config_data: cronSchedules }),
        api.put("/api/v1/admin/developer/config/delivery_rules", { config_data: deliveryRules }),
        api.put("/api/v1/admin/developer/config/order_rules", { config_data: orderRules }),
      ]);
      showSuccessToast("All system configurations saved successfully");
      setLastSaved(new Date().toISOString());
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to save configurations");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading system configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Breadcrumb & Title ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>Developer</span>
            <span>&rsaquo;</span>
            <span className="text-slate-700 font-bold">Configurations</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="text-emerald-600 w-6 h-6" />
            System Configurations & Operational Rules
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Configure delivery slot cutoffs, automated cron execution times, background workers, delivery charges, and customer ordering limits.
          </p>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchConfigs}
            disabled={saving}
            className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All Configurations
          </button>
        </div>
      </div>

      {/* ── Summary Stat KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">DELIVERY SLOTS</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">2 Slots Active</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Morning & Evening windows</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">AUTOMATED CRONS</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">4 Scheduled</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Runs, generators & sweepers</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">BASE DELIVERY FEE</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">₹{deliveryRules.base_delivery_fee.toFixed(0)}</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Free over ₹{deliveryRules.free_delivery_threshold.toFixed(0)}</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">SUBSCRIPTION WAIVER</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">
              {deliveryRules.free_delivery_for_subscriptions ? "100% Free" : "Standard Fee"}
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Daily milk delivery fee</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("slots")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "slots"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Clock size={15} />
          Slot Cutoffs & Cron Schedules
        </button>

        <button
          onClick={() => setActiveTab("crons")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "crons"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Zap size={15} />
          Background Automated Crons
        </button>

        <button
          onClick={() => setActiveTab("delivery")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "delivery"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Truck size={15} />
          Delivery Charges & Discount Rules
        </button>

        <button
          onClick={() => setActiveTab("ordering")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ordering"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Calendar size={15} />
          Customer Ordering Limits
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: SLOT CUTOFFS & CRON SCHEDULES */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "slots" && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
            <Info className="text-emerald-700 w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold">Automated Order & Run Lifecycle: </span>
              Customers can place or modify orders until the <b>Customer Order Cutoff Time</b>. Immediately after cutoff, the <b>Run Generation Cron</b> executes to cluster stops, balance delivery partner workloads, and generate delivery runs for warehouse dispatch.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Morning Slot Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-slate-100 bg-amber-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Sun size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Morning Delivery Slot</h3>
                      <p className="text-xs text-slate-500">Early morning doorstep milk & fresh deliveries</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slotTimings.morning_slot.is_enabled}
                      onChange={(e) =>
                        setSlotTimings({
                          ...slotTimings,
                          morning_slot: { ...slotTimings.morning_slot, is_enabled: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="p-6 space-y-4">
                  {/* Delivery Window */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Window Start</label>
                      <input
                        type="time"
                        value={slotTimings.morning_slot.delivery_window_start}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            morning_slot: { ...slotTimings.morning_slot, delivery_window_start: e.target.value },
                          })
                        }
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Window End</label>
                      <input
                        type="time"
                        value={slotTimings.morning_slot.delivery_window_end}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            morning_slot: { ...slotTimings.morning_slot, delivery_window_end: e.target.value },
                          })
                        }
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Customer Cutoff Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Customer Order Cutoff Time</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                        Previous Evening
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={slotTimings.morning_slot.customer_cutoff_time}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            morning_slot: { ...slotTimings.morning_slot, customer_cutoff_time: e.target.value },
                          })
                        }
                        className="flex-1 text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                      <select
                        value={slotTimings.morning_slot.customer_cutoff_day_offset}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            morning_slot: { ...slotTimings.morning_slot, customer_cutoff_day_offset: parseInt(e.target.value, 10) },
                          })
                        }
                        className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                      >
                        <option value="-1">Previous Day (D-1)</option>
                        <option value="0">Same Day (D)</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Orders close at this time for next morning deliveries.</p>
                  </div>

                  {/* Cron Execution Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Delivery Run Generation Cron Time</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                        Automated Cron
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={slotTimings.morning_slot.cron_run_time}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            morning_slot: { ...slotTimings.morning_slot, cron_run_time: e.target.value },
                          })
                        }
                        className="flex-1 text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                      <select
                        value={slotTimings.morning_slot.cron_run_day_offset}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            morning_slot: { ...slotTimings.morning_slot, cron_run_day_offset: parseInt(e.target.value, 10) },
                          })
                        }
                        className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                      >
                        <option value="-1">Previous Day (D-1)</option>
                        <option value="0">Same Day (D)</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Cron engine executes route optimization and generates runs at this time.</p>
                  </div>

                  {/* Warehouse Dispatch Start Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Warehouse Dispatch Start Time</label>
                    <input
                      type="time"
                      value={slotTimings.morning_slot.dispatch_start_time}
                      onChange={(e) =>
                        setSlotTimings({
                          ...slotTimings,
                          morning_slot: { ...slotTimings.morning_slot, dispatch_start_time: e.target.value },
                        })
                      }
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Warehouse partners start vehicle loading & verification.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">Morning Schedule</span>
                <button
                  onClick={() => handleSaveSection("slot_timings", slotTimings, "Morning Slot Timings")}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                >
                  Save Morning Slot
                </button>
              </div>
            </div>

            {/* Evening Slot Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-slate-100 bg-indigo-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Moon size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Evening Delivery Slot</h3>
                      <p className="text-xs text-slate-500">Afternoon/evening fresh batch deliveries</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slotTimings.evening_slot.is_enabled}
                      onChange={(e) =>
                        setSlotTimings({
                          ...slotTimings,
                          evening_slot: { ...slotTimings.evening_slot, is_enabled: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="p-6 space-y-4">
                  {/* Delivery Window */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Window Start</label>
                      <input
                        type="time"
                        value={slotTimings.evening_slot.delivery_window_start}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            evening_slot: { ...slotTimings.evening_slot, delivery_window_start: e.target.value },
                          })
                        }
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Window End</label>
                      <input
                        type="time"
                        value={slotTimings.evening_slot.delivery_window_end}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            evening_slot: { ...slotTimings.evening_slot, delivery_window_end: e.target.value },
                          })
                        }
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Customer Cutoff Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Customer Order Cutoff Time</span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                        Same Day Afternoon
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={slotTimings.evening_slot.customer_cutoff_time}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            evening_slot: { ...slotTimings.evening_slot, customer_cutoff_time: e.target.value },
                          })
                        }
                        className="flex-1 text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                      <select
                        value={slotTimings.evening_slot.customer_cutoff_day_offset}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            evening_slot: { ...slotTimings.evening_slot, customer_cutoff_day_offset: parseInt(e.target.value, 10) },
                          })
                        }
                        className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                      >
                        <option value="0">Same Day (D)</option>
                        <option value="-1">Previous Day (D-1)</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Customers can order evening delivery until this cutoff.</p>
                  </div>

                  {/* Cron Execution Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Delivery Run Generation Cron Time</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                        Automated Cron
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={slotTimings.evening_slot.cron_run_time}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            evening_slot: { ...slotTimings.evening_slot, cron_run_time: e.target.value },
                          })
                        }
                        className="flex-1 text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                      <select
                        value={slotTimings.evening_slot.cron_run_day_offset}
                        onChange={(e) =>
                          setSlotTimings({
                            ...slotTimings,
                            evening_slot: { ...slotTimings.evening_slot, cron_run_day_offset: parseInt(e.target.value, 10) },
                          })
                        }
                        className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                      >
                        <option value="0">Same Day (D)</option>
                        <option value="-1">Previous Day (D-1)</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Evening delivery runs and partner route sequences are prepared at this time.</p>
                  </div>

                  {/* Warehouse Dispatch Start Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Warehouse Dispatch Start Time</label>
                    <input
                      type="time"
                      value={slotTimings.evening_slot.dispatch_start_time}
                      onChange={(e) =>
                        setSlotTimings({
                          ...slotTimings,
                          evening_slot: { ...slotTimings.evening_slot, dispatch_start_time: e.target.value },
                        })
                      }
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Warehouse handover & partner vehicle loading window starts.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">Evening Schedule</span>
                <button
                  onClick={() => handleSaveSection("slot_timings", slotTimings, "Evening Slot Timings")}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                >
                  Save Evening Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: BACKGROUND AUTOMATED CRONS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "crons" && (
        <div className="space-y-4">
          {Object.entries(cronSchedules).map(([key, cron]: [string, any]) => (
            <div
              key={key}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">{cron.name}</h3>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        cron.is_enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {cron.is_enabled ? "ACTIVE" : "PAUSED"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{cron.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] font-semibold text-slate-400">
                    <span>
                      Schedule:{" "}
                      <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        {cron.cron_expression || cron.schedule_time || "Configured"}
                      </code>
                    </span>
                    <span>Frequency: {cron.frequency}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cron.is_enabled}
                    onChange={(e) =>
                      setCronSchedules({
                        ...cronSchedules,
                        [key]: { ...cron, is_enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>

                <button
                  onClick={() => handleSaveSection("cron_schedules", cronSchedules, cron.name)}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: DELIVERY CHARGES & DISCOUNT RULES */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "delivery" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Truck className="text-emerald-600 w-4 h-4" />
                Delivery Fee & Threshold Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Base Delivery Fee (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={deliveryRules.base_delivery_fee}
                      onChange={(e) =>
                        setDeliveryRules({
                          ...deliveryRules,
                          base_delivery_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Charged on one-time orders below the free threshold.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Free Delivery Threshold (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={deliveryRules.free_delivery_threshold}
                      onChange={(e) =>
                        setDeliveryRules({
                          ...deliveryRules,
                          free_delivery_threshold: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Orders at or above this value get automatic 100% free delivery.</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Free Delivery for Active Subscriptions</div>
                    <div className="text-[11px] text-slate-500">Waives delivery charges for all scheduled daily milk & subscription items.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={deliveryRules.free_delivery_for_subscriptions}
                    onChange={(e) =>
                      setDeliveryRules({
                        ...deliveryRules,
                        free_delivery_for_subscriptions: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div>
                    <div className="text-xs font-bold text-slate-800">First Order Free Delivery</div>
                    <div className="text-[11px] text-slate-500">Automatically offers ₹0 delivery fee on any new customer's first order.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={deliveryRules.free_delivery_first_order}
                    onChange={(e) =>
                      setDeliveryRules({
                        ...deliveryRules,
                        free_delivery_first_order: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Taxes & Handling Charges (₹)</div>
                    <div className="text-[11px] text-slate-500">Platform packaging or handling surcharge (set 0 for zero charges).</div>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={deliveryRules.taxes_and_handling_fee}
                      onChange={(e) =>
                        setDeliveryRules({
                          ...deliveryRules,
                          taxes_and_handling_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs font-bold px-2 py-1 border border-slate-200 rounded-lg text-right"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Display Policy Notes</label>
                <textarea
                  rows={2}
                  value={deliveryRules.display_notes}
                  onChange={(e) => setDeliveryRules({ ...deliveryRules, display_notes: e.target.value })}
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleSaveSection("delivery_rules", deliveryRules, "Delivery Charges & Rules")}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  <Save size={14} />
                  Save Delivery Rules
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Customer App Checkout Preview</h4>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-2.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Item Total</span>
                  <span className="font-semibold">₹40</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Delivery Fee</span>
                  <span className="font-semibold">₹{deliveryRules.base_delivery_fee.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700">
                  <span>Delivery Discount</span>
                  <span className="font-bold">-₹{deliveryRules.base_delivery_fee.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Taxes & Handling</span>
                  <span className="font-semibold">₹{deliveryRules.taxes_and_handling_fee.toFixed(0)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-extrabold text-slate-900">
                  <span>To Pay</span>
                  <span className="text-emerald-700">₹40</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60 leading-relaxed">
                <span className="font-bold text-emerald-800">Policy active: </span>
                {deliveryRules.display_notes}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: CUSTOMER ORDERING LIMITS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "ordering" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-3xl">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-emerald-600 w-4 h-4" />
            Customer Ordering Horizon & Subscription Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Minimum Order Subtotal (₹)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={orderRules.min_order_subtotal}
                onChange={(e) =>
                  setOrderRules({
                    ...orderRules,
                    min_order_subtotal: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">Minimum cart total required to proceed to checkout.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max Advance Booking Horizon (Days)</label>
              <input
                type="number"
                step="1"
                min="1"
                max="30"
                value={orderRules.max_advance_days}
                onChange={(e) =>
                  setOrderRules({
                    ...orderRules,
                    max_advance_days: parseInt(e.target.value, 10) || 7,
                  })
                }
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">Number of future days customers can select in the date picker.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Subscription Advance Notice (Hours)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={orderRules.subscription_advance_notice_hours}
                onChange={(e) =>
                  setOrderRules({
                    ...orderRules,
                    subscription_advance_notice_hours: parseInt(e.target.value, 10) || 12,
                  })
                }
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">Hours before delivery a customer can pause, skip, or modify schedule.</p>
            </div>

            <div className="flex flex-col justify-center">
              <label className="block text-xs font-bold text-slate-700 mb-2">Auto-pause on Low Wallet Balance</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={orderRules.auto_pause_subscription_low_balance}
                  onChange={(e) =>
                    setOrderRules({
                      ...orderRules,
                      auto_pause_subscription_low_balance: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-semibold text-slate-600">
                  {orderRules.auto_pause_subscription_low_balance ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={() => handleSaveSection("order_rules", orderRules, "Ordering Rules")}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Save size={14} />
              Save Ordering Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
