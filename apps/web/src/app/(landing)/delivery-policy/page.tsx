"use client";

import Link from "next/link";
import { ChevronRight, Home, Sun, Moon, ShieldCheck, MapPin, Truck, Clock } from "lucide-react";

type PolicySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  note?: string;
  shifts?: { icon: "sun" | "moon"; label: string; time: string; desc: string }[];
};

const sections: PolicySection[] = [
  {
    id: "overview",
    title: "1. Overview & Cold-Chain Promise",
    paragraphs: [
      "This Delivery & Shipping Policy (\"Policy\") explains how F2H — Farm to Home (\"F2H\", \"We\", \"Us\") manages doorstep delivery of fresh milk, dairy items, and farm groceries ordered through our website, mobile applications, and digital platforms.",
      "This Policy forms part of, and must be read together with, the F2H Terms and Conditions and Cancellation & Refund Policy.",
      "F2H does not rely on generic third-party parcel couriers. Every single liter of milk and dairy product is delivered directly by F2H's trained delivery riders using insulated delivery boxes to ensure pure farm-to-table freshness within hours of collection.",
    ],
  },
  {
    id: "delivery-shifts",
    title: "2. Delivery Shifts & Guaranteed Timelines",
    paragraphs: [
      "F2H operates two dedicated daily delivery shifts across serviceable zones in Bangalore:",
      "Morning milk is collected directly from partner dairy farms at approximately 4:00 AM, chilled instantly to 2–6°C, packed in tamper-proof food-grade pouches, and delivered before 7:30 AM.",
      "Orders and subscriptions are automatically scheduled for your preferred daily or alternate-day slot upon wallet activation.",
    ],
    shifts: [
      {
        icon: "sun",
        label: "Morning Shift Delivery",
        time: "5:30 AM – 7:30 AM",
        desc: "Fresh morning milk & dairy essentials dropped at your doorstep every single day before 7:30 AM.",
      },
      {
        icon: "moon",
        label: "Evening Shift Delivery",
        time: "5:00 PM – 7:30 PM",
        desc: "Evening fresh milk and cooking staples delivered directly to your doorstep in active zones.",
      },
    ],
  },
  {
    id: "coverage-zones",
    title: "3. Serviceable Coverage Zones",
    paragraphs: [
      "F2H currently delivers to residential apartments, gated communities, independent houses, and villas across Bangalore, including but not limited to: Whitefield, Nagondanahalli, Kadugodi, Hoodi, ITPL, Hope Farm, Marathahalli, Varthur, Belathur, and adjoining localities.",
      "We are rapidly expanding to new pin codes across Greater Bengaluru. You can enter your pin code or drop your GPS pin in the F2H Mobile App to instantly check serviceability.",
      "If your area is currently outside our delivery grid, you can register your interest in the app, and you will be notified immediately when your cluster becomes operational.",
    ],
  },
  {
    id: "cut-off-times",
    title: "4. Daily Cut-Off Times for Orders & Pauses",
    paragraphs: [
      "Morning Shift Cut-Off (9:00 PM previous night): Any new subscription, quantity change, one-time add-on, or vacation pause for the next morning must be submitted by 9:00 PM. Modifications made before 9:00 PM are 100% free of charge.",
      "Evening Shift Cut-Off (10:00 AM same day): Any order, quantity modification, or pause for the evening shift must be submitted by 10:00 AM.",
      "Requests received after the cut-off times are automatically scheduled for the subsequent delivery cycle.",
    ],
  },
  {
    id: "unattended-deliveries",
    title: "5. Doorstep Delivery Protocol & Missed Deliveries",
    paragraphs: [
      "Silent Morning Drops: To ensure you are not disturbed during early morning hours, our riders place milk in your designated F2H insulated bag hung outside the door or at your secure doorstep.",
      "Delivery Confirmation: Upon successful drop, riders upload photo proof of delivery and you receive a WhatsApp notification and in-app update.",
      "Gated Communities & Security Entry: If security guards or apartment gates restrict rider access, our logistics team coordinates with the resident. Please ensure necessary security pre-approvals (e.g. MyGate, NoBrokerHood) are granted for F2H delivery staff.",
      "Missed Deliveries: If a delivery is missed due to a rider delay or logistical glitch, our customer support team provides an instant replacement or initiates an immediate 2-hour wallet refund.",
    ],
  },
  {
    id: "delivery-charges",
    title: "6. Delivery Charges & Transparent Pricing",
    paragraphs: [
      "₹0 Free Delivery on Subscriptions: There are no delivery charges for active daily or alternate-day milk subscriptions within our coverage zones.",
      "Zero Surge or Rain Pricing: F2H does not charge peak hours, rain fees, or holiday delivery surcharges. The price you see on our catalog is the exact price debited from your wallet.",
    ],
  },
  {
    id: "contact-support",
    title: "7. Delivery Grievances & Support",
    paragraphs: [
      "For any delivery delays, route assistance, or address updates, our delivery operations team is available from 5:00 AM to 9:00 PM IST every day:",
    ],
  },
];

function ShiftCards({ shifts }: { shifts: NonNullable<PolicySection["shifts"]> }) {
  return (
    <div className="mt-2 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {shifts.map((shift) => (
        <div
          key={shift.label}
          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
        >
          <div className="flex items-center gap-2 mb-1">
            {shift.icon === "sun" ? (
              <Sun className="text-amber-600" size={16} />
            ) : (
              <Moon className="text-indigo-600" size={16} />
            )}
            <p className="text-sm font-semibold text-slate-800">{shift.label}</p>
          </div>
          <p className="text-[12px] font-bold text-emerald-700 mb-1.5">{shift.time}</p>
          <p className="text-[12.5px] leading-5 text-slate-600">{shift.desc}</p>
        </div>
      ))}
    </div>
  );
}

function renderParagraphs(items: string[], sectionNumber: string, startOffset = 0) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <p key={item} className="flex gap-2.5 text-[13px] leading-6 text-slate-600 sm:text-sm">
          <span className="shrink-0 font-semibold text-slate-500">
            {sectionNumber}.{i + 1 + startOffset}
          </span>
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

export default function DeliveryShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="mx-auto max-w-[1240px] px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Delivery &amp; Shipping Policy</span>
        </nav>

        <article className="rounded-[8px] border border-slate-200 bg-white px-4 py-7 shadow-sm sm:px-6 lg:px-7">
          <div className="mb-8 border-b border-slate-100 pb-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              F2H — Farm to Home
            </p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-[28px]">
              Delivery &amp; Shipping Policy
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Last updated: August 2026 • Verified Delivery Windows, Coverage Zones &amp; Cold-Chain Protocols
            </p>
          </div>

          <div className="space-y-7">
            {sections.map((section, index) => {
              const [sectionNumber, ...sectionTitleParts] = section.title.split(". ");
              const sectionTitle = sectionTitleParts.join(". ");
              const hasShifts = section.id === "delivery-shifts" && section.shifts;

              return (
                <section
                  key={section.id}
                  id={section.id}
                  className={`scroll-mt-28 ${index === 0 ? "" : "border-t border-slate-100 pt-7"}`}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                      {sectionNumber}
                    </span>
                    <h2 className="pt-0.5 text-[15px] font-bold leading-6 tracking-normal text-slate-950 sm:text-base">
                      {sectionTitle}
                    </h2>
                  </div>

                  <div className="ml-10 border-l border-emerald-100 pl-4">
                    {hasShifts ? (
                      <>
                        {section.paragraphs && section.paragraphs[0] && (
                          <p className="flex gap-2.5 text-[13px] leading-6 text-slate-600 sm:text-sm mb-3">
                            <span className="shrink-0 font-semibold text-slate-500">{sectionNumber}.1</span>
                            <span>{section.paragraphs[0]}</span>
                          </p>
                        )}
                        <ShiftCards shifts={section.shifts!} />
                        {section.paragraphs && section.paragraphs.slice(1).length > 0 && (
                          renderParagraphs(section.paragraphs.slice(1), sectionNumber, 1)
                        )}
                      </>
                    ) : (
                      section.paragraphs && renderParagraphs(section.paragraphs, sectionNumber)
                    )}

                    {section.note ? (
                      <p className="mt-4 rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-medium leading-6 text-emerald-900 shadow-[inset_3px_0_0_0_rgba(5,150,105,0.35)] sm:text-sm">
                        {section.note}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}

            {/* Official Support Details Card */}
            <div className="mt-8 rounded-[12px] border border-emerald-200 bg-emerald-50/60 p-6">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Truck className="text-emerald-700" size={18} />
                Delivery Support &amp; Official Contact Details
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li><span className="font-semibold text-slate-900">Email:</span> &nbsp;support@f2hfresh.com</li>
                <li><span className="font-semibold text-slate-900">Primary Phone:</span> &nbsp;+91 91487 73591</li>
                <li><span className="font-semibold text-slate-900">Secondary Phone:</span> &nbsp;+91 79893 68142</li>
                <li><span className="font-semibold text-slate-900">WhatsApp:</span> &nbsp;+91 91487 73591</li>
                <li><span className="font-semibold text-slate-900">Operating Support Hours:</span> &nbsp;5:00 AM – 9:00 PM IST (All 7 Days)</li>
                <li><span className="font-semibold text-slate-900">Registered Office:</span> &nbsp;1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066, Karnataka, India</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
