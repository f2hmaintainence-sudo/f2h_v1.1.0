'use client';

import {
  ChevronRight,
  Home,
} from 'lucide-react';
import Link from 'next/link';
import TableComponents from '@/components/Table Generator/TableComponents';

const API = '/admin/customer';

export default function PostpaidCustomersPage() {
  return (
    <div className="space-y-3 p-1 md:p-2 font-sans min-h-screen">
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Customer</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">Postpaid Customers</span>
        </nav>
      </div>
      <TableComponents
        title="Postpaid Customers Management"
        apiBase={API}
        endpoints={{
          table: `${API}/postpaid/table`,
        }}
        actionTypes={['view', 'edit', 'delete']}
      />
    </div>
  );
}
