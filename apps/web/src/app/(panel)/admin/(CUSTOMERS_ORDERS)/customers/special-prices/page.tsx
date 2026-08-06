'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Tag,
  Users,
  TrendingDown,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Layers,
  Filter
} from 'lucide-react';
import { api } from '@/services/api.client';
import CustomerSpecialPriceModal, { OptionCustomer } from '@/components/f2h/CustomerSpecialPriceModal';

interface SpecialPriceItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  product_id: string;
  product_name: string;
  product_variant_id: string;
  variant_name: string;
  actual_price: number;
  selling_price: number;
  discount: number;
  special_price: number;
  created_at: string;
  updated_at: string;
}

interface SummaryStats {
  total_rules: number;
  unique_customers: number;
  avg_discount: string;
}

interface CustomerGroup {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  rules: SpecialPriceItem[];
}

export default function CustomerSpecialPricesPage() {
  const [items, setItems] = useState<SpecialPriceItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    total_rules: 0,
    unique_customers: 0,
    avg_discount: '0',
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination & Display settings
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Accordion collapsed state for customer rows (all open by default)
  const [collapsedCustomerIds, setCollapsedCustomerIds] = useState<Set<string>>(new Set());

  // Modal Control
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalCustomer, setModalCustomer] = useState<OptionCustomer | null>(null);
  const [editingRule, setEditingRule] = useState<SpecialPriceItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSpecialPrices();
  }, [search]);

  const fetchSpecialPrices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/customer/special-prices/table', {
        params: { search },
      });
      const resBody = res.data as any;
      if (resBody?.status || resBody?.data) {
        setItems(resBody.data || []);
        if (resBody.summary) {
          setSummary(resBody.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch special prices table:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGlobalModal = () => {
    setModalCustomer(null);
    setEditingRule(null);
    setShowAddModal(true);
  };

  const handleOpenCustomerModal = (e: React.MouseEvent, group: CustomerGroup) => {
    e.stopPropagation();
    setModalCustomer({
      id: group.customer_id,
      name: group.customer_name,
      email: group.customer_email,
      phone: group.customer_phone,
    });
    setEditingRule(null);
    setShowAddModal(true);
  };

  const handleEditRule = (item: SpecialPriceItem) => {
    setModalCustomer({
      id: item.customer_id,
      name: item.customer_name,
      email: item.customer_email,
      phone: item.customer_phone,
    });
    setEditingRule(item);
    setShowAddModal(true);
  };

  const handleDeleteRule = async (item: SpecialPriceItem) => {
    if (!confirm(`Delete special price for ${item.customer_name} on ${item.product_name} (${item.variant_name})?`)) return;
    try {
      const res = await api.delete(`/admin/customer/${item.customer_id}/special-prices/${item.product_variant_id}`);
      const resBody = res.data as any;
      if (resBody?.status) {
        setToastMessage('Special price rule deleted');
        fetchSpecialPrices();
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      alert('Failed to delete special price rule');
    }
  };

  const toggleCustomerExpand = (customerId: string) => {
    setCollapsedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  // Group Special Price items by Customer
  const customerGroups = useMemo(() => {
    const map = new Map<string, CustomerGroup>();

    items.forEach((item) => {
      if (!map.has(item.customer_id)) {
        map.set(item.customer_id, {
          customer_id: item.customer_id,
          customer_name: item.customer_name || 'Customer',
          customer_email: item.customer_email || '',
          customer_phone: item.customer_phone || '',
          rules: [],
        });
      }
      map.get(item.customer_id)!.rules.push(item);
    });

    return Array.from(map.values());
  }, [items]);

  // Paginated Customer Groups
  const totalPages = Math.max(1, Math.ceil(customerGroups.length / pageSize));
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return customerGroups.slice(start, start + pageSize);
  }, [customerGroups, currentPage, pageSize]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans bg-slate-50/50 min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              CUSTOMERS & SUBSCRIPTIONS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" />
            Customer Special Prices
          </h1>
          <p className="text-slate-500 text-sm">
            Row-grouped master pricing rules with collapsible customer accordions and live pagination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSpecialPrices}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenGlobalModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Special Price
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Rules</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{summary.total_rules}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unique Customers</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{summary.unique_customers}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Special Discount</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{summary.avg_discount}%</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search customer, phone, product or variant..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-gray-200 text-slate-800 text-sm pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-gray-200 font-bold text-slate-800 rounded-lg p-1 text-xs focus:outline-none"
            >
              <option value={5}>5 Customers</option>
              <option value={10}>10 Customers</option>
              <option value={20}>20 Customers</option>
            </select>
          </div>

          <div>
            Showing <span className="text-emerald-700 font-bold">{customerGroups.length}</span> customer(s)
          </div>
        </div>
      </div>

      {/* Single Master Unified Table with Row Grouping */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 border-collapse">
            <thead className="bg-slate-100/80 text-slate-500 text-xs uppercase tracking-wider border-b border-gray-200 font-bold">
              <tr>
                <th className="py-3.5 px-4">Customer / Product & Variant</th>
                <th className="py-3.5 px-4 text-right">Actual Price</th>
                <th className="py-3.5 px-4 text-right">Standard Selling</th>
                <th className="py-3.5 px-4 text-center">Overall Savings</th>
                <th className="py-3.5 px-4 text-center">Special Discount (%)</th>
                <th className="py-3.5 px-4 text-right">Special Price</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Loading special prices master table...
                  </td>
                </tr>
              ) : customerGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No special prices configured yet. Click &quot;Add Special Price&quot; to create rules.
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((group) => {
                  const isCollapsed = collapsedCustomerIds.has(group.customer_id);
                  const ruleCount = group.rules.length;

                  return (
                    <React.Fragment key={group.customer_id}>
                      {/* Customer Row Group Header */}
                      <tr
                        onClick={() => toggleCustomerExpand(group.customer_id)}
                        className="bg-slate-50/90 font-bold border-t border-b border-slate-200 hover:bg-emerald-50/40 cursor-pointer transition-colors"
                      >
                        <td colSpan={5} className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-emerald-700 p-0.5 rounded transition"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-emerald-700" />
                              )}
                            </button>

                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200 shrink-0">
                              <UserCheck className="w-4 h-4" />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">{group.customer_name}</span>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200">
                                  {ruleCount} Rule{ruleCount > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 font-normal flex items-center gap-2 mt-0.5">
                                {group.customer_phone && <span>📞 {group.customer_phone}</span>}
                                {group.customer_email && <span>✉️ {group.customer_email}</span>}
                                <span>· ID: #{group.customer_id}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td colSpan={2} className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => handleOpenCustomerModal(e, group)}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Rule
                          </button>
                        </td>
                      </tr>

                      {/* Nested Product Variant Rows */}
                      {!isCollapsed &&
                        group.rules.map((rule) => {
                          const actual = rule.actual_price || rule.selling_price;
                          const overallPct = actual > 0 ? (((actual - rule.special_price) / actual) * 100).toFixed(1) : '0';

                          return (
                            <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors bg-white">
                              {/* Indented Product Variant Name */}
                              <td className="py-3 px-4 pl-12">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                  <span className="font-semibold text-slate-900">{rule.product_name}</span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Package className="w-3 h-3" />
                                    {rule.variant_name}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right font-medium text-slate-400 line-through">
                                ₹{rule.actual_price.toFixed(2)}
                              </td>

                              <td className="py-3 px-4 text-right font-semibold text-slate-800">
                                ₹{rule.selling_price.toFixed(2)}
                              </td>

                              <td className="py-3 px-4 text-center font-bold text-purple-700">
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-100 text-xs">
                                  {overallPct}% OFF
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                                  {rule.discount}% OFF
                                </span>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <span className="text-sm font-extrabold text-emerald-700 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                                  ₹{rule.special_price.toFixed(2)}
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleEditRule(rule)}
                                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                    title="Edit Rule"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Delete Rule"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Clean Pagination Bar */}
      {totalPages > 0 && (
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Showing Page <span className="font-bold text-slate-900">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-900">{totalPages}</span> ({customerGroups.length} total customers, {items.length} total rules)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl transition border border-slate-200 flex items-center gap-1 text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition border ${
                  currentPage === pg
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-gray-200 hover:bg-slate-50'
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl transition border border-slate-200 flex items-center gap-1 text-xs font-semibold"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Customer Special Price Modal Component */}
      <CustomerSpecialPriceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          setToastMessage('Special price rules saved successfully!');
          fetchSpecialPrices();
          setTimeout(() => setToastMessage(null), 4000);
        }}
        initialCustomer={modalCustomer}
        editingRule={editingRule}
      />
    </div>
  );
}
