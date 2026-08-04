"use client";

import { useState } from "react";
import {
  Download, Smartphone, Info, ShieldAlert,
  Settings, CheckCircle2, FileText, ShoppingCart, Truck,
  Sparkles, AlertCircle, Copy, Check, Globe, Terminal, ExternalLink, Building2
} from "lucide-react";
import { motion } from "framer-motion";

export default function AppApkPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const customerDownloadUrl = "https://api.f2hfresh.com/uploads/appRelease/customer/app-release.apk";
  const deliveryDownloadUrl = "https://api.f2hfresh.com/uploads/appRelease/delivery/app-release.apk";

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const apps = [
    {
      id: "customer",
      name: "F2H Customer App",
      badge: "Direct-to-Consumer",
      description:
        "Direct-to-consumer grocery shopping app. Allows users to browse fresh farm products, schedule subscription deliveries, manage wallets, and track orders in real-time.",
      version: "v1.2.4",
      color: "emerald" as const,
      downloadUrl: customerDownloadUrl,
      previewUrl: "https://customer.f2hfresh.com",
      cliCommand: "cd apps/mobile/customer && flutter build web --release && cp -r build/web/* /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/",
      icon: ShoppingCart,
      gradient: "from-emerald-500 to-green-600",
      btnBg: "from-emerald-500 to-[#388e3c]",
      shadowColor: "shadow-emerald-500/20",
      features: [
        { text: "Live harvest inventory updates", icon: Sparkles },
        { text: "Seamless wallet & gateway payments", icon: ShoppingCart },
        { text: "Flexible subscription calendar", icon: Info },
        { text: "Real-time delivery tracking & maps", icon: Smartphone },
      ],
    },
    {
      id: "delivery",
      name: "F2H Delivery Partner App",
      badge: "Logistics & Fleet",
      description:
        "Internal logistics and driver application. Facilitates real-time route optimization, batch dispatch updates, digital proof of delivery, and instant communication.",
      version: "v1.0.0-beta",
      color: "amber" as const,
      downloadUrl: deliveryDownloadUrl,
      previewUrl: "https://partner.f2hfresh.com",
      cliCommand: "cd apps/mobile/delivery && flutter build web --release && cp -r build/web/* /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/",
      icon: Truck,
      gradient: "from-amber-400 to-orange-500",
      btnBg: "from-amber-400 to-orange-500",
      shadowColor: "shadow-amber-500/20",
      features: [
        { text: "Real-time route optimization", icon: Truck },
        { text: "In-app digital run sheet support", icon: FileText },
        { text: "Proof of Delivery (Photo & Sign)", icon: CheckCircle2 },
        { text: "Offline capability & state sync", icon: ShieldAlert },
      ],
    },
    {
      id: "admin",
      name: "F2H Admin Management Portal",
      badge: "Operations Control",
      description:
        "Comprehensive admin control center for branch config, live order dispatch, inventory forecasting, partner fleet allocations, and Google Maps sector visualization.",
      version: "v2.1.0",
      color: "blue" as const,
      downloadUrl: "",
      previewUrl: "https://f2hfresh.com/admin/dashboard",
      cliCommand: "cd apps/web && npm run build && pm2 restart frontend-f2hfresh",
      icon: Building2,
      gradient: "from-blue-600 to-indigo-600",
      btnBg: "from-blue-600 to-indigo-600",
      shadowColor: "shadow-blue-500/20",
      features: [
        { text: "Google Maps pie-slice sector math", icon: Sparkles },
        { text: "Real-time delivery partner tracking", icon: Smartphone },
        { text: "Branch configuration & hub management", icon: Settings },
        { text: "Inventory expiry & batch tracking", icon: CheckCircle2 },
      ],
    },
  ];

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12 animate-in fade-in duration-700 font-sans">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xs">
            <Smartphone size={12} className="animate-pulse" />
            <span>Application Distribution & Management Hub</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Applications & Domain Previews
          </h1>
          <p className="text-slate-500 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
            Instant 1-click live domain previews, APK downloads, and CLI deployment commands for individual applications.
          </p>
        </div>
      </div>

      {/* ── Main App Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {apps.map((app, idx) => {
          const AppIcon = app.icon;
          return (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    {app.badge}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {app.version}
                  </span>
                </div>

                {/* Icon & Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center border border-white/20 bg-gradient-to-br ${app.gradient} text-white shrink-0`}>
                    <AppIcon size={32} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 leading-snug">{app.name}</h2>
                    <a
                      href={app.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-bold mt-1 group-hover:underline"
                    >
                      <Globe size={13} />
                      <span className="truncate max-w-[200px]">{app.previewUrl.replace("https://", "")}</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                <p className="text-slate-500 text-xs leading-relaxed font-medium mb-5">
                  {app.description}
                </p>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Highlights</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {app.features.map((feature, fIdx) => {
                      const Icon = feature.icon;
                      return (
                        <div key={fIdx} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-white text-slate-700 shrink-0 border border-slate-100">
                            <Icon size={13} />
                          </div>
                          <span className="text-xs text-slate-700 font-semibold">{feature.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100 mt-auto">
                {/* 1. Live Domain Preview Button */}
                <a
                  href={app.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${app.btnBg} text-white text-xs font-black uppercase tracking-wider ${app.shadowColor} shadow-md hover:scale-[1.01] transition-all active:scale-95 text-center`}
                >
                  <Globe size={14} /> Open Live Domain Preview
                  <ExternalLink size={12} />
                </a>

                {/* 2. Download APK (if available) */}
                {app.downloadUrl ? (
                  <a
                    href={app.downloadUrl}
                    download
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all text-center"
                  >
                    <Download size={13} /> Download APK Package
                  </a>
                ) : null}

                {/* 3. CLI Command Copy Button */}
                <button
                  onClick={() => handleCopy(app.cliCommand, `${app.id}_cli`)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono hover:bg-slate-800 transition-all border border-slate-800"
                  title="Click to copy deployment CLI command"
                >
                  <span className="flex items-center gap-1.5 truncate pr-2">
                    <Terminal size={12} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{app.cliCommand}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-sans font-bold px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
                    {copiedKey === `${app.id}_cli` ? (
                      <span className="text-emerald-400 flex items-center gap-1"><Check size={11} /> Copied!</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy size={11} /> Copy CLI</span>
                    )}
                  </span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Package Specs & Security Note ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
            <Settings size={18} className="text-emerald-600" /> CLI Build & Deployment Commands
          </h2>
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-900 rounded-xl text-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-sans font-bold text-emerald-400 uppercase tracking-wider">Customer Web App Deploy</p>
                <p className="mt-1 text-slate-300">cd apps/mobile/customer && flutter build web --release && cp -r build/web/* /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/</p>
              </div>
              <button
                onClick={() => handleCopy("cd apps/mobile/customer && flutter build web --release && cp -r build/web/* /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/", "guide_customer")}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-sans text-xs font-bold transition-all shrink-0"
              >
                {copiedKey === "guide_customer" ? "Copied!" : "Copy Command"}
              </button>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl text-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-sans font-bold text-amber-400 uppercase tracking-wider">Partner Web App Deploy</p>
                <p className="mt-1 text-slate-300">cd apps/mobile/delivery && flutter build web --release && cp -r build/web/* /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/</p>
              </div>
              <button
                onClick={() => handleCopy("cd apps/mobile/delivery && flutter build web --release && cp -r build/web/* /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/", "guide_partner")}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-sans text-xs font-bold transition-all shrink-0"
              >
                {copiedKey === "guide_partner" ? "Copied!" : "Copy Command"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3">
              Live Domain Endpoints
            </h3>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Customer Web</span>
                <a href="https://customer.f2hfresh.com" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-400 hover:underline">customer.f2hfresh.com</a>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Partner Web</span>
                <a href="https://partner.f2hfresh.com" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-400 hover:underline">partner.f2hfresh.com</a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Admin Portal</span>
                <a href="https://f2hfresh.com/admin" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-400 hover:underline">f2hfresh.com/admin</a>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Farm2Home Multi-Domain Infrastructure © {new Date().getFullYear()}
          </div>
        </div>
      </div>

    </div>
  );
}
