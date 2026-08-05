'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Tag,
  Users,
  Percent,
  TrendingDown,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Package,
  IndianRupee,
  Sliders,
  DollarSign
} from 'lucide-react';
import { api } from '@/services/api.client';

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

interface OptionCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface OptionVariant {
  id: string;
  product_name: string;
  variant_name: string;
  full_name: string;
  selling_price: number;
  actual_price: number;
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
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<{ customers: OptionCustomer[]; variants: OptionVariant[] }>({
    customers: [],
    variants: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Add/Edit Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSpecialPrices();
  }, [search]);

  const fetchSpecialPrices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/customer/special-prices/table');
      const resBody = res.data as any;
      if (resBody?.status || resBody?.data) {
        setItems(resBody.data || []);
        if (resBody.summary) {
          setSummary(resBody.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch special prices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    setOptionsLoading(true);
    try {
      const res = await api.get('/admin/customer/special-prices/options');
      const resBody = res.data as any;
      if (resBody?.status) {
        setOptions({
          customers: resBody.customers || [],
          variants: resBody.variants || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch dropdown options:', err);
    } finally {
      setOptionsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedCustomerId('');
    setSelectedVariantId('');
    setDiscountValue('');
    setFormError('');
    setShowAddModal(true);
    fetchOptions();
  };

  const handleSaveSpecialPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!selectedCustomerId) {
      setFormError('Please select a customer');
      return;
    }
    if (!selectedVariantId) {
      setFormError('Please select a product variant');
      return;
    }
    const numDiscount = parseFloat(discountValue);
    if (isNaN(numDiscount) || numDiscount < 0) {
      setFormError('Please enter a valid discount amount or percentage');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/admin/customer/special-prices', {
        customer_id: selectedCustomerId,
        product_variant_id: selectedVariantId,
        discount: numDiscount,
      });

      const resBody = res.data as any;
      if (resBody?.status) {
        setToastMessage('Special price saved successfully!');
        setShowAddModal(false);
        fetchSpecialPrices();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setFormError(resBody?.message || res.error || 'Failed to save special price');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save special price';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this special price rule?')) return;
    try {
      const res = await api.delete(`/admin/customer/special-prices/${id}`);
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


  // Live calculation for modal preview
  const selectedVariant = options.variants.find((v) => v.id === selectedVariantId);
  const calcActualPrice = selectedVariant ? Number(selectedVariant.actual_price || selectedVariant.selling_price) : 0;
  const calcSellingPrice = selectedVariant ? Number(selectedVariant.selling_price) : 0;
  const numDiscount = parseFloat(discountValue) || 0;
  
  let calcSpecialPrice = calcSellingPrice;
  if (numDiscount > 0 && numDiscount <= 100) {
    calcSpecialPrice = Math.max(0, parseFloat((calcSellingPrice * (1 - numDiscount / 100)).toFixed(2)));
  } else if (numDiscount > 100) {
    calcSpecialPrice = Math.max(0, parseFloat((calcSellingPrice - numDiscount).toFixed(2)));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-900 border border-emerald-600 text-emerald-100 px-4 py-3 rounded-xl shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-2xl border border-emerald-800/40 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Pricing Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-400" />
            Customer Special Prices
          </h1>
          <p className="text-slate-400 text-sm">
            Manage custom negotiated prices, discounts, and customer-specific product variant tariffs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSpecialPrices}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700/60"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/50 transition border border-emerald-400/20"
          >
            <Plus className="w-4 h-4" />
            Add Special Price
          </button>
        </div>
      </div>

      {/* Stats Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Special Price Rules</p>
            <p className="text-2xl font-bold text-white mt-0.5">{summary.total_rules}</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Customers with Special Pricing</p>
            <p className="text-2xl font-bold text-white mt-0.5">{summary.unique_customers}</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Average Discount Value</p>
            <p className="text-2xl font-bold text-white mt-0.5">{summary.avg_discount}% / ₹</p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search customer, phone, product or variant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-emerald-400 font-semibold">{items.length}</span> active rule(s)
        </div>
      </div>

      {/* Main Special Prices Data Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Customer</th>
                <th className="py-3.5 px-4 font-semibold">Product & Variant</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actual Price (MRP)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Selling Price</th>
                <th className="py-3.5 px-4 font-semibold text-center">Discount Applied</th>
                <th className="py-3.5 px-4 font-semibold text-right">Special Price</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                    Loading special prices table...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Tag className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    No special prices configured yet. Click &quot;Add Special Price&quot; to get started.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Customer */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{item.customer_name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {item.customer_phone && <span>📞 {item.customer_phone}</span>}
                        {item.customer_email && <span>✉️ {item.customer_email}</span>}
                      </div>
                    </td>

                    {/* Product & Variant */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-200">{item.product_name}</div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 mt-1">
                        <Package className="w-3 h-3" />
                        {item.variant_name}
                      </div>
                    </td>

                    {/* Actual Price (MRP) */}
                    <td className="py-4 px-4 text-right font-medium text-slate-400 line-through">
                      ₹{item.actual_price.toFixed(2)}
                    </td>

                    {/* Selling Price */}
                    <td className="py-4 px-4 text-right font-semibold text-slate-200">
                      ₹{item.selling_price.toFixed(2)}
                    </td>

                    {/* Discount Applied */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {item.discount > 0 && item.discount <= 100
                          ? `${item.discount}% OFF`
                          : `- ₹${item.discount}`}
                      </span>
                    </td>

                    {/* Special Price */}
                    <td className="py-4 px-4 text-right">
                      <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <span className="text-base font-extrabold text-emerald-400">
                          ₹{item.special_price.toFixed(2)}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleDeleteRule(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Special Price Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                Configure Special Price Rule
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/60 text-red-200 text-xs p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSpecialPrice} className="space-y-4">
              {/* Select Customer */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Customer *
                </label>
                {optionsLoading ? (
                  <div className="text-xs text-slate-500 py-2">Loading customers...</div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm p-3 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Customer --</option>
                    {options.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Product Variant */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Product Variant *
                </label>
                {optionsLoading ? (
                  <div className="text-xs text-slate-500 py-2">Loading variants...</div>
                ) : (
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm p-3 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Variant --</option>
                    {options.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name} — Standard Price: ₹{v.selling_price}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Discount Amount or Percentage */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Discount Value (% or Flat ₹ Amount) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10 for 10% or 5 for flat ₹5 off"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm p-3 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter 1-100 for percentage (e.g. 10 = 10% off), or &gt;100 for fixed rupees off.
                </p>
              </div>

              {/* Live Calculation Preview Card */}
              {selectedVariant && (
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/60 pb-1.5 flex items-center justify-between">
                    <span>Live Tariff Preview</span>
                    <span className="text-emerald-400 text-[11px] font-normal">Calculated Automatically</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Actual MRP:</span>
                      <div className="font-medium text-slate-400 line-through">₹{calcActualPrice.toFixed(2)}</div>
                    </div>

                    <div>
                      <span className="text-slate-500">Standard Selling Price:</span>
                      <div className="font-semibold text-slate-300">₹{calcSellingPrice.toFixed(2)}</div>
                    </div>

                    <div>
                      <span className="text-slate-500">Discount Applied:</span>
                      <div className="font-semibold text-amber-400">
                        {numDiscount > 0 && numDiscount <= 100
                          ? `${numDiscount}% OFF`
                          : `- ₹${numDiscount.toFixed(2)}`}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold text-emerald-400">Customer Special Price:</span>
                      <div className="text-base font-extrabold text-emerald-400">
                        ₹{calcSpecialPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-emerald-950/40 flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Special Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
