"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api.client";
import {
  ArrowRightLeft,
  ArrowRight,
  Truck,
  User,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Package,
  ShieldAlert,
  Loader2,
  FileText
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

interface DeliveryOrderSwapModalProps {
  orderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface SourceOrder {
  order_id: string;
  customer_id: string;
  customer_name: string;
  address_id: string;
  address_line: string;
  branch_id: string;
  branch_name: string;
  delivery_slot: string;
  scheduled_date: string;
  status: string;
  delivery_run_id: string;
  delivery_partner_id: string;
  total_amount: number;
  current_partner_name: string;
  current_run_id: string;
  current_run_status: string;
}

interface TargetOrder {
  order_id: string;
  customer_id: string;
  customer_name: string;
  address_id: string;
  address_line: string;
  delivery_slot: string;
  status: string;
  total_amount: number;
  run_sequence: number;
}

interface EligibleRun {
  id: string;
  run_id: string;
  run_date: string;
  delivery_slot: string;
  status: string;
  branch_id: string;
  branch_name: string;
  delivery_partner_id: string;
  partner_name: string;
  partner_phone: string;
  partner_active: boolean;
  partner_available: boolean;
  total_addresses: number;
  current_orders_count: number;
  orders: TargetOrder[];
}

export default function DeliveryOrderSwapModal({
  orderId,
  onClose,
  onSuccess,
}: DeliveryOrderSwapModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sourceOrder, setSourceOrder] = useState<SourceOrder | null>(null);
  const [eligibleRuns, setEligibleRuns] = useState<EligibleRun[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Mode: "move" | "swap"
  const [mode, setMode] = useState<"move" | "swap">("move");

  // Selection
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedTargetOrderId, setSelectedTargetOrderId] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // Confirmation view
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    setLoading(true);
    setFetchError(null);
    setSelectedRunId("");
    setSelectedTargetOrderId("");
    setReason("");
    setConfirmStep(false);

    api
      .get<any>(`/admin/delivery/runs/eligible-targets?order_id=${encodeURIComponent(orderId)}`)
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.status && res.data?.data) {
          setSourceOrder(res.data.data.order);
          setEligibleRuns(res.data.data.eligible_runs || []);
        } else {
          setFetchError(res.data?.message || "Failed to load order and eligible runs");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setFetchError(err?.response?.data?.message || err?.message || "Error fetching swap eligibility");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (!orderId) return null;

  const selectedRun = eligibleRuns.find((r) => r.run_id === selectedRunId);
  const selectedTargetOrder = selectedRun?.orders?.find((o) => o.order_id === selectedTargetOrderId);

  const handleExecute = async () => {
    setSubmitting(true);
    try {
      if (mode === "move") {
        if (!selectedRunId) {
          showErrorToast("Please select a target delivery run");
          setSubmitting(false);
          return;
        }
        const res = await api.post<any>("/admin/delivery/runs/orders/move", {
          order_id: sourceOrder?.order_id,
          target_run_id: selectedRunId,
          reason: reason.trim() || undefined,
        });

        if (res.data?.status) {
          showSuccessToast(res.data.message || "Order moved successfully!");
          onSuccess();
          onClose();
        } else {
          showErrorToast(res.data?.message || "Failed to move order");
        }
      } else {
        // mode === "swap"
        if (!selectedTargetOrderId) {
          showErrorToast("Please select a target order to swap with");
          setSubmitting(false);
          return;
        }
        const res = await api.post<any>("/admin/delivery/runs/orders/swap", {
          order_a_id: sourceOrder?.order_id,
          order_b_id: selectedTargetOrderId,
          reason: reason.trim() || undefined,
        });

        if (res.data?.status) {
          showSuccessToast(res.data.message || "Orders swapped successfully!");
          onSuccess();
          onClose();
        } else {
          showErrorToast(res.data?.message || "Failed to swap orders");
        }
      }
    } catch (err: any) {
      console.error(err);
      showErrorToast(err?.response?.data?.message || err?.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Controlled Address & Order Swap</h3>
              <p className="text-xs text-indigo-200/80">Reassign customer address stop and orders across active delivery runs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Validating run eligibility and locking state...</p>
            </div>
          ) : fetchError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                <ShieldAlert size={18} className="text-rose-600" />
                <span>Cannot Reassign Order</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">{fetchError}</p>
              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : sourceOrder ? (
            <>
              {/* Source Order Info Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Assignment</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase">
                      {sourceOrder.status}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-700 font-mono">
                    #{sourceOrder.order_id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer & Address</p>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <User size={13} className="text-indigo-600 shrink-0" />
                      {sourceOrder.customer_name || "Customer"}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
                      <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{sourceOrder.address_line || "No address line"}</span>
                    </p>
                  </div>

                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l sm:pl-3 border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Run & Partner Details</p>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <Truck size={13} className="text-emerald-600 shrink-0" />
                      {sourceOrder.current_partner_name || "Unassigned Partner"}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="font-mono font-semibold text-indigo-600">{sourceOrder.current_run_id}</span>
                      <span className="capitalize px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-bold text-slate-700">
                        {sourceOrder.delivery_slot}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode Selector */}
              {!confirmStep && (
                <div className="space-y-4">
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("move");
                        setSelectedTargetOrderId("");
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        mode === "move"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <ArrowRight size={14} /> Move to Another Run
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("swap")}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        mode === "swap"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <ArrowRightLeft size={14} /> Swap with Another Order
                    </button>
                  </div>

                  {/* Eligible Target Runs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        {mode === "move" ? "1. Select Target Delivery Run" : "1. Select Target Delivery Run"}
                      </label>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {eligibleRuns.length} run{eligibleRuns.length === 1 ? "" : "s"} available
                      </span>
                    </div>

                    {eligibleRuns.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">No Eligible Target Runs Found</p>
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            There are no other active delivery runs for branch{" "}
                            <span className="font-semibold">{sourceOrder.branch_name || sourceOrder.branch_id}</span> on{" "}
                            <span className="font-semibold">{sourceOrder.scheduled_date}</span> ({sourceOrder.delivery_slot} slot) with available delivery partners.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                        {eligibleRuns.map((run) => {
                          const isSelected = selectedRunId === run.run_id;
                          return (
                            <div
                              key={run.run_id}
                              onClick={() => {
                                setSelectedRunId(run.run_id);
                                setSelectedTargetOrderId("");
                              }}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                                  : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                                    isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <Truck size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-900">{run.partner_name || "Partner"}</span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">{run.run_id}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    {run.total_addresses || 0} stops • {run.current_orders_count || 0} orders
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    run.partner_available
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {run.partner_available ? "Available" : "Busy"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* If Swap Mode, select target order */}
                  {mode === "swap" && selectedRun && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          2. Select Order from {selectedRun.partner_name}'s Run
                        </label>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {selectedRun.orders?.length || 0} eligible orders
                        </span>
                      </div>

                      {(!selectedRun.orders || selectedRun.orders.length === 0) ? (
                        <div className="p-4 rounded-xl bg-slate-50 border text-xs text-slate-500 text-center">
                          No active eligible orders found in this run to swap with.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                          {selectedRun.orders.map((ord) => {
                            const isSelected = selectedTargetOrderId === ord.order_id;
                            return (
                              <div
                                key={ord.order_id}
                                onClick={() => setSelectedTargetOrderId(ord.order_id)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                                    : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/50"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-indigo-700">#{ord.order_id}</span>
                                    <span className="font-bold text-xs text-slate-800">{ord.customer_name}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                                    {ord.address_line}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-black text-slate-900">₹{ord.total_amount}</span>
                                  <p className="text-[10px] text-slate-400">Stop #{ord.run_sequence || 1}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason Input */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText size={13} className="text-slate-400" /> Reason for Change (Optional)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Customer requested early morning delivery or route adjustment"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50/50"
                    />
                  </div>
                </div>
              )}

              {/* Confirmation Preview Step */}
              {confirmStep && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                      <CheckCircle2 size={18} className="text-indigo-600" />
                      <span>Confirm Reassignment Breakdown</span>
                    </div>

                    {mode === "move" ? (
                      <div className="space-y-3 text-xs">
                        <p className="text-slate-600 leading-relaxed">
                          You are moving Order <span className="font-bold font-mono text-slate-900">#{sourceOrder.order_id}</span> from{" "}
                          <span className="font-bold text-slate-900">{sourceOrder.current_partner_name}</span> ({sourceOrder.current_run_id}) to{" "}
                          <span className="font-bold text-indigo-700">{selectedRun?.partner_name}</span> ({selectedRun?.run_id}).
                        </p>
                        <div className="bg-white rounded-xl p-3 border border-indigo-100 space-y-1.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Target Delivery Partner:</span>
                            <span className="font-bold text-slate-800">{selectedRun?.partner_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Target Delivery Run:</span>
                            <span className="font-mono font-bold text-indigo-600">{selectedRun?.run_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Scheduled Date & Slot:</span>
                            <span className="font-bold text-slate-800">{sourceOrder.scheduled_date} ({sourceOrder.delivery_slot})</span>
                          </div>
                          {reason && (
                            <div className="flex justify-between border-t pt-1.5 text-slate-600">
                              <span className="text-slate-400">Reason:</span>
                              <span className="italic">{reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        <p className="text-slate-600 leading-relaxed">
                          The following two orders will be swapped atomically:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Order A</span>
                            <p className="font-mono font-bold text-indigo-700">#{sourceOrder.order_id}</p>
                            <p className="text-slate-800 font-semibold truncate">{sourceOrder.customer_name}</p>
                            <p className="text-slate-500 text-[10px]">&rarr; Moving to {selectedRun?.partner_name}</p>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Order B</span>
                            <p className="font-mono font-bold text-indigo-700">#{selectedTargetOrder?.order_id}</p>
                            <p className="text-slate-800 font-semibold truncate">{selectedTargetOrder?.customer_name}</p>
                            <p className="text-slate-500 text-[10px]">&rarr; Moving to {sourceOrder.current_partner_name}</p>
                          </div>
                        </div>

                        {reason && (
                          <div className="bg-white rounded-xl p-2.5 border border-indigo-100 text-[11px] flex justify-between text-slate-600">
                            <span className="text-slate-400">Reason:</span>
                            <span className="italic">{reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={confirmStep ? () => setConfirmStep(false) : onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {confirmStep ? "Back" : "Cancel"}
          </button>

          {!loading && !fetchError && sourceOrder && (
            <div>
              {!confirmStep ? (
                <button
                  type="button"
                  disabled={
                    eligibleRuns.length === 0 ||
                    !selectedRunId ||
                    (mode === "swap" && !selectedTargetOrderId)
                  }
                  onClick={() => setConfirmStep(true)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <span>Review {mode === "move" ? "Move" : "Swap"}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleExecute}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm & Execute</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
