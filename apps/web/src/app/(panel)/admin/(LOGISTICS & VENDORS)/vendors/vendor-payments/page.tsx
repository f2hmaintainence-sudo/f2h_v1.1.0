"use client";

import React from "react";
import { CreditCard, AlertCircle } from "lucide-react";

export default function VendorPaymentsPage() {
  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <CreditCard size={28} />
      </div>
      <div className="text-center space-y-1.5">
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Vendor Payments</h1>
        <p className="text-xs text-slate-400 font-medium max-w-sm">
          This section is currently under development. Here you will be able to manage all vendor payouts, transaction logs, and ledger settlements.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/60 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
        <AlertCircle size={12} />
        <span>Modules in Queue</span>
      </div>
    </div>
  );
}
