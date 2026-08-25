// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : PaymentGatewayConfigModal.tsx
// Description : Modal for creating & editing Payment Gateway configurations
//
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import { X, CreditCard, RotateCw, CheckCircle2, XCircle, Zap, FlaskConical } from "lucide-react";

interface PaymentGatewayConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function PaymentGatewayConfigModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: PaymentGatewayConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    config_key: "",
    name: "",
    provider: "Stripe",
    public_api_key: "",
    private_api_key: "",
    merchant_id: "",
    webhook_secret: "",
    mode: "test",
    is_active: true,
  });

  useEffect(() => {
    if (initialData) {
      const cfg = initialData.config_data || {};
      setFormData({
        config_key: initialData.config_key || "",
        name: initialData.name || "",
        provider: initialData.provider || "Stripe",
        public_api_key: cfg.public_api_key || "",
        private_api_key: cfg.private_api_key || "",
        merchant_id: cfg.merchant_id || "",
        webhook_secret: cfg.webhook_secret || "",
        mode: cfg.mode || "test",
        is_active: initialData.is_active ?? true,
      });
    } else {
      setFormData({
        config_key: "",
        name: "",
        provider: "Stripe",
        public_api_key: "",
        private_api_key: "",
        merchant_id: "",
        webhook_secret: "",
        mode: "test",
        is_active: true,
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        id: initialData?.id,
        ...formData,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/50 shadow-xs">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialData ? "Edit Payment Gateway Config" : "Add Payment Gateway Config"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure Stripe, PayPal, Razorpay or PhonePe Integration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Key *"
                value={formData.config_key}
                onChange={(e) => setFormData({ ...formData, config_key: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Provider <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 bg-slate-50/30"
            >
              <option value="Stripe">Stripe</option>
              <option value="Razorpay">Razorpay</option>
              <option value="PhonePe">PhonePe</option>
              <option value="PayPal">PayPal</option>
              <option value="Cashfree">Cashfree</option>
              <option value="Paytm">Paytm</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Public Publishable API Key
              </label>
              <input
                type="text"
                placeholder="Public Publishable API Key"
                value={formData.public_api_key}
                onChange={(e) => setFormData({ ...formData, public_api_key: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Private Secret API Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="Private Secret API Key *"
                value={formData.private_api_key}
                onChange={(e) => setFormData({ ...formData, private_api_key: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Merchant ID / Account ID
              </label>
              <input
                type="text"
                placeholder="Merchant ID / Account ID"
                value={formData.merchant_id}
                onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Webhook Endpoint Secret
              </label>
              <input
                type="text"
                placeholder="Webhook Endpoint Secret"
                value={formData.webhook_secret}
                onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Status & Mode Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Status Toggle */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gateway Status</label>
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/30">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    formData.is_active ? "bg-[#16a34a]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      formData.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <div className="flex items-center gap-1.5">
                  {formData.is_active ? (
                    <>
                      <CheckCircle2 size={14} className="text-[#16a34a]" />
                      <span className="text-[#16a34a] font-bold text-xs">Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-slate-400" />
                      <span className="text-slate-400 font-bold text-xs">Inactive</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Mode: Test / Live */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: "test" })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    formData.mode === "test"
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <FlaskConical size={13} />
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: "live" })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    formData.mode === "live"
                      ? "bg-emerald-50 border-emerald-400 text-[#16a34a]"
                      : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Zap size={13} />
                  Live
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors text-xs"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold transition-all shadow-md shadow-emerald-600/20 text-xs flex items-center gap-2"
            >
              {loading && <RotateCw className="animate-spin" size={14} />}
              Save Config
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
