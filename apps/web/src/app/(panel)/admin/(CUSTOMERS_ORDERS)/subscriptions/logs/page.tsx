'use client';

import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import TableComponents from '@/components/Table Generator/TableComponents';

const API = '/subscriptions/logs';

export default function ExecutionLogsPage() {
  return (
    <div className="space-y-4 p-2 md:p-4 font-sans min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <Link
            href="/admin/subscriptions/generate-orders"
            className="hover:text-emerald-600 transition-colors font-medium text-slate-600"
          >
            Subscriptions
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-bold text-emerald-700">Logs</span>
        </nav>

        <Link
          href="/admin/subscriptions/generate-orders"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-xs w-fit cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Subscriptions
        </Link>
      </div>

      <TableComponents
        title="Subscriptions Logs"
        apiBase={API}
        actionTypes={['view']}
      />
    </div>
  );
}
