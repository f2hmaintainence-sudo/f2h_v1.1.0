// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Become a Delivery Partner)
// Description : Public onboarding & application page for F2H delivery fleet partners
// ============================================================================

"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bike,
  Smartphone,
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
  HelpCircle,
  ChevronDown,
  Award,
  Zap,
  PhoneCall,
  UserCheck,
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
    preferredShift: "Both",
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
      q: "What are the working hours for F2H delivery partners?",
      a: "We operate two main delivery shifts: Morning Shift (5:30 AM – 7:30 AM) for silent doorstep farm fresh milk drops, and Evening Shift (5:00 PM – 7:30 PM). You can choose morning only, evening only, or both shifts according to your schedule.",
    },
    {
      q: "How and when do I receive my payouts?",
      a: "Payouts are calculated per completed delivery drop plus distance and attendance incentives. All earnings are deposited directly into your bank account every Tuesday without any hidden deductions.",
    },
    {
      q: "What documents are required to get started?",
      a: "You need a valid Aadhaar Card, Driving License (for motorized two-wheelers), PAN Card, and your bank account passbook/cancelled cheque for payout settlements.",
    },
    {
      q: "Do I need to buy the delivery bags or kit?",
      a: "No! F2H provides high-grade insulated thermal delivery bags and reflective safety vests upon joining after your hub onboarding session.",
    },
    {
      q: "How far do I have to travel for deliveries?",
      a: "Our delivery routes are hyperlocal clusters within a 3–5 km radius around our hub branches (e.g. Whitefield, Kadugodi, Marathahalli). You deliver to organized neighborhood apartments and societies without long cross-city travel.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7faf8] text-slate-800 font-sans">
      {/* ── Breadcrumb Bar ── */}
      <div className="border-b border-emerald-900/10 bg-emerald-950/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-600 flex items-center gap-2">
          <Link href="/" className="hover:text-emerald-700 font-medium">Home</Link>
          <span className="text-slate-400">/</span>
          <span className="font-semibold text-emerald-800">Become a Delivery Partner</span>
        </div>
      </div>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-12 pb-16 bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles size={14} /> Join The F2H Bangalore Delivery Fleet
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Earn <span className="text-emerald-400">₹25,000 – ₹35,000/Month</span> with Flexible Morning Shifts
          </h1>

          <p className="mt-4 text-sm sm:text-base text-emerald-100/80 max-w-2xl mx-auto leading-relaxed">
            Deliver farm fresh milk &amp; dairy to neighborhood doorsteps between <strong>5:30 AM – 7:30 AM</strong>. Keep the entire day free for your studies, family, or regular job.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <IndianRupee size={16} /> Earnings
              </div>
              <p className="text-lg font-black text-white mt-1">₹25k – ₹35k</p>
              <p className="text-[11px] text-slate-300">Monthly potential</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Clock size={16} /> Shifts
              </div>
              <p className="text-lg font-black text-white mt-1">5:30 – 7:30 AM</p>
              <p className="text-[11px] text-slate-300">Morning 2-hour drops</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Calendar size={16} /> Payouts
              </div>
              <p className="text-lg font-black text-white mt-1">Every Tuesday</p>
              <p className="text-[11px] text-slate-300">Direct bank transfer</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <MapPin size={16} /> Radius
              </div>
              <p className="text-lg font-black text-white mt-1">3 – 5 KM</p>
              <p className="text-[11px] text-slate-300">Hyperlocal clusters</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Dual Registration Section ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── OPTION 1: Download Partner App (Fast Track) ── */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/50 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider mb-4">
                <Zap size={13} /> Option 1: Fast-Track Mobile App
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight">
                Download F2H Partner App
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                Already have a smartphone? Install the official partner app, complete digital KYC in 5 minutes, and start delivering within 24 hours.
              </p>

              {/* App Card Graphic */}
              <div className="my-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
                  <Bike size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">F2H Delivery Partner App</h3>
                  <p className="text-[11px] text-emerald-400 mt-0.5 font-mono">v1.0.7 • Android 16 Ready</p>
                  <p className="text-[11px] text-slate-300 mt-1">Live Route Navigation • Instant Dispatches</p>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="space-y-3">
                <a
                  href="https://play.google.com/store/apps/details?id=com.f2h.delivery"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-white text-slate-950 hover:bg-emerald-400 transition font-bold text-sm shadow-md"
                >
                  <svg className="h-5 w-5 fill-current text-slate-950" viewBox="0 0 24 24">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a2.036 2.036 0 0 1-.22-.964V2.778c0-.361.08-.696.22-.964zM15.207 13.414l2.42 2.42-12.87 7.377 10.45-9.797zm2.42-5.242l-2.42 2.42L4.757.789l12.87 7.383zM16.621 12l2.97-1.704a1.867 1.867 0 0 1 0 3.408L16.62 12z" />
                  </svg>
                  <span>GET IT ON Google Play</span>
                </a>

                <a
                  href="https://api.f2hfresh.com/uploads/appRelease/delivery/app-release.apk"
                  download
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold border border-white/15"
                >
                  <Download size={15} />
                  <span>Download Direct APK (.apk)</span>
                </a>
              </div>

              {/* Checklist */}
              <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">3-Step App Onboarding:</p>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>Install app and sign in with your mobile OTP.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>Upload Aadhaar &amp; Driving License for verification.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>Collect your insulated delivery kit from the local hub and begin!</span>
                </div>
              </div>
            </div>

            {/* Support Callout */}
            <div className="mt-8 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/20 text-xs">
              <p className="text-emerald-300 font-semibold flex items-center gap-1.5">
                <PhoneCall size={14} /> Need Help Joining?
              </p>
              <p className="text-slate-300 mt-1">
                Call our onboarding supervisor directly at <a href="tel:+919148773591" className="text-white font-bold underline">+91 91487 73591</a>.
              </p>
            </div>
          </div>

          {/* ── OPTION 2: Web Form (Give Your Details) ── */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider mb-4">
              <UserCheck size={13} /> Option 2: Quick Web Application
            </div>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Apply Online &amp; We&apos;ll Call You
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Fill in your basic details below. Our Bengaluru fleet operations manager will contact you within 24 hours to assign your local delivery zone.
            </p>

            {submitted ? (
              <div className="my-8 p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl font-bold text-emerald-950">Application Received Successfully!</h3>
                <p className="text-xs sm:text-sm text-emerald-800 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{formData.fullName}</strong>. Our fleet supervisor has received your details for the <strong>{formData.area}</strong> cluster. We will call you at <strong>{formData.phone}</strong> shortly.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => { setSubmitted(false); setFormData({ ...formData, fullName: "", phone: "", email: "", area: "" }); }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition"
                  >
                    Submit Another Application
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Gowda"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number (WhatsApp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, "") })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Locality / Preferred Delivery Area <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Whitefield, Kadugodi, Marathahalli"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Bengaluru, Karnataka"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vehicle Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Bike">Motorcycle / Bike</option>
                      <option value="Electric Scooter">Electric Scooter (EV)</option>
                      <option value="Bicycle">Bicycle</option>
                      <option value="None / Walking">None / Walking Cluster</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Preferred Shift
                    </label>
                    <select
                      value={formData.preferredShift}
                      onChange={(e) => setFormData({ ...formData, preferredShift: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Both">Both Shifts (Morning &amp; Evening)</option>
                      <option value="Morning">Morning Only (5:30 – 7:30 AM)</option>
                      <option value="Evening">Evening Only (5:00 – 7:30 PM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Delivery Experience
                    </label>
                    <select
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Fresher">Fresher / No Experience</option>
                      <option value="1-2 Years">1 – 2 Years</option>
                      <option value="3+ Years">3+ Years</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Driving License Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KA03 20210001234"
                      value={formData.drivingLicenseNumber}
                      onChange={(e) => setFormData({ ...formData, drivingLicenseNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <span>Submitting your application...</span>
                    ) : (
                      <>
                        <span>Submit Application Details</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400 text-center mt-2">
                    By submitting, you agree to receive onboarding calls and WhatsApp updates from F2H Fresh.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Why Join F2H? Benefits ── */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Why Deliver with F2H Fresh?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500">
              The smartest, most respectful delivery partnership designed for riders who value their daytime freedom.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-500/40 transition shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <Clock size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Morning Shift Freedom</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Work from 5:30 AM to 7:30 AM before traffic starts. Complete your deliveries in quiet morning hours and keep the entire day free.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-500/40 transition shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <IndianRupee size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Weekly Guaranteed Payouts</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Direct bank transfers every Tuesday. Earn per drop with extra fuel incentives, rain bonuses, and weekend attendance rewards.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-500/40 transition shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <MapPin size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Compact Neighborhood Routes</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                No long-distance travel. Deliver to fixed apartment towers and gated communities within a 3–5 km radius from your hub.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-500/40 transition shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <Package size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Insulated Kit Provided</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                High-grade insulated thermal delivery bags and branded safety gear provided upon joining for safe, easy doorstep drops.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-500/40 transition shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Accidental Insurance &amp; Care</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Complete accidental medical insurance coverage for active delivery partners and dedicated 24/7 supervisor assistance.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-500/40 transition shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <Award size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Supervisor Career Growth</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Top-performing delivery partners are promoted to Hub Shift Supervisors, Dispatch Leads, and Cluster Managers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs Section ── */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Everything you need to know about joining the F2H fleet.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between gap-4"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-400 shrink-0 transition-transform ${
                    activeFaq === idx ? "rotate-180 text-emerald-600" : ""
                  }`}
                />
              </button>
              {activeFaq === idx && (
                <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
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
