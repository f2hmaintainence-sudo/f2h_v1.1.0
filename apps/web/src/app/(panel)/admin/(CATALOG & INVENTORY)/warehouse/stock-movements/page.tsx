'use client';
import { useState, useEffect } from 'react';
import {
  ChevronRight,
  Home,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import TableComponents from '@/components/Table Generator/TableComponents';
import { api } from '@/services/api.client';

const API = '/admin/warehouses/stock-movements';

export default function WarehouseStockPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  useEffect(() => {
    api.get<any>('/admin/warehouses/active/list')
      .then(res => {
        if (res.data?.data) {
          setWarehouses(res.data.data);
        }
      })
      .catch(() => { });
  }, []);

  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent('table:add'));
  };

  return (
    <div className="space-y-3 p-1 md:p-2 font-sans min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Catalog & Inventory</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Warehouse</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green">Stock Movements</span>
        </nav>

        <button type="button" onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-fresh-green text-white text-sm font-bold rounded-xl shadow-md shadow-fresh-green/20 hover:bg-deep-green transition-all"
        >
          <Plus size={16} />
          Add Stock Movement
        </button>
      </div>

      {/* Warehouse Filter */}
      {warehouses.length > 0 && (
        <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          <button
            onClick={() => setSelectedWarehouse("")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${selectedWarehouse === "" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
          >
            All Warehouses
          </button>
          {warehouses.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWarehouse(w.warehouse_id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${selectedWarehouse === w.warehouse_id ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}
      {/* <TableComponents
        title=""
        endpoints={{
          table: selectedWarehouse ? `${API}/table?warehouse_id=${selectedWarehouse}` : `${API}/table`
        }}
        actionTypes={['view', 'edit',]}
      /> */}

      <TableComponents
        title=""
        endpoints={{
          table: selectedWarehouse ? `${API}/table?warehouse_id=${selectedWarehouse}` : `${API}/table`,
          showAdd: `${API}/showAdd`,
          saveAdd: `${API}/saveAdd`,
          showEdit: (id: string) => `${API}/${id}/showEdit`,
          saveEdit: (id: string) => `${API}/${id}/saveEdit`,
          view: (id: string) => `${API}/${id}/view`,
        }}
        identifierKey="id"
        enableCardView={false}
        actionTypes={['view', 'edit',]}
      />
    </div>
  );
}
