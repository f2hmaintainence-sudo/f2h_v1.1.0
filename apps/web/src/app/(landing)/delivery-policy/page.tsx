"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

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
    title: "1. Overview",
    paragraphs: [
      "This Delivery & Shipping Policy (\"Policy\") explains how F2H — Farm to Home (\"F2H\", \"We\", \"Us\") delivers Products ordered through the Platform (website, mobile app, and sub-domains), including delivery shifts, coverage areas, timelines, and what happens if a delivery cannot be completed.",
      "This Policy forms part of, and must be read together with, the F2H Terms and Conditions and the Cancellation & Refund Policy. In the event of a conflict between this Policy and the Terms and Conditions on matters relating specifically to delivery, this Policy shall prevail.",
      "F2H does not use third-party couriers or postal shipping. All Products are delivered directly by F2H's own delivery riders or authorized delivery partners, within the coverage zones listed on the Platform.",
    ],
  },
  {
    id: "delivery-shifts",
    title: "2. Delivery Shifts & Timelines",
    paragraphs: [
      "F2H operates two daily delivery shifts:",
      "Delivery timings are estimates based on normal operating conditions. Actual delivery time may vary due to weather, traffic, local disruptions, or other circumstances beyond F2H's reasonable control, though F2H targets on-time delivery for every order.",
      "Orders are auto-generated for the next applicable shift based on Your active subscription. You can pause, skip, or modify an upcoming delivery through the Platform before the cut-off time shown for that shift.",
    ],
    shifts: [
      {
        icon: "sun",
        label: "Morning Shift",
        time: "Before 7:00 AM",
        desc: "Milk is collected from partner farms at approximately 4:00 AM and delivered to Your doorstep before 7:00 AM.",
      },
      {
        icon: "moon",
        label: "Evening Shift",
        time: "Select Zones",
        desc: "Available in select zones; delivery timing is shown on the Platform at the time of subscription.",
      },
    ],
  },
  {
    id: "coverage-zones",
    title: "3. Coverage Zones",
    paragraphs: [
      "F2H currently delivers only within the localities listed as active coverage zones on the Platform. Coverage is added periodically as F2H expands.",
      "If Your address falls outside an active coverage zone, You may register interest on the Platform, and F2H will notify You once delivery becomes available in Your area. F2H is not obligated to deliver to unserviceable addresses.",
      "Serviceability of a specific address within a listed zone (e.g., gated communities, restricted-access buildings) may be confirmed only at the time of the first delivery attempt. See Section 6 for the process if an address is found unserviceable.",
    ],
  },
  {
    id: "cut-off-times",
    title: "4. Order Cut-Off Times",
    paragraphs: [
      "To be included in the next Morning Shift delivery, orders, pauses, or modifications must be made by the cut-off time shown on the Platform (indicatively 9:00 PM the previous night).",
      "To be included in the next Evening Shift delivery, orders, pauses, or modifications must be made by the cut-off time shown on the Platform (indicatively 10:00 AM the same day).",
      "Requests made after the applicable cut-off will be processed for the following delivery shift.",
    ],
  },
  {
    id: "process-tracking",
    title: "5. Delivery Process & Tracking",
    paragraphs: [
      "Every delivery follows the same cold-chain process: milk collection at the farm, quality testing and tamper-proof packaging, sorting at the local hub, and dispatch by a GPS-tracked delivery rider.",
      "Cold chain is maintained throughout, with Products kept between 2–6°C from collection until doorstep delivery.",
      "You will receive WhatsApp notifications at key stages — collection, dispatch, and doorstep arrival — for both morning and evening shifts.",
      "Deliveries are made with photo proof of delivery wherever applicable.",
    ],
  },
  {
    id: "unattended-deliveries",
    title: "6. Unattended or Failed Deliveries",
    paragraphs: [
      "If nobody is available to receive the delivery, the rider will attempt to leave the Product at the doorstep or designated safe location, where it is safe and hygienic to do so (subject to Your delivery preferences set on the Platform).",
      "For fresh dairy Products (Milk, Curd, Paneer, and similar), if delivery cannot be completed because the address is inaccessible, incorrect, or the recipient is unreachable, the order may be treated as refused at delivery. Please refer to the Cancellation & Refund Policy for the applicable charges and refund treatment in such cases.",
      "If F2H's logistics partner determines, at the point of delivery, that Your address is genuinely unserviceable, F2H will notify You and process the applicable refund in accordance with the Cancellation & Refund Policy.",
      "Repeated failed deliveries due to reasons within Your control (e.g., wrong address, unavailability) may result in F2H pausing or restricting Your subscription until the issue is resolved.",
    ],
  },
  {
    id: "delivery-charges",
    title: "7. Delivery Charges",
    paragraphs: [
      "F2H does not currently charge a separate delivery fee for orders within active coverage zones; delivery is included as part of Your subscription. Any change to this will be communicated on the Platform before it takes effect.",
      "F2H reserves the right to introduce delivery charges for specific zones, order values, or delivery slots in the future, with such charges clearly shown at checkout before You confirm an order.",
    ],
  },
  {
    id: "delays-exceptions",
    title: "8. Delays & Exceptions",
    paragraphs: [
      "While F2H targets on-time delivery for every order, delivery may occasionally be delayed due to reasons beyond F2H's reasonable control, including but not limited to severe weather, public holidays, local restrictions, farm-side supply issues, or force majeure events.",
      "In case of an anticipated delay, F2H will make reasonable efforts to notify You via WhatsApp or the Platform.",
      "Where a delay results in non-delivery for a shift, the applicable refund or wallet credit will be processed in accordance with the Cancellation & Refund Policy.",
    ],
  },
  {
    id: "policy-changes",
    title: "9. Changes to This Policy",
    paragraphs: [
      "F2H reserves the right to modify or amend this Policy at any time, for legal, operational, or business reasons, including changes to coverage zones, shift timings, or cut-off windows. Updated versions will be posted on the Platform and will take effect from the date of posting. Your continued use of the Platform after such changes constitutes acceptance of the updated Policy.",
    ],
    note: "This Policy does not affect any statutory rights You may have under applicable consumer protection law, which shall continue to apply regardless of anything stated above.",
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
          <p className="text-sm font-semibold text-slate-800 mb-0.5">{shift.label}</p>
          <p className="text-[11px] font-medium text-emerald-700 mb-1.5">{shift.time}</p>
          <p className="text-[12.5px] leading-5 text-slate-500">{shift.desc}</p>
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
                        {/* 2.1 intro paragraph */}
                        {section.paragraphs && section.paragraphs[0] && (
                          <p className="flex gap-2.5 text-[13px] leading-6 text-slate-600 sm:text-sm mb-3">
                            <span className="shrink-0 font-semibold text-slate-500">{sectionNumber}.1</span>
                            <span>{section.paragraphs[0]}</span>
                          </p>
                        )}
                        {/* Shift cards */}
                        <ShiftCards shifts={section.shifts!} />
                        {/* 2.2 and 2.3 paragraphs */}
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

            {/* Customer Support Card */}
            <div className="mt-8 rounded-[12px] border border-emerald-200 bg-emerald-50/60 p-6">
              <h3 className="text-base font-bold text-slate-900 mb-3">Customer Support</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li><span className="font-semibold text-slate-900">Email:</span> &nbsp;support@f2hfresh.com</li>
                <li><span className="font-semibold text-slate-900">Primary Phone:</span> &nbsp;+91 91487 73591</li>
                <li><span className="font-semibold text-slate-900">Secondary Phone:</span> &nbsp;+91 79893 68142</li>
                <li><span className="font-semibold text-slate-900">WhatsApp:</span> &nbsp;Message us on WhatsApp via the number listed on the Platform</li>
                <li><span className="font-semibold text-slate-900">In-app:</span> &nbsp;Help &amp; Support section on the F2H app</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
