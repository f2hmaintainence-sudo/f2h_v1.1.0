"use client";

import Link from "next/link";
import { ChevronRight, Home, ShieldAlert, Mail, Smartphone, Info } from "lucide-react";

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="mx-auto max-w-[1000px] px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Account Deletion</span>
        </nav>

        <article className="rounded-[8px] border border-slate-200 bg-white px-4 py-7 shadow-sm sm:px-6 lg:px-7">
          {/* Header */}
          <div className="mb-8 border-b border-slate-100 pb-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              F2H - Farm to Home
            </p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-[28px]">
              Account Deletion & Data Retention
            </h1>
          </div>

          <div className="space-y-8">
            {/* Warning Callout */}
            <div className="flex gap-4 rounded-[8px] border border-red-100 bg-red-50/50 p-5">
              <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
              <div>
                <h4 className="text-sm font-semibold text-red-900">Permanent Action Warning</h4>
                <p className="mt-1 text-sm leading-6 text-red-700">
                  Deleting your F2H account is a permanent action. All your profile details, wallet balances, active subscriptions, and address books will be irreversibly erased. 
                </p>
              </div>
            </div>

            {/* Section 1: Overview */}
            <section className="scroll-mt-28">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  1
                </span>
                <h2 className="pt-0.5 text-[15px] font-bold leading-6 tracking-normal text-slate-950 sm:text-base">
                  How to request account deletion
                </h2>
              </div>
              <div className="ml-10 border-l border-emerald-100 pl-4">
                <p className="text-sm leading-6 text-slate-600">
                  We provide two simple methods to request deactivation and permanent removal of your account:
                </p>
                
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 text-sm">
                      <Smartphone size={16} className="text-emerald-700" />
                      In-App (Recommended)
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Open the F2H Fresh App, go to your <strong>Profile screen</strong>, select <strong>Delete Account</strong> at the bottom of the Support menu, confirm the warning check, and submit the request.
                    </p>
                  </div>

                  <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 text-sm">
                      <Mail size={16} className="text-emerald-700" />
                      Via Email Support
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Send an email to <a href="mailto:support@f2hfresh.com" className="text-emerald-700 font-semibold underline">support@f2hfresh.com</a> with the subject line <strong>&quot;Delete F2H Account&quot;</strong>. Please include your registered mobile number.
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
                  Upon processing your deletion request, the following information will be permanently removed from our databases:
                </p>
                <ul className="mt-3 space-y-2">
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Personal Profile Identity:</strong> Your name, phone number, email address, and avatar references.</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Saved Delivery Details:</strong> All saved addresses, home/office locations, and delivery zone associations.</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Active Subscriptions & Calendars:</strong> Recurring milk/curd calendars, paused schedules, and delivery configurations.</span>
                  </li>
                  <li className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span><strong>Wallet Balance:</strong> Unused credits, top-up logs, and transaction descriptors.</span>
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
                  Timelines & Data Retention Exceptions
                </h2>
              </div>
              <div className="ml-10 border-l border-emerald-100 pl-4 space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  All standard deletion requests are completed within <strong>7 business days</strong> of verification.
                </p>
                
                <div className="rounded-[8px] border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-emerald-900 text-xs uppercase tracking-wider">
                    <Info size={14} className="text-emerald-700" />
                    Statutory Compliance Retention
                  </div>
                  <p className="text-xs leading-5 text-emerald-800">
                    To comply with Indian corporate taxation, FSSAI regulations, and payment provider verification policies, we are legally required to securely archive specific transaction invoices and billing logs for mandatory audit periods. However, all personal identifiers (name, address, telephone numbers) linked to these records will be completely anonymized/hashed.
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
