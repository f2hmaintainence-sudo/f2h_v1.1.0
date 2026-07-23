"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api.client";
import { Download, RefreshCw, Calendar, FileCode, CheckCircle2, ChevronRight, QrCode } from "lucide-react";
import Link from "next/link";

interface VersionInfo {
  latestVersion: string;
  minVersion: string;
  forceUpdate: boolean;
  storeUrl: string;
  updateMessage: string;
  updateTitle: string;
  releaseNotes: string;
  fileSize: string;
  buildNumber: number;
  publishedDate: string;
}

export default function CustomerDownloadPage() {
  const [data, setData] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchVersionInfo = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/api/app-version/customer");
      if (res.data) {
        setData(res.data);
      } else {
        setError("Failed to fetch version metadata");
      }
    } catch (err: any) {
      setError("Unable to connect to the version server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getQrCodeUrl = (url: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-8">
          <Link href="/" className="hover:text-emerald-600 transition-colors">Home</Link>
          <ChevronRight size={12} className="text-slate-300" />
          <span className="text-slate-400">Download</span>
          <ChevronRight size={12} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Customer App</span>
        </nav>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <RefreshCw className="animate-spin text-emerald-600 mb-4" size={32} />
            <p className="text-xs text-slate-400 font-medium">Fetching the latest release info...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm px-6">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <span className="text-rose-600 font-bold text-lg">!</span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">Download Unavailable</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchVersionInfo}
              className="mt-6 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* App Card Section */}
            <div className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div>
                {/* Header Information */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center shadow-inner shrink-0">
                    <span className="text-3xl font-extrabold text-emerald-600">F2H</span>
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">F2H Customer App</h1>
                    <p className="text-xs text-slate-400 mt-0.5">Farm to Home Milk Delivery & Subscriptions</p>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">
                        v{data.latestVersion}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                        <FileCode size={11} /> Build {data.buildNumber}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar size={11} /> {formatDate(data.publishedDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Release Notes */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">What&apos;s New</h3>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-xs font-bold text-slate-800 mb-2">{data.updateTitle}</p>
                    <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">{data.releaseNotes}</p>
                  </div>
                </div>

                {/* Technical Specs List */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-medium text-slate-400">File Size</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{data.fileSize}</p>
                  </div>
                  <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-medium text-slate-400">Target OS</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">Android 6.0 (API 23) or higher</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={`${data.storeUrl}?v=${data.buildNumber}`}
                  download={`f2h-customer-v${data.latestVersion}.apk`}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/10 cursor-pointer text-center"
                >
                  <Download size={16} /> Download APK File
                </a>
                <span className="text-[10px] text-slate-400 text-center sm:text-left">
                  Secure download directly hosted on F2H servers. Checked for safety.
                </span>
              </div>
            </div>

            {/* Sidebar Section (QR Code) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 border border-emerald-100/50">
                <QrCode size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Scan to Download</h3>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mb-6">
                Point your phone camera here to scan and start downloading the APK directly on your device.
              </p>

              {/* QR Image Container */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getQrCodeUrl(`${data.storeUrl}?v=${data.buildNumber}`)}
                  alt="Download Link QR Code"
                  width={180}
                  height={180}
                  className="rounded-xl border border-white"
                />
              </div>

              <div className="flex items-center gap-1.5 mt-6 text-[10px] text-slate-400 font-medium">
                <CheckCircle2 size={13} className="text-emerald-500" /> Auto-updates with latest build
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
