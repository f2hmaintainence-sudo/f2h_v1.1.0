"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, Transition } from "framer-motion";
import { F2H_PUBLIC } from "@/constants/f2hPublicAssets";
import { ContactUsEnquiryForm } from "./ContactUsEnquiryForm.client";
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.6,
    delay,
    ease: [0.22, 1, 0.36, 1],
  } as Transition,
});

export function Hero() {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll form into view smoothly — critical for mobile where the form is below the fold
  const openAndScrollToForm = useCallback(() => {
    setShowForm(true);
    // Timeout allows React to mount the form before scrolling
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  useEffect(() => {
    window.addEventListener("open-hero-form", openAndScrollToForm);
    return () => window.removeEventListener("open-hero-form", openAndScrollToForm);
  }, [openAndScrollToForm]);

  return (
    <section
      id="home"
      className="relative flex flex-col min-h-[80vh] md:min-h-screen overflow-hidden"
    >
      {/* ── Mobile gradient bg ── */}
      <div className="absolute inset-0 block md:hidden bg-gradient-to-b from-[#f9f6ef] to-[#e8f5ec]" />

      {/* ── Desktop: background image + left warm overlay ── */}
      <div className="absolute inset-0 hidden md:flex z-0 f2h-media-reset">
        <img
          src={F2H_PUBLIC.heroBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
          aria-hidden
        />
        {/* Glowing white effect localized exactly behind the text */}
        <div className="absolute top-[50%] md:top-[45%] left-1/2 md:left-[10%] -translate-x-1/2 md:-translate-x-[20%] -translate-y-1/2 w-[600px] h-[600px] md:w-[700px] md:h-[700px] bg-white/85 blur-[100px] md:blur-[130px] rounded-full pointer-events-none opacity-90 md:opacity-100" />
      </div>

      {/* ── Main hero content ── */}
      <div className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 pt-24 pb-10 md:pt-28 md:pb-12 flex items-center">
        <div className="md:grid md:grid-cols-2 md:gap-10 md:items-center flex flex-col items-center text-center md:text-left w-full">

          {/* LEFT COLUMN */}
          <div className="max-w-[560px] w-full">

            {/* Badge */}
            <motion.div
              {...fadeUp(0)}
              className="inline-flex items-center gap-2 bg-white border border-[#2d7a3a]/20 text-[#0d3d1a] px-4 py-2 rounded-full text-sm font-semibold mb-6 shadow-sm"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#2d7a3a] shadow-[0_0_6px_#2d7a3a] shrink-0 animate-pulse" />
              Since 2021 • Trusted by 2000+ Families
            </motion.div>

            {/* Headline */}
            <motion.h1
              {...fadeUp(0.15)}
              className="text-[2.6rem] md:text-[3.2rem] lg:text-[3.8rem] font-extrabold text-[#0d3d1a] leading-[1.08] tracking-tight mb-5"
            >
              <span className="flex flex-wrap items-center gap-x-3 justify-center md:justify-start">
                <span>Fresh from Farm</span>
              </span>
              <span className="block mt-1">
                to Your{" "}
                <span className="relative inline-block text-[#c8922a]">
                  Doorstep
                  {/* Brush-stroke SVG underline */}
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-[6px] left-0 w-full overflow-visible pointer-events-none"
                    viewBox="0 0 220 14"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M3 10 C18 4, 55 12, 90 8 C125 4, 160 11, 195 7 C203 5.5, 210 8, 217 7"
                      stroke="#c8922a"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 13 C50 9, 120 13, 210 10"
                      stroke="#c8922a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.4"
                    />
                  </svg>
                </span>
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              {...fadeUp(0.3)}
              className="text-[0.95rem] md:text-lg text-[#3a4a3e] font-medium max-w-md mb-8 leading-relaxed"
            >
              Subscribe once. Get fresh milk delivered
              <br className="hidden sm:block" />
              {" "}every morning automatically.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              {...fadeUp(0.42)}
              className="flex flex-col gap-3 w-full md:flex-row md:w-auto md:gap-4 mb-8 justify-center md:justify-start"
            >
              <button
                type="button"
                onClick={() => window.open("https://play.google.com/store/apps/details?id=in.swiggy.android", "_blank")}
                className="group flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#c8922a] text-white font-bold text-[1.05rem] shadow-[0_4px_20px_rgba(200,146,42,0.45)] hover:bg-[#b5811f] hover:shadow-[0_6px_24px_rgba(200,146,42,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
              >
                Get Fresh Farm Milk
                <span className="inline-block transition-transform group-hover:translate-x-1 duration-200">→</span>
              </button>

              <button
                type="button"
                onClick={() => window.open("https://play.google.com/store/apps/details?id=in.swiggy.android", "_blank")}
                className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-white border border-[#0d3d1a]/20 text-[#0d3d1a] font-semibold text-[1.05rem] hover:bg-gray-50 hover:border-[#0d3d1a]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-sm"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#c8922a] shrink-0"
                >
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v4" />
                  <circle cx="7" cy="17" r="2" />
                  <circle cx="18" cy="17" r="2" />
                  <path d="M14 17h-5" />
                  <path d="M19 17h2" />
                  <path d="M14 5v6h7" />
                </svg>
                Become a Customers
              </button>
            </motion.div>

            {/* 3-stat floating row */}
            <motion.div {...fadeUp(0.56)} className="w-full max-w-[560px] mt-2 mb-8 md:mb-0">
              <div
                className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-6 sm:gap-10"
                role="list"
                aria-label="Service guarantees"
              >
                {[
                  {
                    icon: (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13" rx="2" />
                        <path d="M16 8h4l3 4v4h-7z" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    ),
                    title: "10,000+",
                    sub: "Daily Deliveries",
                  },
                  {
                    icon: (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2h8l2 6H6L8 2z" />
                        <path d="M6 8c0 8 2 12 6 12s6-4 6-12" />
                        <path d="M10 12h4" />
                      </svg>
                    ),
                    title: "Fresh",
                    sub: "Every Morning",
                  },
                  {
                    icon: (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    ),
                    title: "2-Hour",
                    sub: "Refund Guarantee",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    role="listitem"
                    className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left"
                  >
                    <span className="flex shrink-0 text-[#c8922a]">
                      {item.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[1.05rem] font-extrabold text-[#0d3d1a] leading-none tracking-tight">
                        {item.title}
                      </span>
                      <span className="text-[0.8rem] font-semibold text-[#0d3d1a]/80 mt-1 leading-none">
                        {item.sub}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN – Enquiry Form */}
          <div ref={formRef} className="w-full max-w-md ml-auto relative z-20 mt-10 md:mt-0 flex items-center justify-center">
            {showForm && (
              <motion.div {...fadeUp(0)} className="w-full">
                <ContactUsEnquiryForm onSuccess={() => setShowForm(false)} />
              </motion.div>
            )}
          </div>
        </div>
      </div>


    </section>
  );
}

export default Hero;
