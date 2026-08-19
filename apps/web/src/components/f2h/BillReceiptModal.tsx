"use client";

import React, { useEffect, useState, useRef } from "react";
import { api } from "@/services/api.client";
import {
  FileText, Printer, Download, X, CheckCircle2, Clock, AlertTriangle,
  Building2, Phone, Mail, MapPin, Calendar, CreditCard, ShoppingBag,
  Loader2, Copy, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BillReceiptModalProps {
  billId: string | null;
  onClose: () => void;
}

function formatMoney(v: number) {
  return "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function BillReceiptModal({ billId, onClose }: BillReceiptModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!billId) return;
    setLoading(true);
    api.get<any>(`/admin/finance/receipt/${billId}`)
      .then((res) => {
        if (res.data?.status && res.data?.data) {
          setData(res.data.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load bill receipt:", err);
      })
      .finally(() => setLoading(false));
  }, [billId]);

  if (!billId) return null;

  const bill = data?.bill;
  const items: any[] = Array.isArray(data?.items) ? data.items : [];

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!bill) return;
    const text = `F2H Fresh Tax Invoice\nBill #: ${bill.bill_number || bill.bill_id}\nCustomer: ${bill.customer_name} (${bill.customer_phone})\nTotal: ${formatMoney(bill.total_amount)}\nPaid: ${formatMoney(bill.paid_amount)}\nDue: ${formatMoney(bill.due_amount)}\nStatus: ${bill.status?.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPaid = (bill?.status || "").toLowerCase() === "paid";
  const isOverdue = (bill?.status || "").toLowerCase() === "overdue" || (bill?.due_date && new Date(bill.due_date) < new Date() && !isPaid);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
        
        {/* Print-specific style override */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px;
              border: none !important;
              box-shadow: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none"
        >
          {/* Top Control Bar (Hidden in Print) */}
          <div className="no-print p-4 sm:px-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <FileText size={16} className="text-[#16a34a]" />
              <span>Official Tax Invoice Receipt #{billId}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                title="Copy Summary"
              >
                {copied ? <Check size={13} className="text-[#16a34a]" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Printer size={14} />
                <span>Print / Download PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Receipt Body */}
          <div className="overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 font-sans print:p-4" id="printable-receipt" ref={printRef}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={36} className="text-[#16a34a] animate-spin mb-3" />
                <p className="text-xs font-bold text-slate-500">Generating receipt details...</p>
              </div>
            ) : !bill ? (
              <div className="text-center py-16 text-slate-400 font-medium text-xs">
                Unable to find invoice receipt for ID #{billId}.
              </div>
            ) : (
              <>
                {/* Header: Company & Invoice Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                        F2H
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">F2H FRESH (Farm to Home)</h2>
                        <p className="text-[11px] text-slate-500 font-medium">Daily Farm Fresh Supply &amp; Subscriptions</p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-600 space-y-0.5 font-medium">
                      <p className="flex items-center gap-1"><Building2 size={12} className="text-slate-400" /> Branch: <strong>{bill.branch_name || 'Main Regional Hub'}</strong></p>
                      {bill.branch_address && <p className="text-[11px] text-slate-500 pl-4">{bill.branch_address}</p>}
                      <p className="flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {bill.branch_phone || '+91 98765 43210'}</p>
                      <p className="flex items-center gap-1"><Mail size={12} className="text-slate-400" /> support@f2hfresh.com</p>
                    </div>
                  </div>

                  <div className="sm:text-right space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border mb-1">
                      {isPaid ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={13} /> TAX INVOICE • PAID
                        </span>
                      ) : isOverdue ? (
                        <span className="text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                          <AlertTriangle size={13} /> INVOICE • OVERDUE
                        </span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                          <Clock size={13} /> BILL • PENDING DUE
                        </span>
                      )}
                    </div>

                    <p className="text-lg font-black text-slate-900 font-mono">
                      #{bill.bill_number || bill.bill_id}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Date: <strong>{fmtDateTime(bill.created_at)}</strong>
                    </p>
                    {bill.due_date && (
                      <p className="text-[11px] text-slate-500 font-medium">
                        Due Date: <strong className={isOverdue ? "text-rose-600" : ""}>{fmtDate(bill.due_date)}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Billed To / Customer & Payment Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      BILLED CUSTOMER
                    </span>
                    <p className="font-extrabold text-slate-900 text-sm">{bill.customer_name}</p>
                    <p className="text-slate-600 mt-0.5 font-medium">Phone: <strong>{bill.customer_phone}</strong></p>
                    {bill.customer_email && <p className="text-slate-600 font-medium">Email: {bill.customer_email}</p>}
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: #{bill.customer_id}</p>
                    {bill.customer_address && (
                      <p className="text-[11px] text-slate-600 mt-1 flex items-start gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>{bill.customer_address}</span>
                      </p>
                    )}
                  </div>

                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      BILLING &amp; PAYMENT INFO
                    </span>
                    <div className="space-y-1 text-slate-700">
                      <p>Bill Nature: <strong className="capitalize text-purple-700 font-bold">{bill.bill_type || 'Standard'}</strong></p>
                      <p>Payment Mode: <strong className="uppercase font-bold text-slate-800">{bill.payment_method || 'Online / Gateway'}</strong></p>
                      {bill.period_start && (
                        <p className="text-[11px] text-slate-500">
                          Period: {fmtDate(bill.period_start)} to {fmtDate(bill.period_end)}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        Status: <strong className="capitalize text-slate-800">{bill.status}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={14} className="text-[#16a34a]" /> Order &amp; Delivery Breakdown
                  </h4>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-2.5 text-center w-12">#</th>
                          <th className="px-4 py-2.5">Item Description</th>
                          <th className="px-4 py-2.5 text-center">Ref / Date</th>
                          <th className="px-4 py-2.5 text-right">Qty</th>
                          <th className="px-4 py-2.5 text-right">Unit Rate</th>
                          <th className="px-4 py-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="px-4 py-2.5">
                              <strong className="text-slate-900 font-bold block">{item.item_name || 'Produce Item'}</strong>
                              {item.variant_name && <span className="text-[10px] text-slate-500 font-semibold">{item.variant_name}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                              {item.scheduled_date ? fmtDate(item.scheduled_date) : item.reference_id ? `#${item.reference_id}` : "—"}
                              {item.delivery_slot && <span className="block text-[10px] text-slate-400 capitalize">{item.delivery_slot}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                              {Number(item.quantity || 1)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-slate-600">
                              {formatMoney(Number(item.unit_price || item.total_amount || 0))}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                              {formatMoney(Number(item.total_amount || 0))}
                            </td>
                          </tr>
                        ))}

                        {items.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-medium">
                              Order Delivery Package — {formatMoney(Number(bill.total_amount))}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary & Balance Due */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                  <div className="text-[11px] text-slate-400 max-w-xs space-y-1">
                    <p className="font-bold text-slate-600 uppercase text-[10px] tracking-wider">Payment Instructions</p>
                    <p>Payments can be made via UPI, Bank Transfer, or Online Razorpay Gateway through the customer mobile application.</p>
                    <p className="italic text-[10px] pt-1 text-slate-400">This is a computer-generated tax receipt and requires no physical signature.</p>
                  </div>

                  <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-bold text-slate-800">{formatMoney(Number(bill.subtotal || bill.total_amount))}</span>
                    </div>

                    {Number(bill.discount_amount || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Special Discount:</span>
                        <span className="font-bold">-{formatMoney(Number(bill.discount_amount))}</span>
                      </div>
                    )}

                    {Number(bill.tax_amount || 0) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>GST / Taxes:</span>
                        <span className="font-bold">{formatMoney(Number(bill.tax_amount))}</span>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                      <span>Total Billed:</span>
                      <span className="text-slate-900">{formatMoney(Number(bill.total_amount))}</span>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                      <span>Paid Amount:</span>
                      <span>{formatMoney(Number(bill.paid_amount))}</span>
                    </div>

                    {Number(bill.due_amount || 0) > 0 && (
                      <div className="flex justify-between text-xs font-black text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-100">
                        <span>Balance Due:</span>
                        <span>{formatMoney(Number(bill.due_amount))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Stamp */}
                <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
                  <p>F2H Fresh E-Commerce Technologies • Thank you for choosing fresh!</p>
                  <p className="font-mono">Generated: {new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
