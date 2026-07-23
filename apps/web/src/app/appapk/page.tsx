"use client";

import { useState } from "react";
import {
  Download, Smartphone, Info, ShieldAlert,
  Settings, CheckCircle2, FileText, ShoppingCart, Truck,
  Sparkles, AlertCircle, Copy, Check
} from "lucide-react";
import { motion } from "framer-motion";

export default function AppApkPage() {
  const [copiedCustomer, setCopiedCustomer] = useState(false);
  const [copiedDelivery, setCopiedDelivery] = useState(false);

  const customerDownloadUrl = "https://api.f2hfresh.com/uploads/appRelease/customer/app-release.apk";
  const deliveryDownloadUrl = "https://api.f2hfresh.com/uploads/appRelease/delivery/app-release.apk";

  const apps = {
    customer: {
      name: "F2H Customer App",
      description:
        "Direct-to-consumer grocery shopping app. Allows users to browse fresh farm products, schedule subscription deliveries, manage wallets, and track orders in real-time.",
      version: "v1.2.4",
      updatedAt: "June 04, 2026",
      color: "emerald" as const,
      downloadUrl: customerDownloadUrl,
      features: [
        { text: "Live harvest inventory updates", icon: Sparkles },
        { text: "Seamless wallet & gateway payments", icon: ShoppingCart },
        { text: "Flexible subscription calendar", icon: Info },
        { text: "Real-time delivery tracking & maps", icon: Smartphone },
      ],
    },
    delivery: {
      name: "F2H Delivery Partner App",
      description:
        "Internal logistics and driver application. Facilitates real-time route optimization, batch dispatch updates, digital proof of delivery, and instant communication.",
      version: "v1.0.0-beta",
      updatedAt: "June 04, 2026",
      color: "amber" as const,
      downloadUrl: deliveryDownloadUrl,
      features: [
        { text: "Real-time route optimization", icon: Truck },
        { text: "In-app digital run sheet support", icon: FileText },
        { text: "Proof of Delivery (Photo & Sign)", icon: CheckCircle2 },
        { text: "Offline capability & state sync", icon: ShieldAlert },
      ],
    },
  };

  const handleCopyLink = (url: string, type: "customer" | "delivery") => {
    navigator.clipboard.writeText(url);
    if (type === "customer") {
      setCopiedCustomer(true);
      setTimeout(() => setCopiedCustomer(false), 2000);
    } else {
      setCopiedDelivery(true);
      setTimeout(() => setCopiedDelivery(false), 2000);
    }
  };

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12 animate-in fade-in duration-700">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
            <Smartphone size={12} className="animate-pulse" />
            <span>Mobile Distribution Hub</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Download F2H Applications
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
            Access official APK builds for Farm2Home services. Click direct file downloads to retrieve installer packages for your device.
          </p>
        </div>
      </div>

      {/* ── Main App Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Customer App Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
        >
          <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full blur-3xl opacity-10 bg-emerald-500 transition-transform duration-500 group-hover:scale-110" />

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-6 md:gap-8 z-10">
            {/* Icon */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-28 h-28 rounded-[2rem] shadow-2xl flex items-center justify-center border border-emerald-300 bg-gradient-to-br from-emerald-500 to-green-600 text-white relative overflow-hidden">
                <ShoppingCart size={48} className="drop-shadow-md" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>
              {/* Version only — size removed */}
              <div className="mt-4 text-center">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                  {apps.customer.version}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{apps.customer.name}</h2>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed mt-2 font-medium">
                  {apps.customer.description}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Highlights</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {apps.customer.features.map((feature, i) => {
                    const Icon = feature.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors duration-200">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100/50 text-emerald-600 shrink-0">
                          <Icon size={16} />
                        </div>
                        <span className="text-xs text-slate-700 font-semibold leading-tight">{feature.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="relative z-10 pt-6 flex flex-wrap items-center gap-4 border-t border-slate-50 mt-8">
            <a
              href={apps.customer.downloadUrl}
              download
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-[#388e3c] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all duration-300 active:scale-95 cursor-pointer text-center"
            >
              <Download size={14} /> Download APK
            </a>
            <button
              onClick={() => handleCopyLink(apps.customer.downloadUrl, "customer")}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95"
            >
              {copiedCustomer ? (
                <><Check size={14} className="text-emerald-500" /> Copied</>
              ) : (
                <><Copy size={14} /> Copy Link</>
              )}
            </button>
          </div>
        </motion.div>

        {/* ── Delivery App Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
        >
          <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full blur-3xl opacity-10 bg-amber-500 transition-transform duration-500 group-hover:scale-110" />

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-6 md:gap-8 z-10">
            {/* Icon */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-28 h-28 rounded-[2rem] shadow-2xl flex items-center justify-center border border-amber-300 bg-gradient-to-br from-amber-400 to-orange-500 text-white relative overflow-hidden">
                <Truck size={48} className="drop-shadow-md" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>
              {/* Version only — size removed */}
              <div className="mt-4 text-center">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                  {apps.delivery.version}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{apps.delivery.name}</h2>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed mt-2 font-medium">
                  {apps.delivery.description}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Highlights</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {apps.delivery.features.map((feature, i) => {
                    const Icon = feature.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors duration-200">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100/50 text-amber-600 shrink-0">
                          <Icon size={16} />
                        </div>
                        <span className="text-xs text-slate-700 font-semibold leading-tight">{feature.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions — fully enabled, same pattern as customer card */}
          <div className="relative z-10 pt-6 flex flex-wrap items-center gap-4 border-t border-slate-50 mt-8">
            <a
              href={apps.delivery.downloadUrl}
              download
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all duration-300 active:scale-95 cursor-pointer text-center"
            >
              <Download size={14} /> Download APK
            </a>
            <button
              onClick={() => handleCopyLink(apps.delivery.downloadUrl, "delivery")}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95"
            >
              {copiedDelivery ? (
                <><Check size={14} className="text-amber-500" /> Copied</>
              ) : (
                <><Copy size={14} /> Copy Link</>
              )}
            </button>
          </div>
        </motion.div>

      </div>

      {/* ── Secondary Layout Grid (Guide & Specs) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Installation Guide */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 flex flex-col">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mb-6">
            <Settings size={20} className="text-emerald-500" /> Installation Guide
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: 1,
                title: "Download APK",
                body: "Click the download button on the desired app card to pull the `.apk` installation package.",
              },
              {
                step: 2,
                title: "Allow Unknown Sources",
                body: (
                  <>
                    Go to{" "}
                    <span className="font-bold text-slate-500">
                      Settings &gt; Security &gt; Special App Access &gt; Install Unknown Apps
                    </span>{" "}
                    and authorize your browser or file manager.
                  </>
                ),
              },
              {
                step: 3,
                title: "Execute Installer",
                body: (
                  <>
                    Open your mobile{" "}
                    <span className="font-bold text-slate-500">Downloads</span> folder or tap the
                    completed download notification to run the package.
                  </>
                ),
              },
              {
                step: 4,
                title: "Run and Login",
                body: "Launch the app, grant requested permissions (e.g. location for mapping), and log in.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 shadow-inner">
                  {step}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800 leading-tight">{title}</h4>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 flex gap-3 items-start animate-pulse">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider block">Security Advice</span>
              <span className="text-xs text-amber-700/95 leading-relaxed font-medium block">
                Only install APKs downloaded directly from this official distribution page. Do not install packages from unverified third-party sources.
              </span>
            </div>
          </div>
        </div>

        {/* Package Specifications */}
        <div className="lg:col-span-4 bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 bottom-0 opacity-5 text-slate-200 pointer-events-none">
            <Smartphone size={160} />
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-4">
              Package Specifications
            </h3>
            <div className="space-y-3.5 text-xs font-medium">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Extension</span>
                <span className="font-bold">.apk (Android Package)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Target OS</span>
                <span className="font-bold">Android 8.0 (API 26) +</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Signed State</span>
                <span className="font-bold text-emerald-400">v2 Signature Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Build Channel</span>
                <span className="font-bold">Production Release</span>
              </div>
            </div>
          </div>

          <div className="mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Farm2Home Distribution © {new Date().getFullYear()}
          </div>
        </div>

      </div>

    </div>
  );
}
