// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : FirebaseConfigModal.tsx
// Description : Modal for creating & editing Firebase Cloud Messaging configurations
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import { X, Layers, RotateCw } from "lucide-react";

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function FirebaseConfigModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: FirebaseConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    config_key: "",
    name: "",
    google_services_json: "",
    service_account_json: "",
    android_app_id: "",
    ios_app_id: "",
    web_app_id: "",
    client_api_key: "",
    auth_domain: "",
    messaging_sender_id: "",
    measurement_id: "",
  });

  useEffect(() => {
    if (initialData) {
      const cfg = initialData.config_data || {};
      setFormData({
        config_key: initialData.config_key || "",
        name: initialData.name || "",
        google_services_json: cfg.google_services_json || cfg.googleServicesJson || "",
        service_account_json: cfg.service_account_json || cfg.serviceAccountJson || "",
        android_app_id: cfg.android_app_id || cfg.appId || "",
        ios_app_id: cfg.ios_app_id || "",
        web_app_id: cfg.web_app_id || "",
        client_api_key: cfg.client_api_key || cfg.apiKey || "",
        auth_domain: cfg.auth_domain || cfg.authDomain || "",
        messaging_sender_id: cfg.messaging_sender_id || cfg.messagingSenderId || "",
        measurement_id: cfg.measurement_id || "",
      });
    } else {
      setFormData({
        config_key: "",
        name: "",
        google_services_json: "",
        service_account_json: "",
        android_app_id: "",
        ios_app_id: "",
        web_app_id: "",
        client_api_key: "",
        auth_domain: "",
        messaging_sender_id: "",
        measurement_id: "",
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
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialData ? "Edit Firebase Config" : "Add Firebase Config"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure Google Firebase credentials, service account keys, and app IDs for publishing.
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
                placeholder="customer"
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
                placeholder="Customer App Firebase Config"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              google-services.json (Client Credentials File)
            </label>
            <textarea
              rows={3}
              placeholder="google-services.json content"
              value={formData.google_services_json}
              onChange={(e) => setFormData({ ...formData, google_services_json: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 resize-none font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Firebase Service Account JSON (Google Private Key Credentials)
            </label>
            <textarea
              rows={3}
              placeholder="Firebase Service Account JSON"
              value={formData.service_account_json}
              onChange={(e) => setFormData({ ...formData, service_account_json: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 resize-none font-mono text-[11px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Android App ID (FCM / Play Store)
              </label>
              <input
                type="text"
                placeholder="1:490125355314:android:bb214c5c42e862e4e4b"
                value={formData.android_app_id}
                onChange={(e) => setFormData({ ...formData, android_app_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                iOS App ID (APNs / App Store)
              </label>
              <input
                type="text"
                placeholder="iOS App ID"
                value={formData.ios_app_id}
                onChange={(e) => setFormData({ ...formData, ios_app_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Web App ID
              </label>
              <input
                type="text"
                placeholder="Web App ID"
                value={formData.web_app_id}
                onChange={(e) => setFormData({ ...formData, web_app_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                API Key (Client)
              </label>
              <input
                type="text"
                placeholder="AlzaSyBcpIEN5biktcmU0zcFleHrnTShnn7isA4"
                value={formData.client_api_key}
                onChange={(e) => setFormData({ ...formData, client_api_key: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Auth Domain
              </label>
              <input
                type="text"
                placeholder="f2h-fresh.firebaseapp.com"
                value={formData.auth_domain}
                onChange={(e) => setFormData({ ...formData, auth_domain: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Messaging Sender ID
              </label>
              <input
                type="text"
                placeholder="490125355314"
                value={formData.messaging_sender_id}
                onChange={(e) => setFormData({ ...formData, messaging_sender_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Measurement ID (Analytics)
              </label>
              <input
                type="text"
                placeholder="Measurement ID"
                value={formData.measurement_id}
                onChange={(e) => setFormData({ ...formData, measurement_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
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
              Save Firebase Config
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
