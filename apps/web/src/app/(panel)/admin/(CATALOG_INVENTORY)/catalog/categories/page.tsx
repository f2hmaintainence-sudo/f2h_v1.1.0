'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Home,
  Plus,
  Box,
  Layers,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import TableComponents from '@/components/Table Generator/TableComponents';
import { api } from '@/services/api.client';

const API_CATEGORIES = '/admin/catalog/categories';

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<'categories' | 'containers'>('categories');

  // Containers state
  const [containers, setContainers] = useState<any[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<any | null>(null);

  // Form state
  const [containerId, setContainerId] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [isReturnable, setIsReturnable] = useState(true);
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchContainers = async () => {
    setLoadingContainers(true);
    try {
      const res = await api.get('/admin/catalog/containers', {
        params: { search: searchQuery },
      });
      if (res.data) {
        const payload = (res.data as any).data || res.data;
        setContainers(payload || []);
      }
    } catch (err) {
      console.error('Failed to fetch containers:', err);
    } finally {
      setLoadingContainers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'containers') {
      fetchContainers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery]);

  const handleAddCategory = () => {
    window.dispatchEvent(new CustomEvent('table:add'));
  };

  const openAddContainerModal = () => {
    setEditingContainer(null);
    setContainerId(`CONT-${Math.floor(1000 + Math.random() * 9000)}`);
    setName('');
    setQuantity('100');
    setIsReturnable(true);
    setStatus('active');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditContainerModal = (container: any) => {
    setEditingContainer(container);
    setContainerId(container.container_id);
    setName(container.name);
    setQuantity(String(container.quantity || 0));
    setIsReturnable(container.is_returnable ?? true);
    setStatus(container.status || 'active');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim() || !quantity) {
      setFormError('Container name and valid quantity are required');
      return;
    }

    setSaving(true);
    try {
      if (editingContainer) {
        await api.put(`/admin/catalog/containers/${editingContainer.id || editingContainer.container_id}`, {
          name,
          quantity: Number(quantity),
          is_returnable: isReturnable,
          status,
        });
        showToast('Container updated successfully!', true);
      } else {
        await api.post('/admin/catalog/containers', {
          container_id: containerId,
          name,
          quantity: Number(quantity),
          is_returnable: isReturnable,
          status,
        });
        showToast('Container created successfully!', true);
      }
      setIsModalOpen(false);
      fetchContainers();
    } catch (err: any) {
      console.error('Failed to save container:', err);
      const errMsg = err.response?.data?.message || 'Failed to save container';
      setFormError(errMsg);
      showToast(errMsg, false);
    } finally {
      setSaving(false);
    }
  };

  // Client-side instant filter fallback for high responsiveness
  const filteredContainers = containers.filter((item: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.container_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 p-2 md:p-4 font-sans min-h-screen">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <nav
          className="flex items-center gap-1.5 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
          >
            <Home size={14} />Dashboard
          </Link>

          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-gray-400">Catalog</span>

          <ChevronRight size={14} className="text-gray-300" />
          <span className="font-semibold text-deep-green capitalize">
            {activeTab}
          </span>
        </nav>

        {activeTab === 'categories' ? (
          <button
            type="button"
            onClick={handleAddCategory}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-fresh-green text-white text-sm font-bold rounded-xl shadow-md shadow-fresh-green/20 hover:bg-deep-green transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Category
          </button>
        ) : (
          <button
            type="button"
            onClick={openAddContainerModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all cursor-pointer"
          >
            <Box size={16} /> Add Container
          </button>
        )}
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 rounded-t-2xl">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'border-fresh-green text-fresh-green bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers size={16} /> Categories
        </button>

        <button
          onClick={() => setActiveTab('containers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'containers'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Box size={16} /> Containers Master
        </button>
      </div>

      {/* Tab 1: Categories View */}
      {activeTab === 'categories' && (
        <TableComponents
          title="Categories"
          apiBase={API_CATEGORIES}
          identifierKey="id"
          actionTypes={['view', 'edit', 'delete']}
        />
      )}

      {/* Tab 2: Containers Master View */}
      {activeTab === 'containers' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
          
          {/* Containers Search & Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="relative max-w-sm w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search container by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={fetchContainers}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 border border-gray-200 text-xs font-bold text-emerald-800 rounded-xl hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={loadingContainers ? 'animate-spin text-emerald-600' : ''} /> Refresh List
            </button>
          </div>

          {/* Containers Data Table */}
          {loadingContainers ? (
            <div className="py-12 flex justify-center items-center">
              <div className="animate-spin w-7 h-7 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredContainers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">
              <Box size={40} className="mx-auto mb-2 text-gray-300" />
              {searchQuery ? `No containers match "${searchQuery}"` : 'No container records found. Click "+ Add Container" to create one.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-emerald-50/50 text-emerald-950 uppercase font-extrabold tracking-wider border-b border-emerald-100">
                  <tr>
                    <th className="px-4 py-3.5">Container ID</th>
                    <th className="px-4 py-3.5">Name</th>
                    <th className="px-4 py-3.5 text-right">Warehouse Stock Qty</th>
                    <th className="px-4 py-3.5 text-center">Returnable</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredContainers.map((item: any) => (
                    <tr key={item.id || item.container_id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-800">{item.container_id}</td>
                      <td className="px-4 py-3.5 font-bold text-gray-900 text-sm">{item.name}</td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900 text-sm">
                        {Number(item.quantity || 0).toLocaleString()} units
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          item.is_returnable !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.is_returnable !== false ? <><CheckCircle size={12} /> Yes</> : <><XCircle size={12} /> Disposable</>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {item.status || 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => openEditContainerModal(item)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Container"
                        >
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Container Drawer / Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveContainer}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Box size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingContainer ? 'Edit Container' : 'Add New Container'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Container ID
              </label>
              <input
                type="text"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                disabled={Boolean(editingContainer)}
                placeholder="e.g. CONT-001"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Container Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Glass Bottle 1L, Plastic Bucket 5L"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Warehouse Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Total warehouse stock quantity"
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Returnable Container</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReturnable}
                  onChange={(e) => setIsReturnable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-bold text-slate-700">Status Active</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingContainer ? 'Update Container' : 'Create Container'}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all animate-bounce ${
            toast.ok
              ? 'bg-emerald-900 border-emerald-700 text-emerald-100 shadow-emerald-900/30'
              : 'bg-rose-900 border-rose-700 text-rose-100 shadow-rose-900/30'
          }`}
        >
          {toast.ok ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}