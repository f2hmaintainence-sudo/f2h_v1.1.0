// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Become a Delivery Partner)
// Description : Clean, minimal, 1:1 theme-matched partner application & onboarding page
// ============================================================================

"use client";

import Link from "next/link";
import {
  ChevronRight,
  Home,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  Download,
  IndianRupee,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Bike,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

export default function BecomeAPartnerPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* ── Rich Styled Backdrop Image & Organic Overlay ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/assets/productbg.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f9f6ef]/85 via-[#edf7ed]/75 to-[#f2f9f3]/90" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] px-3 pb-16 pt-28 sm:px-4 lg:px-6">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Become a Partner</span>
        </nav>

        {/* Header Hero Card */}
        <div className="mb-8 rounded-[16px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 sm:p-8 shadow-sm">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              F2H — DELIVERY FLEET PARTNERSHIP
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Become a Delivery Partner
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
              Deliver farm-fresh milk &amp; dairy to neighborhood doorsteps with flexible early morning shifts (5:30 AM – 7:30 AM). Enjoy weekly bank payouts, compact 3–5 km routes, and complete operational support.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: App Download & Partner Perks */}
          <div className="space-y-6 lg:col-span-5">
            {/* Card 1: Official Partner App Download */}
            <div className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                Official Partner App
              </h2>

              <div className="flex items-center gap-4 mb-4">
                <div className="relative h-14 w-14 rounded-2xl overflow-hidden shadow-sm border border-emerald-200/80 shrink-0 bg-white p-1 flex items-center justify-center">
                  <img
                    src="/assets/delivery-partner-app-icon.png"
                    alt="F2H Delivery Partner App"
                    className="h-full w-full object-contain rounded-xl"
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">F2H Partner App</p>
                  <p className="text-[11px] text-emerald-700 font-medium">Official Delivery Partner App</p>
                  <p className="text-[11px] text-slate-400">Android • v1.0.7 (Target SDK 36)</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Already have a smartphone? Install the official partner app for instant digital KYC, live route navigation, and shift dispatches.
              </p>

              <div>
                <a
                  href="https://play.google.com/store/apps/details?id=com.f2h.delivery"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
                >
                  <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a2.036 2.036 0 0 1-.22-.964V2.778c0-.361.08-.696.22-.964zM15.207 13.414l2.42 2.42-12.87 7.377 10.45-9.797zm2.42-5.242l-2.42 2.42L4.757.789l12.87 7.383zM16.621 12l2.97-1.704a1.867 1.867 0 0 1 0 3.408L16.62 12z" />
                  </svg>
                  <span>GET IT ON Google Play</span>
                </a>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                  <span>1. Sign in with mobile OTP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                  <span>2. Upload Aadhaar &amp; Driving License</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                  <span>3. Collect delivery bag &amp; start</span>
                </div>
              </div>
            </div>

            {/* Card 2: Fleet Perks & Shift Details */}
            <div className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Fleet Perks &amp; Shifts
              </h2>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monthly Earning Potential</p>
                  <p className="font-bold text-slate-900 text-sm sm:text-base mt-0.5">₹25,000 – ₹35,000 / Month</p>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <Clock className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Shift Timings</p>
                    <p className="font-medium text-slate-700 mt-0.5">Morning Shift: 5:30 AM – 7:30 AM</p>
                    <p className="text-[11px] text-slate-500">Evening Shift: 5:00 PM – 7:30 PM</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <IndianRupee className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Weekly Payout Settlements</p>
                    <p className="font-medium text-slate-700 mt-0.5">Direct bank deposit every Tuesday</p>
                    <p className="text-[11px] text-slate-500">Per-drop earnings + fuel &amp; attendance bonuses</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Delivery Coverage</p>
                    <p className="font-medium text-slate-700 mt-0.5">Hyperlocal 3–5 KM Cluster Routes</p>
                    <p className="text-[11px] text-slate-500">Whitefield, Kadugodi, Marathahalli, Bellandur, Sarjapur</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Direct Onboarding Channels */}
            <div className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Onboarding Supervisor Channels
              </h2>

              <div className="space-y-3.5 text-xs sm:text-sm">
                <a
                  href="tel:+919148773591"
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 group"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Phone size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Fleet Supervisor Helpline</p>
                    <p className="font-bold text-slate-900">+91 91487 73591</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/919148773591?text=Hi%20F2H%20Operations,%20I%20am%20interested%20in%20joining%20as%20a%20delivery%20partner."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 group"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <MessageCircle size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">WhatsApp Onboarding</p>
                    <p className="font-bold text-slate-900">Chat with Onboarding Team</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Online Registration Form */}
          <div className="lg:col-span-7">
            <div className="rounded-[14px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Submit Partner Application
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Fill out the form below and our Bengaluru fleet operations team will get back to you within 24 hours.
              </p>

              {submitted ? (
                <div className="my-8 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-bold text-emerald-950">Application Received!</h3>
                  <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                    Thank you, <strong>{formData.fullName}</strong>. Our fleet supervisor has received your application for <strong>{formData.area}</strong>. We will call you at <strong>{formData.phone}</strong> shortly.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setFormData({ ...formData, fullName: "", phone: "", email: "", area: "" }); }}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Submit another application
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {errorMessage && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Your Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="Ashok Gowda"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Mobile Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ashok@example.com"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Locality / Preferred Delivery Area <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        placeholder="e.g. Whitefield, Kadugodi, Marathahalli"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        City
                      </label>
                      <input
                        type="text"
                        disabled
                        value="Bengaluru, Karnataka"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Vehicle Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.vehicleType}
                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Bike">Motorcycle / Bike</option>
                        <option value="Electric Scooter">Electric Scooter (EV)</option>
                        <option value="Bicycle">Bicycle</option>
                        <option value="None / Walking">Walking Cluster</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Preferred Shift <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.preferredShift}
                        onChange={(e) => setFormData({ ...formData, preferredShift: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Morning">Morning Shift (5:30 AM – 7:30 AM)</option>
                        <option value="Evening">Evening Shift (5:00 PM – 7:30 PM)</option>
                        <option value="Both">Both Shifts (Morning &amp; Evening)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Delivery Experience
                      </label>
                      <select
                        value={formData.experienceYears}
                        onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="Fresher">Fresher / No Experience</option>
                        <option value="1-2 Years">1 – 2 Years</option>
                        <option value="3+ Years">3+ Years</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Driving License <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.drivingLicenseNumber}
                        onChange={(e) => setFormData({ ...formData, drivingLicenseNumber: e.target.value })}
                        placeholder="KA03 20210001234"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 cursor-pointer"
                    >
                      {loading ? (
                        <span>Submitting Application...</span>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Submit Application Details</span>
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-center text-[11px] text-slate-400">
                      By submitting, you agree to receive onboarding communications and updates from F2H Fresh.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
