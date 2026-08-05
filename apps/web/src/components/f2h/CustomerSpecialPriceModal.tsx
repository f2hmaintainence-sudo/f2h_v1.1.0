'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Tag,
  ChevronDown,
  Check,
  Package,
  Layers,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { api } from '@/services/api.client';

export interface OptionCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface ProductItem {
  product_id: string;
  name: string;
  unit_type?: string;
}

export interface VariantItem {
  variant_id: string;
  product_id: string;
  name: string;
  price: number;
  original_price: number;
  discount?: number;
}

export interface RepeaterItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  actualPrice: number;
  sellingPrice: number;
  specialDiscountInput: string;
  specialPrice: number;
  overallDiscountPercent: number;
}

interface CustomerSpecialPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialCustomer?: OptionCustomer | null;
  editingRule?: any;
}

export default function CustomerSpecialPriceModal({
  isOpen,
  onClose,
  onSaved,
  initialCustomer = null,
  editingRule = null,
}: CustomerSpecialPriceModalProps) {
  const [saving, setSaving] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(false);
  const [formError, setFormError] = useState('');

  // Master Lists
  const [customers, setCustomers] = useState<OptionCustomer[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<string, VariantItem[]>>({});

  // Customer Selection
  const [selectedCustomer, setSelectedCustomer] = useState<OptionCustomer | null>(initialCustomer);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Repeater Items for the customer
  const [repeaterRows, setRepeaterRows] = useState<RepeaterItem[]>([]);

  // Draft inputs for active row
  const [draftProductId, setDraftProductId] = useState('');
  const [draftProductSearch, setDraftProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [draftVariantId, setDraftVariantId] = useState('');
  const [draftSpecialDiscount, setDraftSpecialDiscount] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setSelectedCustomer(initialCustomer || null);
      setCustomerSearch('');
      setRepeaterRows([]);
      setDraftProductId('');
      setDraftProductSearch('');
      setDraftVariantId('');
      setDraftSpecialDiscount('');

      if (editingRule) {
        setSelectedCustomer({
          id: editingRule.customer_id,
          name: editingRule.customer_name || 'Customer',
          email: editingRule.customer_email || '',
          phone: editingRule.customer_phone || '',
        });
        const actual = Number(editingRule.actual_price || editingRule.selling_price || 0);
        const selling = Number(editingRule.selling_price || 0);
        const special = Number(editingRule.special_price || 0);
        const overallPct = actual > 0 ? parseFloat((((actual - special) / actual) * 100).toFixed(1)) : 0;

        setRepeaterRows([
          {
            id: editingRule.id || String(Date.now()),
            productId: editingRule.product_id,
            productName: editingRule.product_name,
            variantId: editingRule.product_variant_id,
            variantName: editingRule.variant_name,
            actualPrice: actual,
            sellingPrice: selling,
            specialDiscountInput: String(editingRule.discount || '0'),
            specialPrice: special,
            overallDiscountPercent: Math.max(0, overallPct),
          },
        ]);
      }

      fetchMasterOptions();
    }
  }, [isOpen, initialCustomer, editingRule]);

  const fetchMasterOptions = async () => {
    setFetchingOptions(true);
    try {
      if (!initialCustomer) {
        const custRes = await api.get('/admin/customer/special-prices/options');
        const custBody = custRes.data as any;
        if (custBody?.customers) {
          setCustomers(custBody.customers);
        }
      }

      const prodRes = await api.get('/admin/customer/products/list');
      const prodBody = prodRes.data as any;
      if (prodBody?.data) {
        setProducts(prodBody.data);
      }
    } catch (err) {
      console.error('Failed to load modal master options:', err);
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
      console.error('Failed to fetch variants:', err);
      return [];
    }
  };

  const handleSelectProduct = async (prod: ProductItem) => {
    setDraftProductId(prod.product_id);
    setDraftProductSearch(prod.name);
    setIsProductDropdownOpen(false);
    setDraftVariantId('');
    await fetchProductVariants(prod.product_id);
  };

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
    const numDisc = parseFloat(draftSpecialDiscount) || 0;

    const actual = variantObj.original_price || variantObj.price;
    const selling = variantObj.price;

    let calcSpecial = selling;
    if (numDisc > 0 && numDisc <= 100) {
      calcSpecial = Math.max(0, parseFloat((selling * (1 - numDisc / 100)).toFixed(2)));
    } else if (numDisc > 100) {
      calcSpecial = Math.max(0, parseFloat((selling - numDisc).toFixed(2)));
    }

    const overallPct = actual > 0 ? parseFloat((((actual - calcSpecial) / actual) * 100).toFixed(1)) : 0;

    const newRow: RepeaterItem = {
      id: String(Date.now()),
      productId: draftProductId,
      productName: productObj?.name || 'Product',
      variantId: draftVariantId,
      variantName: variantObj.name,
      actualPrice: actual,
      sellingPrice: selling,
      specialDiscountInput: draftSpecialDiscount,
      specialPrice: calcSpecial,
      overallDiscountPercent: Math.max(0, overallPct),
    };

    setRepeaterRows((prev) => {
      const filtered = prev.filter((r) => r.variantId !== draftVariantId);
      return [...filtered, newRow];
    });

    setDraftProductId('');
    setDraftProductSearch('');
    setDraftVariantId('');
    setDraftSpecialDiscount('');
  };

  const handleRemoveRow = (id: string) => {
    setRepeaterRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveAll = async () => {
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
        discount: parseFloat(r.specialDiscountInput) || 0,
      }));

      const res = await api.post(`/admin/customer/${selectedCustomer.id}/special-prices`, {
        items: payloadItems,
      });

      const resBody = res.data as any;
      if (resBody?.status) {
        onSaved();
        onClose();
      } else {
        setFormError(resBody?.message || res.error || 'Failed to save special prices');
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save special prices');
    } finally {
      setSaving(false);
    }
  };

  // Filtered customer list (ONLY CUSTOMER role users)
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

  // Draft calculations
  const currentAvailableVariants = variantsMap[draftProductId] || [];
  const selectedDraftVariant = currentAvailableVariants.find((v) => v.variant_id === draftVariantId);
  const draftNumDisc = parseFloat(draftSpecialDiscount) || 0;
  const draftSelling = selectedDraftVariant ? selectedDraftVariant.price : 0;
  const draftActual = selectedDraftVariant ? (selectedDraftVariant.original_price || selectedDraftVariant.price) : 0;

  let draftSpecial = draftSelling;
  if (draftNumDisc > 0 && draftNumDisc <= 100) {
    draftSpecial = Math.max(0, parseFloat((draftSelling * (1 - draftNumDisc / 100)).toFixed(2)));
  } else if (draftNumDisc > 100) {
    draftSpecial = Math.max(0, parseFloat((draftSelling - draftNumDisc).toFixed(2)));
  }
  const draftOverallPct = draftActual > 0 ? parseFloat((((draftActual - draftSpecial) / draftActual) * 100).toFixed(1)) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" />
              Configure Customer Special Prices
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Apply customer-specific negotiated discounts. Stored as special discount on selling price.
            </p>
          </div>
          <button
            onClick={onClose}
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

        {/* STEP 1: Customer Info / Selection */}
        {initialCustomer ? (
          /* Pre-selected Customer Header in Portfolio */
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-sm shadow-2xs">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Configuring Special Prices For</p>
                <p className="text-sm font-black text-slate-900">{selectedCustomer?.name}</p>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  {selectedCustomer?.phone && <span>📞 {selectedCustomer.phone}</span>}
                  {selectedCustomer?.email && <span>✉️ {selectedCustomer.email}</span>}
                  <span>· ID: #{selectedCustomer?.id}</span>
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-white text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 shadow-2xs">
              CUSTOMER PORTFOLIO
            </span>
          </div>
        ) : (
          /* Searchable Customer Selection Dropdown (Only CUSTOMER role) */
          <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Select Customer * <span className="text-[11px] font-normal text-slate-400">(Customer role users only)</span>
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
                      placeholder="Search customer name, email, phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 text-xs pl-9 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="divide-y divide-gray-100">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">No matching customer role users</div>
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
        )}

        {/* STEP 2: Product & Variant Picker + Live Pricing Calculator */}
        {selectedCustomer && (
          <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {initialCustomer ? '1.' : '2.'} Add Product Variant & Special Discount
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Searchable Product Input */}
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

              {/* Dynamic Product Variant Selection */}
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

              {/* Special Discount Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Special Discount (% or ₹)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10 or 5"
                    value={draftSpecialDiscount}
                    onChange={(e) => setDraftSpecialDiscount(e.target.value)}
                    className="w-full bg-white border border-gray-300 text-slate-800 text-xs p-2.5 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
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

            {/* Live Pricing Breakdown Card */}
            {selectedDraftVariant && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Actual MRP:</span>
                  <div className="font-bold text-slate-400 line-through">₹{draftActual.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Standard Selling:</span>
                  <div className="font-bold text-slate-800">₹{draftSelling.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Special Discount:</span>
                  <div className="font-bold text-amber-600">
                    {draftNumDisc > 0 && draftNumDisc <= 100 ? `${draftNumDisc}% OFF` : `- ₹${draftNumDisc.toFixed(2)}`}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Overall Savings:</span>
                  <div className="font-bold text-purple-700">{draftOverallPct}% OFF MRP</div>
                </div>
                <div>
                  <span className="text-slate-600 font-bold">Special Price:</span>
                  <div className="font-black text-base text-emerald-700">₹{draftSpecial.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Summary Table Below inside Modal */}
        {selectedCustomer && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Special Price Summary Table for {selectedCustomer.name} ({repeaterRows.length})
            </h3>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3 text-right">Actual MRP</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-3 text-center">Special Discount</th>
                    <th className="py-2.5 px-3 text-center">Overall Discount</th>
                    <th className="py-2.5 px-3 text-right">Special Selling Price</th>
                    <th className="py-2.5 px-3 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-slate-700">
                  {repeaterRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
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
                          {parseFloat(row.specialDiscountInput) > 0 && parseFloat(row.specialDiscountInput) <= 100
                            ? `${row.specialDiscountInput}% OFF`
                            : `- ₹${parseFloat(row.specialDiscountInput || '0').toFixed(2)}`}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                          {row.overallDiscountPercent}% OFF
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          ₹{row.specialPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
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
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !selectedCustomer || repeaterRows.length === 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-sm flex items-center gap-2"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            Save All Special Prices
          </button>
        </div>
      </div>
    </div>
  );
}
