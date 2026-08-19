"use client";

import { motion } from "framer-motion";
import { Sprout, Truck, Recycle } from "lucide-react";
import { F2H_CUSTOMER_PLAYSTORE_URL } from "@/constants/f2hPublicAssets";

// ─── Asset map ────────────────────────────────────────────────────────────────
const ASSETS = {
  productBg: "/assets/productbg.webp",
  milk: "/assets/products/milk.webp",
  ghee: "/assets/products/ghee.webp",
  curd: "/assets/products/curd.webp",
  kova: "/assets/products/kova.webp",
  paneer: "/assets/products/paneer.webp",
  dryFruits: "/assets/products/dryfruits.webp",
  coldPressedOil: "/assets/products/coldpressedoil.webp",
  carrotHalwa: "/assets/products/carrothalwa.webp",
} as const;

// ─── Product data ──────────────────────────────────────────────────────────────
const products = [
  {
    name: "Milk",
    tagline: "Fresh dairy, delivered daily",
    badge: "Daily Staple",
    badgeColor: "bg-sky-100 text-sky-700 border-sky-200",
    image: ASSETS.milk,
    accent: "from-sky-50/60 to-white/40",
    glow: "group-hover:shadow-sky-200/60",
  },
  {
    name: "Ghee",
    tagline: "Traditional clarified butter",
    badge: "Best Seller",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    image: ASSETS.ghee,
    accent: "from-amber-50/60 to-white/40",
    glow: "group-hover:shadow-amber-200/60",
  },
  {
    name: "Curd",
    tagline: "Creamy, probiotic-rich curd",
    badge: "Fresh Daily",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    image: ASSETS.curd,
    accent: "from-emerald-50/60 to-white/40",
    glow: "group-hover:shadow-emerald-200/60",
  },
  {
    name: "Paneer",
    tagline: "Farm fresh cottage cheese",
    badge: "Farm Fresh",
    badgeColor: "bg-lime-100 text-lime-700 border-lime-200",
    image: ASSETS.paneer,
    accent: "from-lime-50/60 to-white/40",
    glow: "group-hover:shadow-lime-200/60",
  },
  {
    name: "Kova",
    tagline: "Rich, slow-cooked milk solids",
    badge: "Traditional",
    badgeColor: "bg-yellow-100 text-yellow-700 border-yellow-200",
    image: ASSETS.kova,
    accent: "from-yellow-50/60 to-white/40",
    glow: "group-hover:shadow-yellow-200/60",
  },
  {
    name: "Carrot Halwa",
    tagline: "Seasonal handcrafted sweet",
    badge: "Handcrafted",
    badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
    image: ASSETS.carrotHalwa,
    accent: "from-orange-50/60 to-white/40",
    glow: "group-hover:shadow-orange-200/60",
  },
  {
    name: "Cold Pressed Oil",
    tagline: "Pure oils, slow-pressed",
    badge: "Natural",
    badgeColor: "bg-green-100 text-green-700 border-green-200",
    image: ASSETS.coldPressedOil,
    accent: "from-green-50/60 to-white/40",
    glow: "group-hover:shadow-green-200/60",
  },
  {
    name: "Dry Fruits",
    tagline: "Premium nuts & dried fruits",
    badge: "Premium",
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
    image: ASSETS.dryFruits,
    accent: "from-rose-50/60 to-white/40",
    glow: "group-hover:shadow-rose-200/60",
  },
] as const;

// ─── Animation variants ────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const headingVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
} satisfies import("framer-motion").Variants;

// ─── Trigger hero form ─────────────────────────────────────────────────────────
function triggerHeroForm() {
  // Dispatch event — Hero's openAndScrollToForm handles both showing the form
  // AND smoothly scrolling to it (critical on mobile where form is below fold)
  window.dispatchEvent(new CustomEvent("open-hero-form"));
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function Products() {
  return (
    <section
      id="products"
      className="relative py-20 md:py-28 overflow-hidden"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
    >
      {/* ── Background image + overlay ── */}
      <div className="absolute inset-0 z-0">
        <img
          src={ASSETS.productBg}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {/* Soft warm overlay so glass cards pop */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f9f6ef]/80 via-[#edf7ed]/70 to-[#f2f9f3]/85" />
      </div>

      {/* ── Decorative blobs ── */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-[480px] h-[480px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #a8d5a2 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, #d4a843 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-14 md:mb-18"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          <motion.span
            variants={headingVariants}
            className="inline-flex items-center gap-2 bg-[rgba(58,140,85,0.1)] border border-[rgba(58,140,85,0.22)] text-[#2f7a48] px-4 py-1.5 rounded-full text-[0.9rem] font-semibold tracking-[0.08em] uppercase leading-none mb-5"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <span className="w-[7px] h-[7px] rounded-full bg-[#3a8c55] inline-block" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Our Products
          </motion.span>

          <motion.h2
            variants={headingVariants}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0d3d1a] leading-tight"
          >
            What You Can Order
          </motion.h2>

          <motion.p
            variants={headingVariants}
            className="mt-4 max-w-2xl mx-auto text-[#3a5c42] text-sm sm:text-base leading-relaxed"
            style={{ fontFamily: "system-ui, sans-serif", fontWeight: 400 }}
          >
            Beyond milk — explore fresh staples and specialty items from
            trusted local partners, all on one subscription-friendly platform.
          </motion.p>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={containerVariants}
        >
          {products.map((product) => (
            <motion.article
              key={product.name}
              variants={cardVariants}
              className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer
                backdrop-blur-md border border-white/60
                shadow-lg ${product.glow}
                transition-all duration-500 ease-out
                hover:-translate-y-2 hover:scale-[1.02]
                hover:shadow-2xl hover:border-white/80`}
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.42) 100%)",
              }}
            >
              {/* Badge */}
              <div className="absolute top-3 left-3 z-20">
                <span
                  className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${product.badgeColor}`}
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {product.badge}
                </span>
              </div>

              {/* Shimmer overlay on hover */}
              <div
                className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 60%)",
                }}
              />

              {/* Product image */}
              <div className={`relative w-full aspect-[4/3] overflow-hidden bg-gradient-to-br ${product.accent}`}>
                <img
                  src={product.image}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover
                    scale-100 group-hover:scale-110
                    transition-transform duration-700 ease-out"
                  loading="lazy"
                  decoding="async"
                />
                {/* Bottom fade into card body */}
                <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-white/80 to-transparent" />
              </div>

              {/* Card body */}
              <div className="relative z-10 px-4 pb-5 pt-3 text-center">
                <h3 className="text-sm sm:text-base font-bold text-[#0d3d1a] leading-tight mb-1">
                  {product.name}
                </h3>
                <p
                  className="text-[#4a6c52] text-[11px] sm:text-xs leading-snug"
                  style={{ fontFamily: "system-ui, sans-serif", fontWeight: 400 }}
                >
                  {product.tagline}
                </p>

                {/* Order CTA — appears on hover, scrolls to #contact */}
                <div className="mt-3 overflow-hidden">
                  <div
                    className="h-7 translate-y-8 group-hover:translate-y-0 opacity-0 group-hover:opacity-100
                      transition-all duration-400 ease-out"
                  >
                    <button
                      type="button"
                      onClick={() => window.open(F2H_CUSTOMER_PLAYSTORE_URL, "_blank")}
                      className="w-full text-[11px] font-bold tracking-wide rounded-xl
                        bg-[#0d3d1a] text-[#f5c842] py-1.5
                        hover:bg-[#1a6b2e] transition-colors"
                      style={{ fontFamily: "system-ui, sans-serif" }}
                    >
                      Order Now →
                    </button>
                  </div>
                </div>
              </div>

              {/* Decorative corner accent */}
              <div
                className="absolute bottom-0 right-0 w-16 h-16 opacity-10 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at bottom right, #1a6b2e, transparent)",
                }}
              />
            </motion.article>
          ))}
        </motion.div>

        {/* Bottom CTA strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <div
            className="backdrop-blur-md bg-white/50 border border-white/60 rounded-2xl px-8 py-5
              flex flex-col sm:flex-row items-center gap-4 sm:gap-8 shadow-lg"
          >
            {[
              { icon: <Sprout className="w-5 h-5 text-[#2f7a48]" strokeWidth={2.2} />, label: "100% Natural", sub: "No preservatives" },
              { icon: <Truck className="w-5 h-5 text-amber-600" strokeWidth={2.2} />, label: "Daily Delivery", sub: "Before 7 AM" },
              { icon: <Recycle className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />, label: "Eco Packaging", sub: "Sustainable choice" },
            ].map((feat) => (
              <div key={feat.label} className="flex items-center gap-3 text-center sm:text-left">
                <span className="w-10 h-10 rounded-xl bg-white/90 shadow-sm border border-white flex items-center justify-center shrink-0">
                  {feat.icon}
                </span>
                <div>
                  <p
                    className="text-xs font-bold text-[#0d3d1a]"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {feat.label}
                  </p>
                  <p
                    className="text-[10px] text-[#4a6c52]"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {feat.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Products;