"use client";

import Link from "next/link";
import { ChevronRight, Home, Phone, Mail, MapPin, Clock, ShieldCheck, MessageCircle, Send } from "lucide-react";
import { useState } from "react";

export default function ContactUsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "General Inquiry",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission / send to support
    setSubmitted(true);
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
          <span className="font-semibold text-slate-800">Contact Us</span>
        </nav>

        {/* Header Hero Card */}
        <div className="mb-8 rounded-[16px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 sm:p-8 shadow-sm">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              F2H — Farm to Home
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Get in Touch with Us
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
              Have questions about our farm-fresh dairy subscriptions, delivery timings, wallet refunds, or corporate partnerships? We are here to assist you 7 days a week.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Official Business Details */}
          <div className="space-y-6 lg:col-span-5">
            {/* Registered Company Card */}
            <div className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                Official Business &amp; Entity Details
              </h2>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Legal Entity Name</p>
                  <p className="font-bold text-slate-900 text-sm sm:text-base mt-0.5">F2H - Farm to Home</p>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Registered &amp; Operating Address</p>
                    <p className="font-medium text-slate-700 mt-0.5 leading-relaxed">
                      1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066, Karnataka, India
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <Clock className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operating &amp; Support Hours</p>
                    <p className="font-medium text-slate-700 mt-0.5">
                      5:00 AM – 9:00 PM IST (Monday to Sunday, All 7 Days)
                    </p>
                    <p className="text-[11px] text-slate-500">Morning Shift: 5:30 AM – 7:30 AM | Evening Shift: 5:00 PM – 7:30 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Contact Channels */}
            <div className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Customer Support Channels
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
                    <p className="text-[11px] text-slate-500 font-medium">Primary Helpline</p>
                    <p className="font-bold text-slate-900">+91 91487 73591</p>
                  </div>
                </a>

                <a
                  href="tel:+917989368142"
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 group"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Phone size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Secondary Helpline</p>
                    <p className="font-bold text-slate-900">+91 79893 68142</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/919148773591"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 group"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700 group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <MessageCircle size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">WhatsApp Support</p>
                    <p className="font-bold text-slate-900">+91 91487 73591 (Instant Chat)</p>
                  </div>
                </a>

                <a
                  href="mailto:support@f2hfresh.com"
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 group"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Mail size={16} />
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Customer Support Email</p>
                    <p className="font-bold text-slate-900">support@f2hfresh.com</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Grievance & Escalation Officer Card */}
            <div className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-5">
              <div className="flex items-center gap-2 mb-2 text-amber-900 font-bold text-sm">
                <ShieldCheck className="text-amber-700" size={18} />
                Grievance &amp; Nodal Escalations
              </div>
              <p className="text-xs text-amber-800/90 leading-relaxed mb-3">
                In compliance with Consumer Protection (E-Commerce) Rules and IT Act requirements, you may escalate unresolved grievances to our designated officer:
              </p>
              <div className="text-xs space-y-1 text-amber-950 font-medium">
                <p><strong>Grievance Officer:</strong> F2H Grievance Cell</p>
                <p><strong>Email:</strong> grievanceofficer@f2hfresh.com</p>
                <p><strong>Turnaround:</strong> Acknowledged within 48 hours; resolved within 30 days.</p>
              </div>
            </div>
          </div>

          {/* Right Column: Contact & Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-[16px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950 mb-1">Send Us a Message</h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">
                Fill out the form below and our team will get back to you within 24 hours.
              </p>

              {submitted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                    ✓
                  </div>
                  <h3 className="text-base font-bold text-emerald-900 mb-1">Thank You!</h3>
                  <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                    Your inquiry has been received successfully. Our customer support team will contact you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-5 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ashok Nanda"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ashok@example.com"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Daily Milk Subscription">Daily Milk Subscription</option>
                      <option value="Billing & Wallet Top-up">Billing &amp; Wallet Top-up</option>
                      <option value="Refund Request">Refund Request</option>
                      <option value="Delivery Address Serviceability">Delivery Address Serviceability</option>
                      <option value="Delivery Partner Opportunity">Delivery Partner Opportunity</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Message / Query *</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Please let us know how we can help you..."
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors"
                  >
                    <Send size={15} />
                    Submit Inquiry
                  </button>
                </form>
              )}
            </div>

            {/* Quick Policy Links Card */}
            <div className="mt-6 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-900 mb-2">Need quick policy answers?</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link href="/terms-and-conditions" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                  Terms &amp; Conditions →
                </Link>
                <Link href="/refund-policy" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                  Refund &amp; Cancellation Policy →
                </Link>
                <Link href="/delivery-policy" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                  Delivery &amp; Shipping Policy →
                </Link>
                <Link href="/privacy-policy" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                  Privacy Policy →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
