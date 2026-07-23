import React from "react";
import { FileText, Eye, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface BillingTableProps {
  bills: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: React.Dispatch<React.SetStateAction<number>>;
  totalCount: number;
  onInspect: (bill: any) => void;
  isPostpaid: boolean;
  title: string;
  getStatusBadge: (status: string, dueDate: string) => React.ReactNode;
  formatMoney: (v: number) => string;
  fmtDate: (d?: string, year?: boolean) => string;
  statusFilter: string;
  searchQuery: string;
}

export const BillingTable: React.FC<BillingTableProps> = ({
  bills,
  loading,
  page,
  totalPages,
  onPageChange,
  totalCount,
  onInspect,
  isPostpaid,
  title,
  getStatusBadge,
  formatMoney,
  fmtDate,
  statusFilter,
  searchQuery,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <span className="font-bold text-slate-800 text-base">{title}</span>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {totalCount} Total
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
          <p className="text-sm font-bold text-slate-500">Loading bills...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="py-16 text-center px-4 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <FileText size={24} />
          </div>
          <p className="text-base font-bold text-slate-800">No Bills Found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter !== "ALL" || searchQuery
              ? "No bills match your current filter or search criteria."
              : isPostpaid
              ? "Click 'Generate Postpaid Bill' above to create your first invoice for delivered orders."
              : "Prepaid customer bills will be listed here once generated."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Bill # & Period</th>
                <th className="py-3.5 px-4">Customer Details</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Delivered Orders</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Paid / Balance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.map((bill) => {
                const balance = Number(bill.balanceAmount ?? (bill.totalAmount - bill.paidAmount));
                return (
                  <tr key={bill.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs block w-fit">
                        #{bill.billNumber}
                      </span>
                      <span className="text-xs text-slate-500 font-medium block mt-1">
                        {fmtDate(bill.billingPeriod?.start || bill.createdAt, false)} – {fmtDate(bill.billingPeriod?.end || bill.createdAt)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-900">{bill.customerName || "Customer"}</p>
                      <span className="text-xs font-semibold text-slate-400">ID: {bill.customerId}</span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-xs text-slate-700">{fmtDate(bill.dueDate)}</td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => onInspect(bill)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                      >
                        <Eye size={13} className="text-slate-500" />
                        <span>{bill.orderCount || 0} Orders</span>
                      </button>
                    </td>
                    <td className="py-4 px-4 font-black text-slate-900 text-base">{formatMoney(bill.totalAmount)}</td>
                    <td className="py-4 px-4 text-xs space-y-0.5">
                      <div className="text-emerald-600 font-bold">Paid: {formatMoney(bill.paidAmount)}</div>
                      <div className="text-amber-700 font-bold">Due: {formatMoney(balance)}</div>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(bill.status, bill.dueDate)}</td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => onInspect(bill)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        title="Inspect Delivered Orders"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Simple Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 font-bold"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 font-bold"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
