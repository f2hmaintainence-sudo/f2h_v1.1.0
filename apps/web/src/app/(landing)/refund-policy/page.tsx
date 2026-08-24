"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type SubSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type PolicySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: SubSection[];
  note?: string;
};

const sections: PolicySection[] = [
  {
    id: "overview",
    title: "1. Overview & Commitment",
    paragraphs: [
      "This Cancellation & Refund Policy (\"Policy\") explains when and how You can cancel an order or modify a subscription placed on the F2H - Farm to Home website, mobile application, or sub-domains (collectively, the \"Platform\"), and how refunds are calculated, processed, and paid out.",
      "This Policy forms part of, and must be read together with, the F2H Terms and Conditions and Privacy Policy. In the event of any conflict between this Policy and the Terms and Conditions on matters relating specifically to cancellations and refunds, this Policy shall prevail.",
      "At F2H, we are committed to 100% customer satisfaction. If you ever receive a damaged, leaked, or compromised product, we guarantee a swift, hassle-free resolution with our 2-hour wallet refund turnaround.",
    ],
  },
  {
    id: "cancellation-by-customer",
    title: "2. Order & Subscription Cancellation Rules",
    paragraphs: [
      "F2H operates two daily delivery shifts — Morning and Evening. Due to the perishable nature of fresh farm milk and daily dairy staples, logistics and procurement schedules operate on strict daily cut-off windows:",
    ],
    bullets: [
      "Morning Shift Delivery (5:30 AM – 7:30 AM): Orders, pause requests, and quantity modifications must be placed or cancelled by 9:00 PM the previous night. Cancellations made before 9:00 PM are 100% free of charge.",
      "Evening Shift Delivery (5:00 PM – 7:30 PM): Orders, pause requests, and quantity modifications must be placed or cancelled by 10:00 AM the same day. Cancellations made before 10:00 AM are 100% free of charge.",
      "Post-Cut-Off Window: Once the respective cut-off time passes, farm collection, quality checks, and route packing commence immediately. At this stage, orders cannot be cancelled in the system. If you are unable to receive the order at delivery, please refer to Section 4 (Refusal at Delivery).",
      "Subscriptions: You may pause, resume, modify quantities, or cancel your recurring daily or alternate-day subscriptions at any time via the F2H mobile app before the applicable cut-off time.",
    ],
  },
  {
    id: "cancellation-by-f2h",
    title: "3. Cancellation by F2H",
    paragraphs: [
      "F2H reserves the right to cancel an order, in full or in part, in rare situations such as acute farm shortage, unserviceable adverse weather conditions, listed pricing/catalog typographical error, unserviceable delivery address, or suspected fraud.",
      "If F2H cancels an order or delivery shift, You will not be charged. Any prepaid deduction for the unfulfilled portion will be refunded in full automatically, in accordance with Section 7 (Refund Timelines & Mode) below.",
    ],
  },
  {
    id: "refusal-at-delivery",
    title: "4. Refusal of Delivery & Unattended Deliveries",
    paragraphs: [
      "For fresh dairy items (Milk, Curd, Paneer) that are customized and packed exclusively for your delivery slot, if a Customer refuses delivery at the doorstep without a verified quality defect, a Product Loss Charge of up to INR 100 may be levied to cover actual farm processing and logistics costs.",
      "To ensure uninterrupted morning delivery even if you are asleep, customers are encouraged to hang an insulated F2H milk bag outside the doorstep. The delivery rider will drop the order securely and upload photo confirmation.",
    ],
  },
  {
    id: "unserviceable-address",
    title: "5. Refunds for Unserviceable Addresses",
    paragraphs: [
      "F2H strives to expand coverage across Bangalore and serviceable hubs. If a customer recharges their wallet or places an order for an address that is subsequently verified as unserviceable by our logistics route planning, the entire remaining wallet balance will be refunded 100% back to the customer's original payment source without deductions.",
    ],
  },
  {
    id: "returns-replacements",
    title: "6. Quality Issues, Damaged Items & Returns",
    paragraphs: [
      "Due to the perishable nature and strict cold-chain requirements of milk and dairy products, physical returns of perishable items are not accepted once delivered and opened. However, we offer full replacements or refunds for verified quality concerns:",
    ],
    bullets: [
      "Fresh Milk & Perishable Dairy: Any issue relating to milk curdling upon initial boil, packaging leakage, or temperature compromise must be reported via the app or WhatsApp within 24 hours of delivery with photo proof.",
      "Ghee, Cold-Pressed Oils & Dry Fruits: Quality or packaging issues with non-perishable categories must be reported within 3 days (72 hours) of delivery.",
      "Verification Process: Our customer care team reviews the uploaded photo or batch number and immediately issues a replacement on the next shift or a full refund.",
    ],
  },
  {
    id: "refund-timelines",
    title: "7. Refund Timelines & Settlement Modes",
    paragraphs: [
      "Refunds are processed promptly based on the refund mode selected or applicable:",
    ],
    bullets: [
      "F2H In-App Wallet Refund (Turnaround: Within 2 Hours): Approved refunds for order cancellations, missing packets, or verified quality complaints are credited to your F2H Wallet within 2 hours. Wallet funds never expire and can be used immediately for future deliveries.",
      "Original Payment Source (Turnaround: 5 to 7 Business Days): In case of wallet balance encashment upon permanent account closure, or direct payment gateway reversals, refunds are initiated via Razorpay to your original payment method (Credit/Debit Card, NetBanking, UPI). The funds will reflect in your bank account within 5 to 7 working days, subject to your bank's clearance cycles.",
      "Zero Deduction on Legitimate Claims: No cancellation or processing fees are deducted for quality-related refunds or cancellations made prior to shift cut-off.",
    ],
  },
  {
    id: "wallet-membership-refunds",
    title: "8. Wallet, AutoPay & Referral Credits",
    bullets: [
      "Promotional Credits & Bonuses: Promotional credits, cashback bonuses, and referral rewards credited to your wallet are promotional in nature, cannot be transferred to another user, and cannot be encashed for physical cash.",
      "AutoPay / e-Mandate Cancellations: If you cancel an AutoPay mandate on Razorpay, upcoming scheduled orders will be processed only if your prepaid wallet balance has sufficient funds.",
      "Unused Prepaid Wallet Balance: Any deposited real-currency wallet balance (excluding promotional bonuses) can be refunded back to the source bank account upon written request to customer support.",
    ],
  },
  {
    id: "how-to-request",
    title: "9. How to Request a Cancellation or Refund",
    paragraphs: [
      "You can manage cancellations and request refunds through multiple easy channels:",
    ],
    subsections: [
      {
        title: "Official Support & Grievance Channels",
        bullets: [
          "In-App Support: Navigate to 'Profile' > 'Help & Support' in the F2H Mobile App",
          "WhatsApp Support: +91 91487 73591 (Instant Chat & Photo Upload)",
          "Customer Care Phone: +91 91487 73591 / +91 79893 68142",
          "Official Email: support@f2hfresh.com",
          "Grievance Officer: grievanceofficer@f2hfresh.com",
          "Operational Address: 1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore - 560066, Karnataka, India",
        ],
      },
    ],
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    paragraphs: [
      "F2H reserves the right to modify or update this Cancellation & Refund Policy from time to time in accordance with operational requirements and applicable e-commerce regulations. Any changes will be published directly on this page with an updated timestamp.",
    ],
    note: "This Policy complies with the Consumer Protection (E-Commerce) Rules, 2020 and does not limit your statutory rights under Indian law.",
  },
];

function renderBullets(items?: string[], sectionNumber?: string) {
  if (!items?.length) return null;

  return (
    <ul className="mt-3 space-y-3">
      {items.map((item, i) => (
        <li key={item} className="flex gap-2.5 text-[13px] leading-6 text-slate-600 sm:text-sm">
          <span className="shrink-0 font-semibold text-slate-500">
            {sectionNumber}.{i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function renderParagraphs(items?: string[], sectionNumber?: string) {
  if (!items?.length) return null;

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <p key={item} className="flex gap-2.5 text-[13px] leading-6 text-slate-600 sm:text-sm">
          <span className="shrink-0 font-semibold text-slate-500">
            {sectionNumber}.{i + 1}
          </span>
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

export default function CancellationRefundPolicyPage() {
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

      <div className="relative z-10 mx-auto max-w-[1240px] px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Cancellation &amp; Refund Policy</span>
        </nav>

        <article className="rounded-[8px] border border-slate-200 bg-white px-4 py-7 shadow-sm sm:px-6 lg:px-7">
          <div className="mb-8 border-b border-slate-100 pb-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              F2H - Farm to Home
            </p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-[28px]">
              Cancellation &amp; Refund Policy
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Last updated: August 2026 • Verified 2-Hour Wallet Refund &amp; 5–7 Day Bank Refund Timelines
            </p>
          </div>

          <div className="space-y-7">
            {sections.map((section, index) => {
              const [sectionNumber, ...sectionTitleParts] = section.title.split(". ");
              const sectionTitle = sectionTitleParts.join(". ");

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
                    {renderParagraphs(section.paragraphs, sectionNumber)}
                    {renderBullets(section.bullets, sectionNumber)}

                    {section.subsections?.map((subsection) => (
                      <div key={subsection.title} className="mt-4 rounded-[8px] border border-slate-100 bg-slate-50/80 p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-900">
                          {subsection.title}
                        </h3>
                        {renderParagraphs(subsection.paragraphs, sectionNumber)}
                        {renderBullets(subsection.bullets, sectionNumber)}
                      </div>
                    ))}

                    {section.note ? (
                      <p className="mt-4 rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-medium leading-6 text-emerald-900 shadow-[inset_3px_0_0_0_rgba(5,150,105,0.35)] sm:text-sm">
                        {section.note}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}