"use client";

import { motion } from "framer-motion";
import {
  Clock,
  ShoppingBag,
  CreditCard,
  Pause,
  FileText,
} from "lucide-react";
import { EyebrowPill } from "./EyebrowPill";

const benefits = [
  {
    icon: Clock,
    title: "Everyday Reliability",
    body: "Rain, shine, or public holidays — your farm-fresh milk is guaranteed to arrive consistently every single day",
  },
  {
    icon: ShoppingBag,
    title: "Eco-Friendly Packaging",
    body: "Recyclable, food-safe pouches with minimal plastic — good for your family and the planet",
  },
  {
    icon: CreditCard,
    title: "Cashless Payments",
    body: "UPI, cards, net banking — all payment modes supported with automated monthly billing",
  },
  {
    icon: Pause,
    title: "Pause Anytime",
    body: "No penalties for pausing. Skip a day or a week whenever you need a break",
  },
  {
    icon: FileText,
    title: "Transparent Billing",
    body: "Monthly invoice with clear breakdown — exactly what you ordered, exactly what you pay",
  },
];

export function DeliveryBenefits() {
  return (
    <section
      id="benefits"
      className="relative overflow-hidden py-20 md:py-24 px-4 sm:px-6 lg:px-[7%] bg-[linear-gradient(165deg,#0d3d1a_0%,#143d1c_45%,#0a2810_100%)]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(45, 138, 69, 0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(240, 165, 0, 0.12), transparent)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-14"
        >
          <div className="flex justify-center mb-4">
            <EyebrowPill label="Benefits" variant="gold" className="bg-white/[0.06]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            What Makes Our Delivery{" "}
            <em className="not-italic text-gold">Special</em>
          </h2>
          <div className="mx-auto mt-5 h-px w-20 rounded-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5">
          {benefits.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i, duration: 0.4 }}
                className="group relative flex h-full flex-col rounded-2xl border border-white/[0.1] bg-white/[0.04] p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all duration-300 hover:border-gold/35 hover:bg-white/[0.07] hover:shadow-[0_16px_40px_rgba(0,0,0,0.28)] hover:-translate-y-1"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-gold/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="mx-auto mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-fresh-green/25 to-white/[0.06] text-gold shadow-inner transition-all duration-300 group-hover:scale-105 group-hover:border-fresh-green/50 group-hover:bg-fresh-green/20 group-hover:text-white group-hover:shadow-[0_8px_24px_rgba(45,138,69,0.35)]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="mb-2 text-sm font-bold leading-snug text-white sm:text-[0.95rem]">
                  {item.title}
                </h3>
                <p className="text-[0.8rem] leading-relaxed text-white/55 sm:text-[0.82rem]">
                  {item.body}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default DeliveryBenefits;
