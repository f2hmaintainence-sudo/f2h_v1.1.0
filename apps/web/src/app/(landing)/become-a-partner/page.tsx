// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Become a Delivery Partner)
// Description : Clean, minimal, theme-aligned onboarding & application page
// ============================================================================

"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Download,
  CheckCircle2,
  Clock,
  IndianRupee,
  ShieldCheck,
  MapPin,
  Sparkles,
  ArrowRight,
  Package,
  Calendar,
  AlertCircle,
  ChevronDown,
  PhoneCall,
  Smartphone,
  Check,
} from "lucide-react";

export default function BecomeAPartnerPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    city: "Bengaluru",
    area: "",
    vehicleType: "Bike",
    vehicleNumber: "",
    drivingLicenseNumber: "",
    preferredShift: "Morning",
    experienceYears: "Fresher",
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/v1/delivery-partner/onboarding-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, source: "website_partner_page" }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setErrorMessage(data.message || "Failed to submit your application. Please check the details and try again.");
      }
    } catch (err) {
      setErrorMessage("Network error occurred. Please check your connection or contact our team directly.");
    } finally {
      setLoading(false);
    }
  };

  const faqs = [
    {
      q: "What are the shift timings?",
      a: "Morning shift is 5:30 AM to 7:30 AM (milk drops before traffic starts). Evening shift is 5:00 PM to 7:30 PM. You can choose morning, evening, or both.",
    },
    {
      q: "When and how do I receive payouts?",
      a: "Payouts are transferred directly to your bank account every Tuesday, calculated per completed drop plus fuel and attendance incentives.",
    },
    {
      q: "What documents do I need to join?",
      a: "Aadhaar Card, valid Driving License (for two-wheelers), and bank account passbook/cheque for payouts.",
    },
    {
      q: "Are delivery bags provided?",
      a: "Yes, F2H provides high-grade insulated thermal delivery bags for all active partners at your local hub.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7faf8] text-slate-800 font-sans">
      {/* ── Breadcrumb Bar ── */}
      <div className="border-b border-emerald-900/10 bg-emerald-950/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 text-xs text-slate-500 flex items-center gap-2">
          <Link href="/" className="hover:text-emerald-700 transition">Home</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-emerald-800">Become a Partner</span>
        </div>
      </div>

      {/* ── Minimal Hero Section ── */}
      <section className="pt-10 pb-8 text-center max-w-4xl mx-auto px-4 sm:px-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-4 border border-emerald-200/60">
          <Sparkles size={13} className="text-emerald-700" />
          F2H Delivery Fleet • Bengaluru
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Deliver Farm Fresh Milk &amp; <span className="text-emerald-700">Earn Daily</span>
        </h1>

        <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
          Flexible 2-hour morning shifts (<strong>5:30 AM – 7:30 AM</strong>). Weekly bank payouts, fixed 3–5 km neighborhood clusters, and zero commission.
        </p>

        {/* 4 Minimal Metric Pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200/80 text-slate-800 shadow-sm font-medium">
            <IndianRupee size={14} className="text-emerald-600" />
            <span>₹25,000 – ₹35,000 / mo</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200/80 text-slate-800 shadow-sm font-medium">
            <Clock size={14} className="text-emerald-600" />
            <span>5:30 AM – 7:30 AM Shifts</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200/80 text-slate-800 shadow-sm font-medium">
            <Calendar size={14} className="text-emerald-600" />
            <span>Weekly Payouts (Tuesday)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200/80 text-slate-800 shadow-sm font-medium">
            <MapPin size={14} className="text-emerald-600" />
            <span>Hyperlocal 3–5 KM</span>
          </div>
        </div>
      </section>

      {/* ── Main Two-Column Card Section ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* ── CARD 1: Instant App Download (with Real Delivery Icon) ── */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-emerald-900/10 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-100">
                {/* Real Delivery App Icon */}
                <div className="relative h-14 w-14 rounded-xl overflow-hidden shadow-sm border border-emerald-100 shrink-0 bg-emerald-50">
                  <img
                    src="/assets/delivery-partner-app-icon.png"
                    alt="F2H Partner App"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">F2H Partner App</h2>
                  <p className="text-xs text-emerald-700 font-medium">Official Delivery Partner App</p>
                  <p className="text-[11px] text-slate-400">Android • Instant KYC &amp; Route Map</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Download the official app to complete verification and start delivering in 24 hours.
              </p>

              {/* Store Buttons */}
              <div className="mt-5 space-y-2.5">
                <a
                  href="https://play.google.com/store/apps/details?id=com.f2h.delivery"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm"
                >
                  <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a2.036 2.036 0 0 1-.22-.964V2.778c0-.361.08-.696.22-.964zM15.207 13.414l2.42 2.42-12.87 7.377 10.45-9.797zm2.42-5.242l-2.42 2.42L4.757.789l12.87 7.383zM16.621 12l2.97-1.704a1.867 1.867 0 0 1 0 3.408L16.62 12z" />
                  </svg>
                  <span>GET IT ON Google Play</span>
                </a>

                <a
                  href="https://api.f2hfresh.com/uploads/appRelease/delivery/app-release.apk"
                  download
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition text-xs font-medium"
                >
                  <Download size={14} className="text-emerald-700" />
                  <span>Download Direct APK</span>
                </a>
              </div>

              {/* Quick Steps */}
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider">Fast-Track Steps:</p>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Install app &amp; sign in with mobile OTP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Upload Aadhaar &amp; Driving License</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Collect delivery bag from local hub &amp; start</span>
                </div>
              </div>
            </div>

            {/* Quick Helpline */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <PhoneCall size={13} className="text-emerald-600" /> Need Help?
              </span>
              <a href="tel:+919148773591" className="font-semibold text-emerald-800 hover:underline">
                +91 91487 73591
              </a>
            </div>
          </div>

          {/* ── CARD 2: Minimal Web Form (Give Your Details) ── */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-emerald-900/10">
            <div className="mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Or Give Your Details Below
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Our fleet supervisor will call you within 24 hours to allocate your local area.
              </p>
            </div>

            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Application Submitted!</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Thank you, <strong>{formData.fullName}</strong>. We have received your application for <strong>{formData.area}</strong>. We will contact you at <strong>{formData.phone}</strong> soon.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ ...formData, fullName: "", phone: "", area: "" }); }}
                  className="mt-2 text-xs text-emerald-700 font-semibold hover:underline"
                >
                  Submit another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Gowda"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, "") })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Locality / Delivery Area <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Whitefield, Kadugodi, Marathahalli"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Bengaluru"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Vehicle Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Bike">Motorcycle / Bike</option>
                      <option value="Electric Scooter">EV Scooter</option>
                      <option value="Bicycle">Bicycle</option>
                      <option value="None / Walking">Walking Cluster</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Preferred Shift
                    </label>
                    <select
                      value={formData.preferredShift}
                      onChange={(e) => setFormData({ ...formData, preferredShift: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Morning">Morning (5:30 – 7:30 AM)</option>
                      <option value="Evening">Evening (5:00 – 7:30 PM)</option>
                      <option value="Both">Both Shifts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Experience
                    </label>
                    <select
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Fresher">Fresher</option>
                      <option value="1-2 Years">1 – 2 Years</option>
                      <option value="3+ Years">3+ Years</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Driving License <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KA03 20210001234"
                      value={formData.drivingLicenseNumber}
                      onChange={(e) => setFormData({ ...formData, drivingLicenseNumber: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Submitting..." : (
                      <>
                        <span>Submit Details</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Clean Minimal FAQs ── */}
      <section className="py-12 max-w-3xl mx-auto px-4 sm:px-6 border-t border-emerald-900/10">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-slate-900">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200/80 overflow-hidden"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-semibold text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-3"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  size={15}
                  className={`text-slate-400 shrink-0 transition-transform ${
                    activeFaq === idx ? "rotate-180 text-emerald-700" : ""
                  }`}
                />
              </button>
              {activeFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
