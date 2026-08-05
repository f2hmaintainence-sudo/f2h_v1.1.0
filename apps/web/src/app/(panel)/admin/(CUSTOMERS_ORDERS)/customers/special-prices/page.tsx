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
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  IndianRupee,
  Layers,
  ChevronDown,
  Check,
  ShoppingBag,
  ArrowRight,
  Sparkles
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

interface ProductItem {
  product_id: string;
  name: string;
  unit_type?: string;
}

interface VariantItem {
  variant_id: string;
  product_id: string;
  name: string;
  price: number;
  original_price: number;
  discount?: number;
}

interface RepeaterItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  actualPrice: number;
  sellingPrice: number;
  discount: string;
  specialPrice: number;
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

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Master Dropdown Data
  const [customers, setCustomers] = useState<OptionCustomer[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<string, VariantItem[]>>({});
  const [fetchingOptions, setFetchingOptions] = useState(false);

  // Form Selections
  const [selectedCustomer, setSelectedCustomer] = useState<OptionCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Repeater Items for the selected customer
  const [repeaterRows, setRepeaterRows] = useState<RepeaterItem[]>([]);

  // Current row draft inputs
  const [draftProductId, setDraftProductId] = useState('');
  const [draftProductSearch, setDraftProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [draftVariantId, setDraftVariantId] = useState('');
  const [draftDiscount, setDraftDiscount] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

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

  const fetchMasterData = async () => {
    setFetchingOptions(true);
    try {
      // Fetch customers
      const custRes = await api.get('/admin/customer/special-prices/options');
      const custBody = custRes.data as any;
      if (custBody?.customers) {
        setCustomers(custBody.customers);
      }

      // Fetch products
      const prodRes = await api.get('/admin/customer/products/list');
      const prodBody = prodRes.data as any;
      if (prodBody?.data) {
        setProducts(prodBody.data);
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
    } finally {
      setFetchingOptions(false);
    }
  };

  const fetchProductVariants = async (productId: string) => {
    if (variantsMap[productId]) return variantsMap[productId];
    try {
      const res = await api.get(`/admin/customer/products/${productId}/variants`);
      const resBody = res.data as any;
      const list: VariantItem[] = (resBody?.data || []).map((v: any) => ({
        variant_id: v.variant_id,
        product_id: v.product_id,
        name: v.name,
        price: Number(v.price || 0),
        original_price: Number(v.original_price || v.price || 0),
        discount: Number(v.discount || 0),
      }));

      setVariantsMap((prev) => ({ ...prev, [productId]: list }));
      return list;
    } catch (err) {
      console.error('Failed to fetch product variants:', err);
      return [];
    }
  };

  const handleOpenModal = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setRepeaterRows([]);
    setDraftProductId('');
    setDraftProductSearch('');
    setDraftVariantId('');
    setDraftDiscount('');
    setFormError('');
    setEditingRuleId(null);
    setShowAddModal(true);
    fetchMasterData();
  };

  const handleEditRule = async (item: SpecialPriceItem) => {
    setFormError('');
    setEditingRuleId(item.id);
    setSelectedCustomer({
      id: item.customer_id,
      name: item.customer_name,
      email: item.customer_email,
      phone: item.customer_phone,
    });
    setRepeaterRows([
      {
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        variantId: item.product_variant_id,
        variantName: item.variant_name,
        actualPrice: item.actual_price,
        sellingPrice: item.selling_price,
        discount: String(item.discount),
        specialPrice: item.special_price,
      },
    ]);
    setShowAddModal(true);
    fetchMasterData();
    if (item.product_id) {
      await fetchProductVariants(item.product_id);
    }
  };

  const handleSelectProduct = async (prod: ProductItem) => {
    setDraftProductId(prod.product_id);
    setDraftProductSearch(prod.name);
    setIsProductDropdownOpen(false);
    setDraftVariantId('');
    await fetchProductVariants(prod.product_id);
  };

  // Add draft variant row to repeater table
  const handleAddVariantRow = () => {
    setFormError('');
    if (!draftProductId) {
      setFormError('Please select a product first.');
      return;
    }
    if (!draftVariantId) {
      setFormError('Please select a product variant.');
      return;
    }

    const availableVariants = variantsMap[draftProductId] || [];
    const variantObj = availableVariants.find((v) => v.variant_id === draftVariantId);
    if (!variantObj) {
      setFormError('Invalid variant selected.');
      return;
    }

    const productObj = products.find((p) => p.product_id === draftProductId);
    const numDisc = parseFloat(draftDiscount) || 0;

    let calcSpecial = variantObj.price;
    if (numDisc > 0 && numDisc <= 100) {
      calcSpecial = Math.max(0, parseFloat((variantObj.price * (1 - numDisc / 100)).toFixed(2)));
    } else if (numDisc > 100) {
      calcSpecial = Math.max(0, parseFloat((variantObj.price - numDisc).toFixed(2)));
    }

    const newRow: RepeaterItem = {
      id: String(Date.now()),
      productId: draftProductId,
      productName: productObj?.name || 'Product',
      variantId: draftVariantId,
      variantName: variantObj.name,
      actualPrice: variantObj.original_price || variantObj.price,
      sellingPrice: variantObj.price,
      discount: draftDiscount,
      specialPrice: calcSpecial,
    };

    // Prevent duplicate variant in repeater
    setRepeaterRows((prev) => {
      const filtered = prev.filter((r) => r.variantId !== draftVariantId);
      return [...filtered, newRow];
    });

    // Reset draft inputs
    setDraftProductId('');
    setDraftProductSearch('');
    setDraftVariantId('');
    setDraftDiscount('');
  };

  const handleRemoveRepeaterRow = (id: string) => {
    setRepeaterRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveAllSpecialPrices = async () => {
    setFormError('');
    if (!selectedCustomer) {
      setFormError('Please select a customer.');
      return;
    }
    if (repeaterRows.length === 0) {
      setFormError('Please add at least one product variant special price rule.');
      return;
    }

    setSaving(true);
    try {
      const payloadItems = repeaterRows.map((r) => ({
        product_variant_id: r.variantId,
        discount: parseFloat(r.discount) || 0,
      }));

      const res = await api.post(`/admin/customer/${selectedCustomer.id}/special-prices`, {
        items: payloadItems,
      });

      const resBody = res.data as any;
      if (resBody?.status) {
        setToastMessage(`Saved ${payloadItems.length} special price rule(s) for ${selectedCustomer.name}`);
        setShowAddModal(false);
        fetchSpecialPrices();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setFormError(resBody?.message || res.error || 'Failed to save special prices');
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save special prices');
    } finally {
      setSaving(false);
    }
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

  // Filtered dropdown lists
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!draftProductSearch) return products.slice(0, 50);
    const q = draftProductSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 50);
  }, [products, draftProductSearch]);

  // Draft variant object for live preview
  const currentAvailableVariants = variantsMap[draftProductId] || [];
  const selectedDraftVariant = currentAvailableVariants.find((v) => v.variant_id === draftVariantId);
  const draftNumDisc = parseFloat(draftDiscount) || 0;
  const draftSelling = selectedDraftVariant ? selectedDraftVariant.price : 0;
  const draftActual = selectedDraftVariant ? (selectedDraftVariant.original_price || selectedDraftVariant.price) : 0;
  
  let draftSpecial = draftSelling;
  if (draftNumDisc > 0 && draftNumDisc <= 100) {
    draftSpecial = Math.max(0, parseFloat((draftSelling * (1 - draftNumDisc / 100)).toFixed(2)));
  } else if (draftNumDisc > 100) {
    draftSpecial = Math.max(0, parseFloat((draftSelling - draftNumDisc).toFixed(2)));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans bg-slate-50/50 min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Matching F2H Light Theme */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              CUSTOMERS & SUBSCRIPTIONS
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" />
            Special Prices
          </h1>
          <p className="text-slate-500 text-sm">
            Configure customer-specific variant pricing, custom negotiated discounts, and live tariff rules.
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
            onClick={handleOpenModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Special Price
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - Light Theme */}
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
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Discount</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{summary.avg_discount}% / ₹</p>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search customer, phone, product or variant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-gray-200 text-slate-800 text-sm pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-emerald-700 font-bold">{items.length}</span> special price rule(s)
        </div>
      </div>

      {/* Main Special Prices Data Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4 font-bold">Customer Details</th>
                <th className="py-3.5 px-4 font-bold">Product & Variant</th>
                <th className="py-3.5 px-4 font-bold text-right">Actual MRP</th>
                <th className="py-3.5 px-4 font-bold text-right">Selling Price</th>
                <th className="py-3.5 px-4 font-bold text-center">Discount Applied</th>
                <th className="py-3.5 px-4 font-bold text-right">Special Price</th>
                <th className="py-3.5 px-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Loading special prices...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No special prices configured yet. Click &quot;Add Special Price&quot; to create rules.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Customer */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{item.customer_name}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                        {item.customer_phone && <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">📞 {item.customer_phone}</span>}
                        {item.customer_email && <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">✉️ {item.customer_email}</span>}
                      </div>
                    </td>

                    {/* Product & Variant */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{item.product_name}</div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                        <Package className="w-3 h-3" />
                        {item.variant_name}
                      </div>
                    </td>

                    {/* Actual MRP */}
                    <td className="py-4 px-4 text-right font-medium text-slate-400 line-through">
                      ₹{item.actual_price.toFixed(2)}
                    </td>

                    {/* Selling Price */}
                    <td className="py-4 px-4 text-right font-semibold text-slate-800">
                      ₹{item.selling_price.toFixed(2)}
                    </td>

                    {/* Discount Applied */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                        {item.discount > 0 && item.discount <= 100
                          ? `${item.discount}% OFF`
                          : `- ₹${item.discount}`}
                      </span>
                    </td>

                    {/* Special Price */}
                    <td className="py-4 px-4 text-right">
                      <div className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <span className="text-base font-extrabold text-emerald-700">
                          ₹{item.special_price.toFixed(2)}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditRule(item)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Special Prices Modal with Searchable Dropdowns & Repeater Summary */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  {editingRuleId ? 'Edit Customer Special Price' : 'Configure Customer Special Prices'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select customer, pick products and variants, apply custom discounts, and review summary table.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* STEP 1: Searchable Customer Dropdown */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Customer *
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="w-full bg-white border border-gray-300 text-slate-800 text-sm p-3 rounded-xl flex items-center justify-between shadow-2xs hover:border-emerald-500 transition"
                >
                  {selectedCustomer ? (
                    <span className="font-semibold text-emerald-800">
                      👤 {selectedCustomer.name} {selectedCustomer.phone ? `(${selectedCustomer.phone})` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">Search & select customer...</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-2 space-y-2 max-h-60 overflow-y-auto">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search name, email, phone..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 text-xs pl-9 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="divide-y divide-gray-100">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">No matching customers</div>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-900 transition ${
                              selectedCustomer?.id === cust.id ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-semibold">{cust.name}</div>
                              <div className="text-[11px] text-slate-400">
                                {cust.phone} {cust.email ? `· ${cust.email}` : ''}
                              </div>
                            </div>
                            {selectedCustomer?.id === cust.id && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: Product & Variant Picker + Live Calculation */}
            {selectedCustomer && (
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-4">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Add Product Variant & Discount Rule
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Searchable Product Dropdown */}
                  <div className="relative">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Product</label>
                    <button
                      type="button"
                      onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                      className="w-full bg-white border border-gray-300 text-slate-800 text-xs p-2.5 rounded-xl flex items-center justify-between hover:border-emerald-500 transition"
                    >
                      <span className="truncate">{draftProductSearch || 'Select Product...'}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    {isProductDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-2 space-y-2 max-h-56 overflow-y-auto">
                        <input
                          type="text"
                          placeholder="Search product..."
                          value={draftProductSearch}
                          onChange={(e) => setDraftProductSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 text-xs p-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                        <div className="divide-y divide-gray-100">
                          {filteredProducts.map((p) => (
                            <div
                              key={p.product_id}
                              onClick={() => handleSelectProduct(p)}
                              className={`p-2 text-xs rounded cursor-pointer hover:bg-emerald-50 hover:text-emerald-800 transition ${
                                draftProductId === p.product_id ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-slate-700'
                              }`}
                            >
                              {p.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dynamically Loaded Product Variant Dropdown */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Variant</label>
                    <select
                      disabled={!draftProductId}
                      value={draftVariantId}
                      onChange={(e) => setDraftVariantId(e.target.value)}
                      className="w-full bg-white border border-gray-300 text-slate-800 text-xs p-2.5 rounded-xl focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {!draftProductId ? '-- Select product first --' : '-- Select Variant --'}
                      </option>
                      {currentAvailableVariants.map((v) => (
                        <option key={v.variant_id} value={v.variant_id}>
                          {v.name} (Selling: ₹{v.price})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discount Value */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Discount (% or ₹)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 10 or 5"
                        value={draftDiscount}
                        onChange={(e) => setDraftDiscount(e.target.value)}
                        className="w-full bg-white border border-gray-300 text-slate-800 text-xs p-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddVariantRow}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-2.5 rounded-xl transition flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Tariff Preview Card */}
                {selectedDraftVariant && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Actual MRP:</span>
                      <div className="font-semibold text-slate-400 line-through">₹{draftActual.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Selling Price:</span>
                      <div className="font-bold text-slate-800">₹{draftSelling.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Discount:</span>
                      <div className="font-bold text-amber-600">
                        {draftNumDisc > 0 && draftNumDisc <= 100 ? `${draftNumDisc}% OFF` : `- ₹${draftNumDisc.toFixed(2)}`}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold text-emerald-800">Special Price:</span>
                      <div className="font-black text-base text-emerald-700">₹{draftSpecial.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Summary Table Below inside Modal */}
            {selectedCustomer && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Special Price Summary Table for {selectedCustomer.name} ({repeaterRows.length})
                  </h3>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Variant</th>
                        <th className="py-2.5 px-3 text-right">Actual MRP</th>
                        <th className="py-2.5 px-3 text-right">Selling Price</th>
                        <th className="py-2.5 px-3 text-center">Discount</th>
                        <th className="py-2.5 px-3 text-right">Special Selling Price</th>
                        <th className="py-2.5 px-3 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-slate-700">
                      {repeaterRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            No variant rules added yet. Select a product and variant above and click &quot;Add&quot;.
                          </td>
                        </tr>
                      ) : (
                        repeaterRows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{row.productName}</td>
                            <td className="py-2.5 px-3">{row.variantName}</td>
                            <td className="py-2.5 px-3 text-right text-slate-400 line-through">
                              ₹{row.actualPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium">
                              ₹{row.sellingPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-amber-600">
                              {parseFloat(row.discount) > 0 && parseFloat(row.discount) <= 100
                                ? `${row.discount}% OFF`
                                : `- ₹${parseFloat(row.discount || '0').toFixed(2)}`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              ₹{row.specialPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRepeaterRow(row.id)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAllSpecialPrices}
                disabled={saving || !selectedCustomer || repeaterRows.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-sm flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Save All Special Prices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
