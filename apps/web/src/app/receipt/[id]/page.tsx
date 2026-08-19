"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/services/api.client";
import {
  FileText, Printer, Download, CheckCircle2, Clock, AlertTriangle,
  Building2, Phone, Mail, MapPin, Calendar, ShoppingBag,
  Loader2, Copy, Check, ArrowLeft, Share2, HelpCircle
} from "lucide-react";
import Link from "next/link";

function formatMoney(v: number) {
  return "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function StandaloneReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id as string;
  const autoPrint = searchParams?.get("print") === "true" || searchParams?.get("download") === "true";

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!rawId) return;
    setLoading(true);
    setErrorMsg(null);

    // Call API (works from /bills/receipt/:id, /customer/bills/:id/receipt, or /admin/finance/receipt/:id)
    api.get<any>(`/admin/finance/receipt/${rawId}`)
      .catch(() => api.get<any>(`/bills/receipt/${rawId}`))
      .then((res) => {
        if (res.data?.status && res.data?.data) {
          setData(res.data.data);
          if (autoPrint) {
            setTimeout(() => {
              window.print();
            }, 600);
          }
        } else {
          setErrorMsg("Bill receipt not found or invalid ID.");
        }
      })
      .catch((err) => {
        console.error("Failed to load receipt:", err);
        setErrorMsg("Failed to retrieve bill receipt details.");
      })
      .finally(() => setLoading(false));
  }, [rawId, autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bill = data?.bill;
  const items: any[] = Array.isArray(data?.items) ? data.items : [];

  const isPaid = (bill?.status || "").toLowerCase() === "paid";
  const isOverdue = (bill?.status || "").toLowerCase() === "overdue" || (bill?.due_date && new Date(bill.due_date) < new Date() && !isPaid);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans py-4 sm:py-8 px-3 sm:px-6 print:bg-white print:p-0 print:m-0">
      
      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
          #standalone-receipt {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Action Header for Web & Customer App View (Hidden in Print) */}
      <div className="max-w-3xl mx-auto mb-4 no-print flex items-center justify-between gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            F2H
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-900 leading-tight">Tax Invoice &amp; Payment Receipt</h1>
            <p className="text-[10px] text-slate-400 font-medium">#{rawId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            title="Copy Public Link"
          >
            {copied ? <Check size={13} className="text-[#16a34a]" /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer size={13} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Receipt Card */}
      <div
        id="standalone-receipt"
        className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-6 sm:p-10 space-y-6"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 size={40} className="text-[#16a34a] animate-spin mb-3" />
            <p className="text-xs font-bold text-slate-500">Retrieving official bill receipt #{rawId}...</p>
          </div>
        ) : errorMsg || !bill ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Receipt Not Available</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {errorMsg || `Unable to find the subscription invoice receipt for #${rawId}. Please check the bill number or contact customer care.`}
            </p>
          </div>
        ) : (
          <>
            {/* Header: Company & Badges */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#16a34a] text-white flex items-center justify-center font-black text-xl shadow-xs">
                    F2H
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">F2H FRESH</h2>
                    <p className="text-xs text-slate-500 font-semibold">Farm to Home Fresh E-Commerce Technologies</p>
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-600 space-y-1 font-medium">
                  <p className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Building2 size={13} className="text-[#16a34a]" /> Branch: {bill.branch_name || 'Main Regional Hub'}
                  </p>
                  {bill.branch_address && (
                    <p className="text-[11px] text-slate-500 pl-4">{bill.branch_address}</p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" /> Support: {bill.branch_phone || '+91 98765 43210'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" /> support@f2hfresh.com
                  </p>
                </div>
              </div>

              <div className="sm:text-right space-y-1.5">
                <div className="inline-flex items-center gap-1.5">
                  {isPaid ? (
                    <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs font-black border border-emerald-200 flex items-center gap-1 uppercase tracking-wider">
                      <CheckCircle2 size={14} /> TAX INVOICE • PAID
                    </span>
                  ) : isOverdue ? (
                    <span className="text-rose-700 bg-rose-50 px-3 py-1 rounded-full text-xs font-black border border-rose-200 flex items-center gap-1 uppercase tracking-wider">
                      <AlertTriangle size={14} /> INVOICE • OVERDUE
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-3 py-1 rounded-full text-xs font-black border border-amber-200 flex items-center gap-1 uppercase tracking-wider">
                      <Clock size={14} /> BILL • PENDING
                    </span>
                  )}
                </div>

                <p className="text-xl font-black text-slate-900 font-mono tracking-tight pt-1">
                  #{bill.bill_number || bill.bill_id}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  Bill Date: <strong>{fmtDateTime(bill.created_at)}</strong>
                </p>
                {bill.due_date && (
                  <p className="text-xs text-slate-500 font-medium">
                    Payment Due: <strong className={isOverdue ? "text-rose-600" : "text-slate-800"}>{fmtDate(bill.due_date)}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Billed To / Customer & Payment Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  BILLED CUSTOMER
                </span>
                <p className="font-black text-slate-900 text-sm">{bill.customer_name}</p>
                <p className="text-slate-700 mt-1 font-semibold">Phone: <strong>{bill.customer_phone}</strong></p>
                {bill.customer_email && <p className="text-slate-600 font-medium">Email: {bill.customer_email}</p>}
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">Customer ID: #{bill.customer_id}</p>
                {bill.customer_address && (
                  <p className="text-[11px] text-slate-600 mt-1.5 flex items-start gap-1">
                    <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{bill.customer_address}</span>
                  </p>
                )}
              </div>

              <div className="sm:border-l sm:border-slate-200 sm:pl-5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  BILLING NATURE &amp; MODE
                </span>
                <p className="text-slate-700">
                  Bill Nature: <strong className="capitalize text-purple-700 font-bold">{bill.bill_type || 'Subscription'}</strong>
                </p>
                <p className="text-slate-700">
                  Payment Mode: <strong className="uppercase font-bold text-slate-900">{bill.payment_method || 'Online Gateway'}</strong>
                </p>
                {bill.period_start && (
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    Cycle: <strong>{fmtDate(bill.period_start)}</strong> to <strong>{fmtDate(bill.period_end)}</strong>
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Account Status: <strong className="capitalize text-slate-800">{bill.status}</strong>
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-[#16a34a]" /> Itemized Subscription &amp; Deliveries
              </h4>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-center w-12">#</th>
                      <th className="px-4 py-3">Item Description</th>
                      <th className="px-4 py-3 text-center">Ref / Delivery</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Unit Rate</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <strong className="text-slate-900 font-bold block">{item.item_name || 'Produce Item'}</strong>
                          {item.variant_name && <span className="text-[11px] text-slate-500 font-semibold">{item.variant_name}</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">
                          {item.scheduled_date ? fmtDate(item.scheduled_date) : item.reference_id ? `#${item.reference_id}` : "—"}
                          {item.delivery_slot && <span className="block text-[10px] text-slate-400 capitalize">{item.delivery_slot}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {Number(item.quantity || 1)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-600">
                          {formatMoney(Number(item.unit_price || item.total_amount || 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatMoney(Number(item.total_amount || 0))}
                        </td>
                      </tr>
                    ))}

                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-medium">
                          Subscription Supply Package — {formatMoney(Number(bill.total_amount))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Balance Due */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              <div className="text-[11px] text-slate-500 max-w-xs space-y-1.5">
                <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Payment Instructions</p>
                <p>You can settle outstanding subscription balances directly inside the F2H Fresh Customer App using UPI, NetBanking, or Wallet.</p>
                <p className="italic text-[10px] text-slate-400">This is a computer-generated tax invoice. No signature required.</p>
              </div>

              <div className="w-full sm:w-80 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Amount:</span>
                  <span className="font-bold text-slate-800">{formatMoney(Number(bill.subtotal || bill.total_amount))}</span>
                </div>

                {Number(bill.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount Savings:</span>
                    <span>-{formatMoney(Number(bill.discount_amount))}</span>
                  </div>
                )}

                {Number(bill.tax_amount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST &amp; Taxes:</span>
                    <span className="font-bold">{formatMoney(Number(bill.tax_amount))}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-2.5 flex justify-between text-base font-black text-slate-900">
                  <span>Total Billed:</span>
                  <span className="text-slate-900">{formatMoney(Number(bill.total_amount))}</span>
                </div>

                <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  <span>Paid Amount:</span>
                  <span>{formatMoney(Number(bill.paid_amount))}</span>
                </div>

                {Number(bill.due_amount || 0) > 0 && (
                  <div className="flex justify-between text-xs font-black text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                    <span>Outstanding Due:</span>
                    <span>{formatMoney(Number(bill.due_amount))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
              <p>F2H Fresh Customer Care • support@f2hfresh.com</p>
              <p className="font-mono text-[11px]">Invoice Generated: {new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
