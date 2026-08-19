'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  UserCheck,
  IndianRupee,
  Sparkles,
  Info,
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
  subscription_price: number;
  discount?: number;
}

export interface RepeaterItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  originalPrice: number;
  sellingPrice: number;
  subscriptionPrice: number;
  // What the admin enters
  finalSubscriptionPriceInput: string;
  // Derived display values (computed from finalSubscriptionPriceInput)
  finalSubscriptionPrice: number;
  specialDiscountPct: number;      // ((sub - final) / sub) * 100
  overallSavingsPct: number;       // ((original - final) / original) * 100
}

interface CustomerSpecialPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialCustomer?: OptionCustomer | null;
  editingRule?: any;
}

// ─────────────────────────────────────────────────────────
// Pure computation helpers (frontend only — for preview)
// The backend will always re-derive discount_percentage.
// ─────────────────────────────────────────────────────────

function clampFinalPrice(finalPrice: number, subscriptionPrice: number): number {
  if (finalPrice < 0) return 0;
  if (subscriptionPrice > 0 && finalPrice > subscriptionPrice) return subscriptionPrice;
  return finalPrice;
}

function computeRowValues(
  originalPrice: number,
  subscriptionPrice: number,
  finalPriceInput: string,
) {
  const rawFinal = parseFloat(finalPriceInput);
  const finalPrice = isNaN(rawFinal) ? subscriptionPrice : clampFinalPrice(rawFinal, subscriptionPrice);

  const specialDiscountPct = subscriptionPrice > 0
    ? parseFloat((((subscriptionPrice - finalPrice) / subscriptionPrice) * 100).toFixed(2))
    : 0;
  const overallSavingsPct = originalPrice > 0
    ? parseFloat((((originalPrice - finalPrice) / originalPrice) * 100).toFixed(2))
    : 0;

  return {
    finalSubscriptionPrice: finalPrice,
    specialDiscountPct: Math.max(0, specialDiscountPct),
    overallSavingsPct: Math.max(0, overallSavingsPct),
  };
}

// ─────────────────────────────────────────────────────────

export default function CustomerSpecialPriceModal({
  isOpen,
  onClose,
  onSaved,
  initialCustomer = null,
  editingRule = null,
}: CustomerSpecialPriceModalProps) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Master Lists
  const [customers, setCustomers] = useState<OptionCustomer[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<string, VariantItem[]>>({});

  // Customer Selection
  const [selectedCustomer, setSelectedCustomer] = useState<OptionCustomer | null>(initialCustomer);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Repeater Items for the customer
  const [repeaterRows, setRepeaterRows] = useState<RepeaterItem[]>([]);

  // Draft inputs for active row
  const [draftProductId, setDraftProductId] = useState('');
  const [draftProductSearch, setDraftProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [draftVariantId, setDraftVariantId] = useState('');
  const [draftFinalPriceInput, setDraftFinalPriceInput] = useState('');

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setSelectedCustomer(initialCustomer || null);
      setCustomerSearch('');
      setRepeaterRows([]);
      setDraftProductId('');
      setDraftProductSearch('');
      setDraftVariantId('');
      setDraftFinalPriceInput('');

      if (editingRule) {
        setSelectedCustomer({
          id: editingRule.customer_id,
          name: editingRule.customer_name || 'Customer',
          email: editingRule.customer_email || '',
          phone: editingRule.customer_phone || '',
        });
        const originalPrice = Number(editingRule.original_price || editingRule.actual_price || 0);
        const sellingPrice = Number(editingRule.selling_price || 0);
        const subscriptionPrice = Number(editingRule.subscription_price || sellingPrice);
        const finalSubPrice = Number(editingRule.final_subscription_price || subscriptionPrice);

        const { specialDiscountPct, overallSavingsPct } = computeRowValues(
          originalPrice, subscriptionPrice, String(finalSubPrice),
        );

        setRepeaterRows([
          {
            id: editingRule.id || String(Date.now()),
            productId: editingRule.product_id,
            productName: editingRule.product_name,
            variantId: editingRule.product_variant_id,
            variantName: editingRule.variant_name,
            originalPrice,
            sellingPrice,
            subscriptionPrice,
            finalSubscriptionPriceInput: String(finalSubPrice),
            finalSubscriptionPrice: finalSubPrice,
            specialDiscountPct,
            overallSavingsPct,
          },
        ]);
      }

      fetchMasterOptions();
    }
  }, [isOpen, initialCustomer, editingRule]);

  const fetchMasterOptions = async () => {
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
        subscription_price: Number(v.subscription_price || v.price || 0),
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
    setDraftFinalPriceInput('');
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

    const finalPriceRaw = parseFloat(draftFinalPriceInput);
    if (isNaN(finalPriceRaw) || draftFinalPriceInput.trim() === '') {
      setFormError('Please enter a Final Subscription Price.');
      return;
    }
    if (finalPriceRaw < 0) {
      setFormError('Final Subscription Price cannot be negative.');
      return;
    }
    if (variantObj.subscription_price > 0 && finalPriceRaw > variantObj.subscription_price) {
      setFormError(
        `Final Subscription Price (₹${finalPriceRaw}) cannot exceed Subscription Price (₹${variantObj.subscription_price}).`,
      );
      return;
    }

    const productObj = products.find((p) => p.product_id === draftProductId);
    const originalPrice = variantObj.original_price || variantObj.price;
    const sellingPrice = variantObj.price;
    const subscriptionPrice = variantObj.subscription_price;

    const { finalSubscriptionPrice, specialDiscountPct, overallSavingsPct } = computeRowValues(
      originalPrice, subscriptionPrice, draftFinalPriceInput,
    );

    const newRow: RepeaterItem = {
      id: String(Date.now()),
      productId: draftProductId,
      productName: productObj?.name || 'Product',
      variantId: draftVariantId,
      variantName: variantObj.name,
      originalPrice,
      sellingPrice,
      subscriptionPrice,
      finalSubscriptionPriceInput: draftFinalPriceInput,
      finalSubscriptionPrice,
      specialDiscountPct,
      overallSavingsPct,
    };

    setRepeaterRows((prev) => {
      const filtered = prev.filter((r) => r.variantId !== draftVariantId);
      return [...filtered, newRow];
    });

    setDraftProductId('');
    setDraftProductSearch('');
    setDraftVariantId('');
    setDraftFinalPriceInput('');
  };

  // Real-time update of a row's final subscription price
  const handleUpdateRowFinalPrice = (id: string, newPriceStr: string) => {
    setRepeaterRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const rawVal = parseFloat(newPriceStr);
        const clamped = isNaN(rawVal) ? 0 : clampFinalPrice(rawVal, row.subscriptionPrice);
        const { specialDiscountPct, overallSavingsPct } = computeRowValues(
          row.originalPrice, row.subscriptionPrice, String(clamped),
        );
        return {
          ...row,
          finalSubscriptionPriceInput: newPriceStr,
          finalSubscriptionPrice: clamped,
          specialDiscountPct,
          overallSavingsPct,
        };
      })
    );
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
      // Send final_subscription_price; backend derives discount_percentage
      const payloadItems = repeaterRows.map((r) => ({
        product_variant_id: r.variantId,
        final_subscription_price: r.finalSubscriptionPrice,
      }));

      const res = await api.post(`/admin/customer/${selectedCustomer.id}/special-prices`, {
        items: payloadItems,
      });

      const resBody = res.data as any;
      if (resBody?.status) {
        onSaved();
        onClose();
      } else {
        setFormError(resBody?.message || (res as any).error || 'Failed to save special prices');
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

  // Draft state calculations (for live preview card)
  const currentAvailableVariants = variantsMap[draftProductId] || [];
  const selectedDraftVariant = currentAvailableVariants.find((v) => v.variant_id === draftVariantId);

  const draftOriginalPrice = selectedDraftVariant ? (selectedDraftVariant.original_price || selectedDraftVariant.price) : 0;
  const draftSellingPrice = selectedDraftVariant ? selectedDraftVariant.price : 0;
  const draftSubPrice = selectedDraftVariant ? selectedDraftVariant.subscription_price : 0;

  const draftPreview = selectedDraftVariant
    ? computeRowValues(draftOriginalPrice, draftSubPrice, draftFinalPriceInput)
    : null;

  // Auto-fill subscription price when variant is selected and input is empty
  useEffect(() => {
    if (selectedDraftVariant && draftFinalPriceInput === '') {
      // Default to subscription_price (0% discount)
      setDraftFinalPriceInput(String(selectedDraftVariant.subscription_price));
    }
  }, [draftVariantId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" />
              Configure Customer Special Prices
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set a Final Subscription Price. The system auto-calculates the discount percentage.
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
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
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
            <span className="px-2.5 py-1 bg-white text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 shadow-xs">
              CUSTOMER PORTFOLIO
            </span>
          </div>
        ) : (
          /* Searchable Customer Selection Dropdown */
          <div ref={dropdownRef} className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-2 relative">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Select Customer * <span className="text-[11px] font-normal text-slate-400">(Customer role users only)</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                className="w-full bg-white border border-gray-300 text-slate-800 text-sm p-3 rounded-xl flex items-center justify-between shadow-xs hover:border-emerald-500 transition"
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
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 space-y-2 max-h-60 overflow-y-auto">
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

        {/* STEP 2: Product & Variant Picker + Final Subscription Price */}
        {selectedCustomer && (
          <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {initialCustomer ? '1.' : '2.'} Add Product Variant & Final Subscription Price
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
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 space-y-2 max-h-56 overflow-y-auto">
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
                  onChange={(e) => {
                    setDraftVariantId(e.target.value);
                    setDraftFinalPriceInput('');
                  }}
                  className="w-full bg-white border border-gray-300 text-slate-800 text-xs p-2.5 rounded-xl focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {!draftProductId ? '-- Select product first --' : '-- Select Variant --'}
                  </option>
                  {currentAvailableVariants.map((v) => (
                    <option key={v.variant_id} value={v.variant_id}>
                      {v.name} (Sub: ₹{v.subscription_price})
                    </option>
                  ))}
                </select>
              </div>

              {/* Final Subscription Price Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <IndianRupee className="w-3 h-3" /> Final Subscription Price
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      max={draftSubPrice > 0 ? draftSubPrice : undefined}
                      step="0.01"
                      placeholder={draftSubPrice > 0 ? String(draftSubPrice) : '0.00'}
                      value={draftFinalPriceInput}
                      onChange={(e) => setDraftFinalPriceInput(e.target.value)}
                      disabled={!draftVariantId}
                      className="w-full bg-white border border-gray-300 text-slate-800 text-xs pl-6 pr-2 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 font-bold disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
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

            {/* Live Preview Card */}
            {selectedDraftVariant && draftPreview && (
              <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> Live Pricing Preview
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/80 rounded-lg p-2.5 border border-slate-100">
                    <span className="text-slate-400 font-medium block mb-0.5">Original Price</span>
                    <div className="font-bold text-slate-400 line-through">₹{draftOriginalPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2.5 border border-slate-100">
                    <span className="text-slate-400 font-medium block mb-0.5">Selling Price</span>
                    <div className="font-bold text-slate-700">₹{draftSellingPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2.5 border border-slate-100">
                    <span className="text-slate-400 font-medium block mb-0.5">Subscription Price</span>
                    <div className="font-bold text-sky-700">₹{draftSubPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-emerald-100/60 rounded-lg p-2.5 border border-emerald-200 col-span-1">
                    <span className="text-emerald-700 font-semibold block mb-0.5">Final Sub Price</span>
                    <div className="font-black text-lg text-emerald-700">
                      ₹{draftFinalPriceInput !== '' ? (parseFloat(draftFinalPriceInput) || 0).toFixed(2) : draftSubPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-200">
                    <span className="text-purple-700 font-semibold block mb-0.5">Overall Savings</span>
                    <div className="font-black text-purple-700">{draftPreview.overallSavingsPct.toFixed(2)}% OFF</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">(vs Original Price)</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                    <span className="text-amber-700 font-semibold block mb-0.5">Special Discount</span>
                    <div className="font-black text-amber-700">{draftPreview.specialDiscountPct.toFixed(2)}% OFF</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">(vs Subscription Price)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <Info className="w-3 h-3 shrink-0 text-slate-400" />
                  Backend stores <strong>discount: {draftPreview.specialDiscountPct.toFixed(2)}%</strong> and always derives the final price dynamically.
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Summary Table */}
        {selectedCustomer && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Special Price Summary for {selectedCustomer.name} ({repeaterRows.length})
            </h3>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3 text-right">Original</th>
                    <th className="py-2.5 px-3 text-right">Selling</th>
                    <th className="py-2.5 px-3 text-right">Sub Price</th>
                    <th className="py-2.5 px-3 text-right">Final Sub Price</th>
                    <th className="py-2.5 px-3 text-center">Overall Savings</th>
                    <th className="py-2.5 px-3 text-center">Special Discount</th>
                    <th className="py-2.5 px-3 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-slate-700">
                  {repeaterRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400">
                        No variant rules added yet. Select a product and variant above and click &quot;Add&quot;.
                      </td>
                    </tr>
                  ) : (
                    repeaterRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{row.productName}</td>
                        <td className="py-2.5 px-3">{row.variantName}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400 line-through">
                          ₹{row.originalPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          ₹{row.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-sky-700">
                          ₹{row.subscriptionPrice.toFixed(2)}
                        </td>
                        {/* Editable Final Subscription Price */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-slate-400 text-[10px]">₹</span>
                            <input
                              type="number"
                              min="0"
                              max={row.subscriptionPrice}
                              step="0.01"
                              value={row.finalSubscriptionPriceInput}
                              onChange={(e) => handleUpdateRowFinalPrice(row.id, e.target.value)}
                              className="w-20 bg-emerald-50 border border-emerald-300 text-emerald-900 font-black text-xs px-2 py-1 rounded text-right focus:bg-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100 text-[11px]">
                            {row.overallSavingsPct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <TrendingDown className="w-3 h-3" />
                            {row.specialDiscountPct.toFixed(2)}%
                          </span>
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
