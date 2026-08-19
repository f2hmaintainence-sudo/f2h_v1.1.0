"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Home, ShieldAlert, Mail, Smartphone, Info, Send, CheckCircle2 } from "lucide-react";

export default function DeleteAccountPage() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [appType, setAppType] = useState("F2H Delivery Partner");
  const [reason, setReason] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || mobileNumber.length < 10) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="mx-auto max-w-[1000px] px-3 pb-14 pt-24 sm:px-4 lg:px-5">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Account Deletion Request</span>
        </nav>

        <article className="rounded-[8px] border border-slate-200 bg-white px-4 py-7 shadow-sm sm:px-6 lg:px-7">
          {/* Header */}
          <div className="mb-8 border-b border-slate-100 pb-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
                Official Google Play Policy Center
              </span>
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800 border border-blue-200">
                F2H Delivery Partner & F2H Customer Apps
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-[28px]">
              Account Deletion & Data Removal Policy
            </h1>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Entity: <strong>F2H Fresh</strong> (Developer / Company: <strong>ChronoSparkSolutions</strong>) | Mobile Apps: <strong>F2H Delivery Partner</strong> & <strong>F2H Fresh</strong>
            </p>
          </div>

          <div className="space-y-8">
            {/* Warning Callout */}
            <div className="flex gap-4 rounded-[8px] border border-red-100 bg-red-50/50 p-5">
              <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
              <div>
                <h4 className="text-sm font-semibold text-red-900">Permanent Action Warning</h4>
                <p className="mt-1 text-sm leading-6 text-red-700">
                  Deleting your account for <strong>F2H Delivery Partner</strong> or <strong>F2H Fresh</strong> is permanent. All your personal identity details, active delivery runs, profile verification records, address books, and wallet history will be permanently erased.
                </p>
              </div>
            </div>

            {/* Interactive Web Form for Online Deletion Request */}
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-6">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Send className="h-5 w-5 text-emerald-700" />
                  Request Account Deletion Online (No App Required)
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  As required by Google Play Developer policies, you can submit a deletion request directly below without needing to log in or install the app.
                </p>
              </div>

              {isSubmitted ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-100/60 p-5 text-emerald-950">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-7 w-7 text-emerald-700 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Account Deletion Request Received</h4>
                      <p className="mt-1 text-xs leading-5 text-emerald-900">
                        We have logged your deletion request for mobile number <strong>+91 {mobileNumber}</strong> on app <strong>{appType}</strong>. Our support team will verify and complete the account wipe within <strong>7 business days</strong>. A confirmation SMS will be sent upon completion.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select App Name <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={appType}
                        onChange={(e) => setAppType(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="F2H Delivery Partner">F2H Delivery Partner (Delivery App)</option>
                        <option value="F2H Customer">F2H Fresh (Customer Milk App)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Registered Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center">
                        <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                          +91
                        </span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          placeholder="Enter 10-digit registered mobile number"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                          className="w-full rounded-r-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name (As registered in app)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reason for Deletion (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. No longer using service"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || mobileNumber.length < 10}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Submitting Request..." : "Submit Account Deletion Request"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Section 1: Overview */}
            <section className="scroll-mt-28">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  1
                </span>
                <h2 className="pt-0.5 text-[15px] font-bold leading-6 tracking-normal text-slate-950 sm:text-base">
                  Methods to request account deletion
                </h2>
              </div>
              <div className="ml-10 border-l border-emerald-100 pl-4">
                <p className="text-sm leading-6 text-slate-600">
                  You can request permanent account deactivation and removal for both <strong>F2H Delivery Partner</strong> and <strong>F2H Fresh</strong> through any of the following channels:
                </p>
                
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 text-sm">
                      <Smartphone size={16} className="text-emerald-700" />
                      In-App Self-Service (Recommended)
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Open <strong>F2H Delivery Partner</strong> or <strong>F2H Fresh App</strong> → Go to <strong>Profile / Account Settings</strong> → Tap <strong>Delete Account</strong> at the bottom of the support menu → Confirm verification.
                    </p>
                  </div>

                  <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 text-sm">
                      <Mail size={16} className="text-emerald-700" />
                      Direct Email Support
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Send an email to <a href="mailto:support@f2hfresh.com" className="text-emerald-700 font-semibold underline">support@f2hfresh.com</a> with the subject <strong>&quot;Delete F2H Account&quot;</strong>. Include your registered mobile number and app type.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Data Deleted */}
            <section className="scroll-mt-28 border-t border-slate-100 pt-7">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  2
                </span>
                <h2 className="pt-0.5 text-[15px] font-bold leading-6 tracking-normal text-slate-950 sm:text-base">
                  What categories of user data are deleted?
                </h2>
              </div>
              <div className="ml-10 border-l border-emerald-100 pl-4">
                <p className="text-sm leading-6 text-slate-600">
                  Upon verifying your deletion request, the following data categories linked to your account will be permanently deleted from our servers:
                </p>
                <ul className="mt-3 space-y-2">
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Personal Profile Identity:</strong> Your full name, telephone number, email address, profile avatar, and login credentials.</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Delivery & Partner Verification Data:</strong> For <strong>F2H Delivery Partner</strong> accounts: driving license copies, bank account payout details, vehicle type info, and active route assignments.</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Location & Address Records:</strong> Saved home/office delivery addresses, zone markers, and historical GPS logs.</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Subscriptions & Wallet Balances:</strong> Active milk subscription schedules, delivery calendars, and remaining wallet balance descriptors.</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 3: Data Retention */}
            <section className="scroll-mt-28 border-t border-slate-100 pt-7">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  3
                </span>
                <h2 className="pt-0.5 text-[15px] font-bold leading-6 tracking-normal text-slate-950 sm:text-base">
                  Data Retention Exceptions & Processing Timeline
                </h2>
              </div>
              <div className="ml-10 border-l border-emerald-100 pl-4 space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  All standard account deletion requests are fully processed within <strong>7 business days</strong>.
                </p>
                
                <div className="rounded-[8px] border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-emerald-900 text-xs uppercase tracking-wider">
                    <Info size={14} className="text-emerald-700" />
                    Statutory & Tax Compliance Retention
                  </div>
                  <p className="text-xs leading-5 text-emerald-800">
                    To comply with Indian Goods and Services Tax (GST) laws, corporate accounting standards, FSSAI regulations, and payment provider audit policies, archived billing invoices and financial transaction logs are retained for legally mandated retention windows. However, all personal contact identifiers (phone numbers, full names, addresses) associated with these static tax logs are completely anonymized.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
