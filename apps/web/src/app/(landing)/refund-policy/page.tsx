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
    title: "1. Overview",
    paragraphs: [
      "This Cancellation & Refund Policy (\"Policy\") explains when and how You can cancel an order placed on the F2H - Farm to Home website, mobile application, or sub-domains (collectively, the \"Platform\"), and how refunds are calculated, processed, and paid out.",
      "This Policy forms part of, and must be read together with, the F2H Terms and Conditions and Privacy Policy. In the event of any conflict between this Policy and the Terms and Conditions on matters relating specifically to cancellations and refunds, this Policy shall prevail.",
    ],
  },
  {
    id: "cancellation-by-customer",
    title: "2. Cancellation by You",
    paragraphs: [
      "F2H delivers in two daily shifts — morning and evening. Orders for the morning shift must be placed, and may be cancelled free of charge, by 9:00 PM the previous night. Orders for the evening shift must be placed, and may be cancelled free of charge, by 10:00 AM the same day. (Note: these cut-off times are placeholders — please confirm and update with F2H's actual shift cut-offs.)",
      "Once the applicable cancellation window has passed, the order is handed over for processing and delivery, and can no longer be cancelled by You through the Platform. If You are unable to accept delivery after this point, please refer to Section 4 (Refusal at Delivery) below.",
    ],
    bullets: [
      "Subscriptions can be paused, modified, or cancelled at any time using the Platform, or by reaching out to customer support, subject to the applicable cut-off time shown on the Platform for that delivery cycle.",
      "You will not create multiple accounts at the same address to work around order or offer limits. If this is found, F2H reserves the right to cancel or merge the accounts and/or cancel the associated orders or subscriptions.",
    ],
  },
  {
    id: "cancellation-by-f2h",
    title: "3. Cancellation by F2H",
    paragraphs: [
      "F2H reserves the right to cancel an order, in full or in part, for reasons including but not limited to shortage or unavailability of a Product, a pricing or listing error, delivery-address serviceability issues, suspected fraud or misuse, or at Your request through customer support.",
      "If F2H cancels an order, You will not be charged for the cancelled portion, and any payment already made for it will be refunded in full, in accordance with Section 6 (Refund Timelines & Mode) below.",
    ],
  },
  {
    id: "refusal-at-delivery",
    title: "4. Refusal at Delivery",
    paragraphs: [
      "For fresh dairy orders — Milk, Curd, Paneer, and similar Products — specifically, if You decline to accept the order at the time of delivery, a Product Loss Charge of INR 100 (or such other amount as may be indicated on the Platform from time to time) will be applied. This charge reflects F2H's genuine pre-estimate of the loss incurred in preparing and attempting delivery of perishable goods, and is not a penalty.",
      "For other Product categories (Ghee, Kova, Carrot Halwa, Cold Pressed Oils, Dry Fruits), repeated or unreasonable refusal at delivery may result in restrictions on Your account or future Cash on Delivery eligibility, at F2H's discretion.",
    ],
  },
  {
    id: "unserviceable-address",
    title: "5. Refunds for Unserviceable Addresses",
    paragraphs: [
      "F2H and its logistics partners make every effort to deliver to the address You provide. In some cases, however, the serviceability of a location can only be confirmed once the logistics partner visits the address. If F2H determines that Your address is unserviceable, a full refund of the remaining wallet balance for that order (after deduction of any cashback already availed) will be processed to the original payment source.",
      "By using the Platform, You agree not to raise claims or disputes against F2H, its directors, employees, or logistics partners in relation to a genuine unserviceability determination made in good faith.",
    ],
  },
  {
    id: "returns-replacements",
    title: "6. Returns, Replacements & Quality Issues",
    paragraphs: [
      "Given the perishable and fast-moving nature of most Products sold on the Platform, delivered Products are generally non-returnable once accepted, except where they are damaged, defective, expired, or incorrectly delivered. No exchange or return will be accepted where the Product packaging has been opened, or the Product has been used or consumed, in part or otherwise.",
      "Returns will not be accepted solely on the ground that a Product was not required, or was not to Your taste; F2H reserves the right to decline such requests.",
    ],
    bullets: [
      "Quality issues with Milk, Curd, Paneer, and other fresh dairy Products must be reported to customer support within 24 hours of delivery.",
      "Quality issues with Ghee, Kova, Carrot Halwa, Cold Pressed Oils, Dry Fruits, and other non-perishable categories must be reported within 3 days of delivery.",
      "You may be asked to share order details, photographs, or other supporting information to help F2H verify a quality complaint before a replacement or refund is approved.",
    ],
  },
  {
    id: "refund-timelines",
    title: "7. Refund Timelines & Mode",
    paragraphs: [
      "Where a refund is approved — whether due to order cancellation, an unserviceable address, or a verified quality or delivery issue — the amount will be credited to Your F2H wallet or to Your original payment source, as chosen by You (where applicable), within 5-7 working days from the date F2H verifies and confirms the refund request.",
      "You acknowledge that once a refund is initiated by F2H, the time it takes to actually reflect in Your bank account or payment instrument is subject to the timelines of Your bank or payment gateway service provider, and is outside F2H's control.",
    ],
  },
  {
    id: "wallet-membership-refunds",
    title: "8. Wallet, Membership & Cashback Refunds",
    bullets: [
      "F2H Membership plans, once purchased, cannot be cancelled, transferred, or encashed. Where a Membership is on auto-renewal for an Unlimited Benefit plan and Your savings at the time of expiry are less than the amount paid, F2H will refund the difference directly to Your wallet; this benefit applies only to auto-renewed Unlimited Benefit plans.",
      "Cashback credited in relation to AutoPay activation or transactions is conditional on the AutoPay mandate remaining active. If the mandate is cancelled, disabled, or otherwise becomes inactive, F2H reserves the right to reverse, recover, or adjust the cashback previously credited.",
      "Referral bonuses and promotional wallet credits are non-transferable and cannot be exchanged for cash under any circumstances; they can only be used towards future purchases on the Platform.",
      "F2H reserves the right to withhold a discount, bonus, or cashback, or to debit an amount already credited, where it determines that these Terms or the applicable offer terms have been violated.",
    ],
  },
  {
    id: "nach-failed-transactions",
    title: "9. Refunds Relating to NACH Mandate Transactions",
    paragraphs: [
      "Transactions against a NACH Mandate are processed only on a Business Day. If a mandated transaction fails, it will not be retried within that calendar month, and any amount already deducted for a corresponding order that could not be fulfilled will be refunded in accordance with Section 7 above.",
      "F2H shall not be liable for, and will not refund, transactions that are processed because You failed to revoke a NACH Mandate at least two days prior to the next Due Date; such processed transactions are treated as valid and binding.",
    ],
  },
  {
    id: "how-to-request",
    title: "10. How to Request a Cancellation or Refund",
    paragraphs: [
      "Most cancellations can be completed directly on the Platform, within the applicable cut-off window. For refund requests relating to quality, delivery, or billing issues, please reach out to customer support with Your order ID and relevant details.",
    ],
    subsections: [
      {
        title: "Customer support",
        bullets: [
          "Email: support@f2hfresh.com",
          "Primary phone: +91 91487 73591",
          "Secondary phone: +91 79893 68142",
          "WhatsApp: Message us on WhatsApp via the number listed on the Platform",
          "In-app: Help & Support section on the F2H app",
        ],
      },
    ],
  },
  {
    id: "changes",
    title: "11. Changes to This Policy",
    paragraphs: [
      "F2H reserves the right to modify or amend this Policy at any time, for legal, operational, or business reasons. Updated versions will be posted on the Platform and will take effect from the date of posting. Your continued use of the Platform after such changes constitutes acceptance of the updated Policy.",
    ],
    note: "This Policy does not affect any statutory rights You may have under applicable consumer protection law, which shall continue to apply regardless of anything stated above.",
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
    <div className="min-h-screen bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="mx-auto max-w-[1240px] px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Cancellation & Refund Policy</span>
        </nav>

        <article className="rounded-[8px] border border-slate-200 bg-white px-4 py-7 shadow-sm sm:px-6 lg:px-7">
          <div className="mb-8 border-b border-slate-100 pb-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              F2H - Farm to Home
            </p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-[28px]">
              Cancellation & Refund Policy
            </h1>
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