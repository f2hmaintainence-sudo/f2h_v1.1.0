'use client';

import {
  ChevronRight,
  Home,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import TableComponents from '@/components/Table Generator/TableComponents';

const API = '/admin/production/batches';

export default function ProductionBatchesPage() {
  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent('table:add'));
  };

  return (
    <div className="space-y-3 p-1 md:p-2 font-sans min-h-screen">
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >Dashboard
            <Home size={14} />
          </Link>

          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Production</span>

          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">
           Batch
          </span>
        </nav>
        <button type="button" onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-fresh-green text-white text-sm font-bold rounded-xl shadow-md shadow-fresh-green/20 hover:bg-deep-green transition-all"
        >
          <Plus size={16} />
          Add Batch
        </button>
      </div>

      <TableComponents
        title="Production Batches"
        apiBase={API}
        identifierKey="id"
        actionTypes={['view', 'edit', 'delete']}
      />
    </div>
  );
}