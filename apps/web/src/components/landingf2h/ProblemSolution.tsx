"use client";

import { motion } from "framer-motion";
import { F2H_PUBLIC } from "@/constants/f2hPublicAssets";
import { MapPinOff, Frown, Wallet, CalendarX, MapPin, Milk, Zap, Smartphone } from "lucide-react";

const problems = [
  { icon: <MapPinOff className="w-6 h-6 text-red-500" strokeWidth={2} />, text: "No idea if milk is coming — zero visibility" },
  { icon: <Frown className="w-6 h-6 text-orange-500" strokeWidth={2} />, text: "Different vendor every week — inconsistent quality" },
  { icon: <Wallet className="w-6 h-6 text-red-400" strokeWidth={2} />, text: "No refund when milk is late or sour" },
  { icon: <CalendarX className="w-6 h-6 text-gray-500" strokeWidth={2} />, text: "Have to remember to order every single day" },
];

const solutions = [
  { icon: <MapPin className="w-6 h-6 text-fresh-green" strokeWidth={2.5} />, text: "Live GPS tracking — see your delivery on the map" },
  { icon: <Milk className="w-6 h-6 text-blue-500" strokeWidth={2.5} />, text: "Consistently pure — sourced directly from the same trusted farms every day" },
  { icon: <Zap className="w-6 h-6 text-yellow-500" strokeWidth={2.5} />, text: "2-hour wallet refund — no questions asked" },
  { icon: <Smartphone className="w-6 h-6 text-purple-500" strokeWidth={2.5} />, text: "Set-and-forget subscription — easily pause or modify anytime via the app" },
];


export function ProblemSolution() {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden isolate">
      {/* Native img: avoids Next/Image + global `img { max-width:100%; height:auto }` conflicts from Bootstrap base styles */}
      <div className="absolute inset-0 z-0 pointer-events-none f2h-media-reset">
        <img
          src={F2H_PUBLIC.problemBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          decoding="async"
          aria-hidden
        />
      </div>
      <div className="absolute inset-0 z-[1] bg-cream/40 pointer-events-none" />

      <div className="relative z-[2] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-[rgba(58,140,85,0.1)] border border-[rgba(58,140,85,0.22)] text-[#2f7a48] px-4 py-1.5 rounded-full text-[0.9rem] font-semibold tracking-[0.08em] uppercase leading-none mb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <span className="w-[7px] h-[7px] rounded-full bg-[#3a8c55] inline-block" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
            WHY F2H?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-deep-green">
            The Problem We Solve
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          <div className="glass rounded-3xl p-7 md:p-8 border border-red-100/70 shadow-sm">
            <motion.h3
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-lg sm:text-xl font-extrabold text-red-600 mb-6 flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-full bg-red-100/80 flex items-center justify-center text-base">
                ✕
              </span>
              Without F2H
            </motion.h3>

            <div className="flex flex-col gap-4">
              {problems.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 * i, duration: 0.45 }}
                  className="rounded-2xl p-4 border border-red-100/65 bg-white/60"
                >
                  <div className="flex items-stretch gap-4">
                    <span className="shrink-0 flex items-center justify-center mt-0.5">
                      {item.icon}
                    </span>
                    <p className="text-muted font-semibold leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-7 md:p-8 border border-fresh-green/25 shadow-sm shadow-green-glow">
            <motion.h3
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-lg sm:text-xl font-extrabold text-fresh-green mb-6 flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-full bg-fresh-green/15 flex items-center justify-center text-base">
                ✓
              </span>
              With F2H
            </motion.h3>

            <div className="flex flex-col gap-4">
              {solutions.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 * i, duration: 0.45 }}
                  className="rounded-2xl p-4 border border-fresh-green/20 bg-white/60"
                >
                  <div className="flex items-stretch gap-4">
                    <span className="shrink-0 flex items-center justify-center mt-0.5">
                      {item.icon}

                    </span>
                    <p className="text-deep-green font-semibold leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProblemSolution;
