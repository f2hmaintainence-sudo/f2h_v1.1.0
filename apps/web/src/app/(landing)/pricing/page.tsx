"use client";

import Link from "next/link";
import { ChevronRight, Home, CheckCircle2, ShieldCheck, Zap, Sparkles, ShoppingBag, ArrowRight } from "lucide-react";
import { F2H_CUSTOMER_PLAYSTORE_URL } from "@/constants/f2hPublicAssets";

const catalogProducts = [
  {
    category: "Fresh Farm Dairy",
    items: [
      {
        name: "Fresh Cow Milk (500 ml)",
        description: "100% pure, unadulterated cow milk delivered fresh within 3 hours of farm collection.",
        unitPrice: "₹40",
        subscriptionPrice: "₹35",
        mrp: "₹50",
        unit: "per 500ml pouch",
        popular: true,
        tag: "Daily Essential",
      },
      {
        name: "Fresh Cow Milk (1 Litre)",
        description: "Natural raw cow milk chilled at 2–6°C immediately after collection to retain vital nutrients.",
        unitPrice: "₹76",
        subscriptionPrice: "₹72",
        mrp: "₹80",
        unit: "per 1L pouch",
        popular: false,
        tag: "Best Value",
      },
      {
        name: "F2H Fresh Homemade Curd (500 ml)",
        description: "Thick, creamy, naturally set curd rich in beneficial probiotics and gut-friendly cultures.",
        unitPrice: "₹55",
        subscriptionPrice: "₹50",
        mrp: "₹60",
        unit: "per 500ml cup",
        popular: false,
        tag: "Probiotic Rich",
      },
      {
        name: "F2H Fresh Homemade Curd (1 Litre)",
        description: "Farm-fresh curd prepared without artificial thickeners or chemical preservatives.",
        unitPrice: "₹95",
        subscriptionPrice: "₹90",
        mrp: "₹100",
        unit: "per 1L container",
        popular: false,
        tag: "Family Pack",
      },
      {
        name: "F2H Fresh Malai Paneer (200 g)",
        description: "Soft, handcrafted cottage cheese made from pure whole cow milk. Zero starch, zero adulteration.",
        unitPrice: "₹120",
        subscriptionPrice: "₹115",
        mrp: "₹140",
        unit: "per 200g pack",
        popular: true,
        tag: "High Protein",
      },
      {
        name: "F2H Fresh Malai Paneer (500 g)",
        description: "Freshly coagulated cottage cheese, packed fresh for cooking premium gravies and snacks.",
        unitPrice: "₹252",
        subscriptionPrice: "₹240",
        mrp: "₹300",
        unit: "per 500g pack",
        popular: false,
        tag: "Chef's Choice",
      },
      {
        name: "F2H Pure Desi Cow Ghee (500 g)",
        description: "Traditional bilona-style clarified butter with rich golden aroma and natural granular texture.",
        unitPrice: "₹600",
        subscriptionPrice: "₹570",
        mrp: "₹700",
        unit: "per 500g jar",
        popular: true,
        tag: "Aromatic & Pure",
      },
      {
        name: "F2H Pure Desi Cow Ghee (1 kg)",
        description: "Slow-simmered pure cow ghee packed with fat-soluble vitamins A, D, E, and K.",
        unitPrice: "₹1,200",
        subscriptionPrice: "₹1,150",
        mrp: "₹1,500",
        unit: "per 1kg jar",
        popular: false,
        tag: "Max Savings",
      },
    ],
  },
  {
    category: "Cold-Pressed Oils & Dry Fruits",
    items: [
      {
        name: "F2H Cold-Pressed Groundnut Oil (1 L)",
        description: "Extracted using traditional wooden expellers (Marachekku) at low heat to preserve heart-healthy fats.",
        unitPrice: "₹380",
        subscriptionPrice: "₹360",
        mrp: "₹420",
        unit: "per 1L bottle",
        popular: false,
        tag: "100% Wood-Pressed",
      },
      {
        name: "Premium Almonds (1 kg)",
        description: "California-grade premium crunchy almonds, packed with antioxidants, fiber, and healthy fats.",
        unitPrice: "₹1,000",
        subscriptionPrice: "₹950",
        mrp: "₹2,000",
        unit: "per 1kg pack",
        popular: false,
        tag: "50% Off MRP",
      },
      {
        name: "Premium Cashews W320 (1 kg)",
        description: "Whole, unbroken, grade-W320 king cashews with naturally sweet and buttery crunch.",
        unitPrice: "₹1,050",
        subscriptionPrice: "₹999",
        mrp: "₹1,500",
        unit: "per 1kg pack",
        popular: false,
        tag: "Grade W320",
      },
      {
        name: "Premium Dry Fruits Mega Combo (1 kg)",
        description: "Curated assortment of premium Almonds, Cashews, Raisins, and Pistachios.",
        unitPrice: "₹1,199",
        subscriptionPrice: "₹1,149",
        mrp: "₹1,499",
        unit: "per combo pack",
        popular: true,
        tag: "Bestseller Combo",
      },
    ],
  },
];

const subscriptionPlans = [
  {
    title: "Daily Morning Drop",
    badge: "Most Popular",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description: "Guaranteed doorstep delivery every morning before 7:00 AM.",
    benefits: [
      "Zero (₹0) delivery charges every single day",
      "Special discounted subscription rate on every item",
      "Pause, resume, or change quantity anytime up to 9:00 PM",
      "Automatic doorstep delivery in insulated milk bag",
      "2-Hour wallet refund guarantee on any issue",
    ],
    highlight: true,
  },
  {
    title: "Alternate Days Plan",
    badge: "Flexible",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    description: "Receive fresh milk and dairy every alternate day (e.g. Mon / Wed / Fri / Sun).",
    benefits: [
      "Zero (₹0) delivery fee on active schedules",
      "Exclusive subscription discounts applied automatically",
      "Add one-time extra milk or paneer whenever guests visit",
      "Pause anytime during vacations with one tap",
      "Full tracking via mobile app and WhatsApp alerts",
    ],
    highlight: false,
  },
  {
    title: "Custom Schedule / Postpaid",
    badge: "Corporate & Family",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Pick your own delivery days (e.g. Weekdays only) or sign up for monthly postpaid credit.",
    benefits: [
      "Custom day selection per product item",
      "Detailed monthly itemized tax invoice & ledger download",
      "Seamless Razorpay AutoPay / UPI e-mandate support",
      "Dedicated priority customer support manager",
      "Cancel or modify anytime without lock-in contracts",
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="mx-auto max-w-[1240px] px-3 pb-16 pt-28 sm:px-4 lg:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Pricing &amp; Plans</span>
        </nav>

        {/* Hero Banner */}
        <div className="mb-10 rounded-[18px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/50 to-white p-6 sm:p-10 shadow-sm">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/70 px-3.5 py-1 text-xs font-bold text-emerald-800 mb-3">
              <Sparkles size={13} />
              Transparent Pricing &amp; Zero Hidden Fees
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Fresh Farm Dairy Pricing &amp; Subscription Plans
            </h1>
            <p className="mt-3 text-xs sm:text-sm sm:leading-relaxed text-slate-600">
              All our prices are 100% transparent and inclusive of all applicable taxes. Enjoy zero delivery charges, guaranteed fresh morning deliveries before 7:00 AM, and flexible subscription discounts.
            </p>
          </div>
        </div>

        {/* Subscription Plan Overview Cards */}
        <div className="mb-14">
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-950">Subscription Options</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Choose how often you want fresh farm milk delivered to your doorstep.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.title}
                className={`relative flex flex-col justify-between rounded-[18px] border p-6 transition-all ${
                  plan.highlight
                    ? "border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${plan.badgeColor}`}>
                      {plan.badge}
                    </span>
                    {plan.highlight && (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <Zap size={12} className="fill-emerald-600" /> ₹0 Delivery Fee
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1.5">{plan.title}</h3>
                  <p className="text-xs text-slate-600 mb-5 leading-relaxed">{plan.description}</p>

                  <div className="border-t border-slate-100 pt-4 mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">What is included:</p>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {plan.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <a
                  href={F2H_CUSTOMER_PLAYSTORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full text-center rounded-xl py-2.5 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? "bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  <ShoppingBag size={14} />
                  Subscribe on Mobile App
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Product Catalog & Price Tables */}
        <div className="space-y-12">
          {catalogProducts.map((group) => (
            <div key={group.category} className="rounded-[18px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-950">{group.category}</h2>
                  <p className="text-xs text-slate-500">Pure, lab-tested, unadulterated essentials direct from partner farms.</p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full w-fit">
                  Morning &amp; Evening Delivery
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-emerald-200 hover:bg-white"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{item.name}</h3>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full shrink-0">
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">{item.description}</p>
                    </div>

                    <div className="flex items-end justify-between border-t border-slate-200/60 pt-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg sm:text-xl font-extrabold text-slate-950">{item.subscriptionPrice}</span>
                          <span className="text-xs text-slate-400 line-through">{item.mrp}</span>
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.2 rounded">
                            Save {parseInt(item.mrp.replace(/\D/g, "")) - parseInt(item.subscriptionPrice.replace(/\D/g, "")) > 0 ? `₹${parseInt(item.mrp.replace(/\D/g, "")) - parseInt(item.subscriptionPrice.replace(/\D/g, ""))}` : "More"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">Regular one-time: {item.unitPrice} ({item.unit})</p>
                      </div>

                      <a
                        href={F2H_CUSTOMER_PLAYSTORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 transition-colors"
                      >
                        Order →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Policy Highlights & Razorpay Verification Assurances */}
        <div className="mt-12 rounded-[16px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="text-emerald-700" size={20} />
            Billing Terms, Payment Modes &amp; Refund Guarantee
          </h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-bold text-slate-900 text-xs sm:text-sm mb-1">1. ₹0 Delivery Fee</p>
              <p className="text-slate-600 leading-relaxed">
                Active daily or custom scheduled subscriptions come with completely free doorstep delivery. No surge or handling fees.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-bold text-slate-900 text-xs sm:text-sm mb-1">2. Secure Online Payments</p>
              <p className="text-slate-600 leading-relaxed">
                We accept UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and AutoPay e-mandates processed securely via Razorpay PCI-DSS certified gateway.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-bold text-slate-900 text-xs sm:text-sm mb-1">3. 2-Hour Wallet Refund</p>
              <p className="text-slate-600 leading-relaxed">
                Any verified cancellation before cut-off or damaged milk delivery is credited back to your F2H Wallet within 2 hours.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-bold text-slate-900 text-xs sm:text-sm mb-1">4. Inclusive of All Taxes</p>
              <p className="text-slate-600 leading-relaxed">
                All prices shown across our catalog and invoices are 100% inclusive of all applicable Goods &amp; Services Tax (GST).
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-6 gap-4">
            <p className="text-xs text-slate-500">
              Need custom volume pricing for offices, catering, or bulk supply?
            </p>
            <Link
              href="/contact-us"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              Contact our corporate desk <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
