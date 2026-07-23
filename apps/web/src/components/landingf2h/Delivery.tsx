"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleCheck, MapPin, Star, Clock, Sunrise, Sunset, Snowflake, Microscope, Radar, Tractor, TestTube, Boxes, Bike, Home, SunMedium, ShieldCheck, Layers, Send, MoonStar } from "lucide-react";
import { EyebrowPill } from "./EyebrowPill";

const promises = [
  {
    icon: <Snowflake className="w-6 h-6 text-cyan-600" />,
    title: "Cold Chain Maintained",
    body: "Milk stays in refrigerated containers from farm to your door — never breaking the cold chain",
    tag: "2–6°C Always",
  },
  {
    icon: <Sunrise className="w-6 h-6 text-amber-500" />,
    title: "Same Morning Sourced",
    body: "We collect milk at 4 AM from farms and have it at your doorstep before 7 AM — under 3 hours",
    tag: "Farm Fresh",
  },
  {
    icon: <Microscope className="w-6 h-6 text-emerald-600" />,
    title: "Quality Tested Daily",
    body: "Every batch is tested for purity, fat content and microbial safety before it leaves the farm",
    tag: "Certified Pure",
  },
  {
    icon: <Radar className="w-6 h-6 text-rose-500" />,
    title: "GPS Tracked Riders",
    body: "All our delivery riders are GPS tracked — get WhatsApp notification when milk is delivered",
    tag: "Live Updates",
  },
];

const morningSchedule = [
  {
    action: "Milk Collection at Farm",
    desc: "Fresh milk collected, temperature logged, immediately sealed",
    icon: <Tractor className="w-5 h-5 text-white" />,
    dotClass: "bg-fresh-green",
  },
  {
    action: "Quality Testing & Packaging",
    desc: "Purity, fat content & microbial tests — then tamper-proof eco pouches sealed",
    icon: <TestTube className="w-5 h-5 text-white" />,
    dotClass: "bg-fresh-green",
  },
  {
    action: "Sorted at Local Hub",
    desc: "Orders sorted neighbourhood-wise onto insulated delivery bikes",
    icon: <Boxes className="w-5 h-5 text-deep-green" />,
    dotClass: "bg-gold ring-2 ring-gold/40",
  },
  {
    action: "Riders Head Out",
    desc: "GPS-tracked riders dispatch. WhatsApp alert sent to each customer",
    icon: <Bike className="w-5 h-5 text-white" />,
    dotClass: "bg-fresh-green",
  },
  {
    action: "Milk at Your Doorstep ✓",
    desc: "Cold, pure, farm-fresh milk — waiting before you wake up",
    icon: <Home className="w-5 h-5 text-white" />,
    dotClass: "bg-gradient-to-br from-fresh-green to-deep-green",
  },
];

const eveningSchedule = [
  {
    action: "Afternoon Milk Collection",
    desc: "Evening batch collected fresh, quality-checked and sealed at the farm",
    icon: <SunMedium className="w-5 h-5 text-white" />,
    dotClass: "bg-amber-500",
  },
  {
    action: "Quality Testing & Packaging",
    desc: "Same rigorous purity, fat & microbial tests before dispatch",
    icon: <ShieldCheck className="w-5 h-5 text-white" />,
    dotClass: "bg-amber-500",
  },
  {
    action: "Sorted at Local Hub",
    desc: "Evening orders sorted onto insulated delivery bikes by zone",
    icon: <Layers className="w-5 h-5 text-deep-green" />,
    dotClass: "bg-gold ring-2 ring-gold/40",
  },
  {
    action: "Evening Riders Head Out",
    desc: "GPS-tracked evening riders dispatch with WhatsApp alert to customers",
    icon: <Send className="w-5 h-5 text-white" />,
    dotClass: "bg-amber-500",
  },
  {
    action: "Evening Delivery Done ✓",
    desc: "Fresh evening milk at your door — perfectly timed for dinner",
    icon: <MoonStar className="w-5 h-5 text-white" />,
    dotClass: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
];

const morningZones = [
  { name: "Belthur & Seegahalli", status: "Active" as const },
  { name: "Kadugodi", status: "Active" as const },
  { name: "Maitri Layout", status: "Active" as const },
  { name: "Prashant Layout & Springdale Layout", status: "Active" as const },
  { name: "Nagondanahalli", status: "Active" as const },
  { name: "Nellurahalli", status: "Active" as const },
  { name: "Hoodi", status: "Active" as const },
];

const eveningZones = [
  { name: "Nagondanahalli", status: "Active" as const },
  { name: "Hope Farm", status: "Active" as const },
  { name: "Borewell Road", status: "Active" as const },
  { name: "ECC Road", status: "Active" as const },
  { name: "Immidihalli", status: "Active" as const },
];

function DeliveryRouteSvg() {
  return (
    <svg
      viewBox="0 0 480 230"
      className="w-full h-auto max-h-[240px] text-deep-green"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Morning delivery route from farm to home"
    >
      <defs>
        <pattern id="deliveryPgrid" width={40} height={40} patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(45, 138, 69, 0.12)" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={480} height={230} fill="url(#deliveryPgrid)" rx={10} />
      <path
        d="M 72 115 C 130 60, 190 160, 240 115 C 290 70, 360 175, 420 115"
        fill="none"
        stroke="rgba(45, 138, 69, 0.45)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <rect x={20} y={90} width={68} height={50} rx={9} fill="white" stroke="#2d8a45" strokeWidth={1.5} />
      <foreignObject x={44} y={96} width={20} height={20}>
        <div className="flex items-center justify-center w-full h-full text-fresh-green">
          <Tractor className="w-5 h-5" />
        </div>
      </foreignObject>
      <text x={54} y={128} textAnchor="middle" fontSize={8} fill="#0d3d1a" fontWeight="bold">FARM</text>
      <rect x={168} y={145} width={80} height={46} rx={9} fill="white" stroke="#2d8a45" strokeWidth={1.5} />
      <foreignObject x={198} y={149} width={20} height={20}>
        <div className="flex items-center justify-center w-full h-full text-fresh-green">
          <TestTube className="w-5 h-5" />
        </div>
      </foreignObject>
      <text x={208} y={181} textAnchor="middle" fontSize={7.5} fill="#0d3d1a" fontWeight="bold">QUALITY CHECK</text>
      <rect x={305} y={145} width={76} height={46} rx={9} fill="white" stroke="#f0a500" strokeWidth={1.5} />
      <foreignObject x={333} y={149} width={20} height={20}>
        <div className="flex items-center justify-center w-full h-full text-amber-500">
          <Boxes className="w-5 h-5" />
        </div>
      </foreignObject>
      <text x={343} y={181} textAnchor="middle" fontSize={7.5} fill="#f0a500" fontWeight="bold">LOCAL HUB</text>
      <rect x={392} y={88} width={72} height={50} rx={9} fill="#0d3d1a" />
      <foreignObject x={418} y={94} width={20} height={20}>
        <div className="flex items-center justify-center w-full h-full text-white">
          <Home className="w-5 h-5" />
        </div>
      </foreignObject>
      <text x={428} y={126} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.92)" fontWeight="bold">YOUR HOME</text>
      <circle cx={132} cy={84} r={6} fill="#f0a500" className="animate-pulse" />
      <circle cx={270} cy={152} r={6} fill="#f0a500" className="animate-pulse" style={{ animationDelay: "0.2s" }} />
      <circle cx={385} cy={100} r={6} fill="#f0a500" className="animate-pulse" style={{ animationDelay: "0.4s" }} />
    </svg>
  );
}

export function Delivery() {
  const [scheduleTab, setScheduleTab] = useState<"morning" | "evening">("morning");
  const [zoneTab, setZoneTab] = useState<"morning" | "evening">("morning");

  const activeSchedule = scheduleTab === "morning" ? morningSchedule : eveningSchedule;
  const activeZones = zoneTab === "morning" ? morningZones : eveningZones;

  return (
    <section
      id="delivery"
      className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-[#f9f6ef] to-[#e8f5ec]"
    >
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-fresh-green/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-14"
        >
          <div className="flex justify-center mb-4">
            <EyebrowPill label="Farm To Home" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-deep-green tracking-tight">
            How We Deliver{" "}
            <em className="not-italic text-fresh-green">Pure Freshness</em>
          </h2>
          <div className="mx-auto mt-5 h-px w-20 bg-gradient-to-r from-transparent via-fresh-green/40 to-transparent rounded-full" />
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto mt-6 leading-relaxed">
            Our entire delivery system is built around one goal — ensuring
            farm-cold milk lands at your door in pristine condition, every morning
            without exception.
          </p>
        </motion.div>

        {/* Promise strip */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-14 md:mb-16">
          {promises.map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 * i, duration: 0.45 }}
              whileHover={{ y: -4 }}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-fresh-green/20 bg-white/85 shadow-sm shadow-green-glow backdrop-blur-sm transition-shadow duration-300 hover:border-fresh-green/35 hover:shadow-lg hover:shadow-fresh-green/15"
            >
              <div className="h-1 w-full bg-gradient-to-r from-fresh-green via-fresh-green/80 to-gold/90" />
              <div className="flex flex-1 flex-col p-5 md:p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fresh-green/12 to-cream text-2xl shadow-inner ring-1 ring-fresh-green/15 transition-transform duration-300 group-hover:scale-[1.02]">
                  {p.icon}
                </div>
                <h3 className="text-base font-bold text-deep-green mb-2 leading-snug">{p.title}</h3>
                <p className="text-muted text-xs sm:text-sm leading-relaxed flex-1 mb-4">{p.body}</p>
                <span className="inline-flex self-start rounded-full bg-gradient-to-r from-fresh-green/12 to-gold/10 text-fresh-green text-[11px] font-bold px-3 py-1.5 border border-fresh-green/20">
                  {p.tag}
                </span>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Main split */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-start">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-6">
            {/* Route SVG */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="overflow-hidden rounded-2xl border border-fresh-green/20 bg-white/90 shadow-md shadow-green-glow backdrop-blur-sm"
            >
              <div className="border-b border-fresh-green/10 bg-gradient-to-r from-fresh-green/[0.06] to-transparent px-6 py-4 md:px-8 md:py-5">
                <h3 className="text-lg font-bold text-deep-green">Our Morning Delivery Route</h3>
                <p className="text-sm text-muted mt-1">
                  From dairy farm to your doorstep — the freshest journey in the city
                </p>
              </div>
              <div className="p-4 md:p-6">
                <div className="overflow-hidden rounded-xl border border-fresh-green/20 bg-white shadow-inner">
                  <DeliveryRouteSvg />
                </div>
              </div>
            </motion.div>

            {/* ── DELIVERY SCHEDULE with Morning / Evening tabs ── */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="overflow-hidden rounded-2xl border border-fresh-green/20 bg-white/90 shadow-md shadow-green-glow backdrop-blur-sm"
            >
              {/* Card header + tabs */}
              <div className="border-b border-fresh-green/10 bg-gradient-to-r from-fresh-green/[0.06] to-transparent px-6 py-4 md:px-8 md:py-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-lg font-bold text-deep-green flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fresh-green/10 text-fresh-green ring-1 ring-fresh-green/20">
                      <Clock className="w-5 h-5" />
                    </span>
                    Delivery Schedule
                  </h3>
                  {/* Tab switcher */}
                  <div className="flex items-center gap-1 rounded-xl bg-fresh-green/8 border border-fresh-green/15 p-1">
                    <button
                      onClick={() => setScheduleTab("morning")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        scheduleTab === "morning"
                          ? "bg-white text-deep-green shadow-sm border border-fresh-green/20"
                          : "text-muted hover:text-deep-green"
                      }`}
                    >
                      <Sunrise className="w-3.5 h-3.5" />
                      Morning
                    </button>
                    <button
                      onClick={() => setScheduleTab("evening")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        scheduleTab === "evening"
                          ? "bg-white text-amber-700 shadow-sm border border-amber-200/60"
                          : "text-muted hover:text-deep-green"
                      }`}
                    >
                      <Sunset className="w-3.5 h-3.5" />
                      Evening
                    </button>
                  </div>
                </div>

              </div>

              {/* Schedule list */}
              <div className="p-5 md:p-6 md:pt-6">
                <AnimatePresence mode="wait">
                  <motion.ul
                    key={scheduleTab}
                    initial={{ opacity: 0, x: scheduleTab === "morning" ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: scheduleTab === "morning" ? 12 : -12 }}
                    transition={{ duration: 0.25 }}
                    className="relative space-y-0 pl-2"
                  >
                    <div
                      className={`absolute left-[19px] top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b ${
                        scheduleTab === "morning"
                          ? "from-fresh-green/30 via-fresh-green/15 to-gold/30"
                          : "from-amber-400/30 via-amber-300/15 to-gold/30"
                      }`}
                    />
                    {activeSchedule.map((s) => (
                      <li key={s.action} className="relative flex gap-4 pb-6 last:pb-0">
                        <div
                          className={`relative z-[1] w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm shadow-sm ring-2 ring-white ${s.dotClass}`}
                        >
                          <span className="flex items-center justify-center">{s.icon}</span>
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <div className="font-bold text-deep-green text-sm mt-0.5">{s.action}</div>
                          <p className="text-muted text-xs mt-1 leading-relaxed">{s.desc}</p>
                        </div>
                      </li>
                    ))}
                  </motion.ul>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-6"
          >
            {/* ── COVERAGE ZONES ── */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-deep-green">
                Delivery{" "}
                <em className="not-italic text-fresh-green">Coverage Zones</em>
              </h2>
              <div className="mt-4 h-px w-16 bg-fresh-green/30 rounded-full" />
              <p className="text-muted text-sm leading-relaxed mt-4">
                We deliver across these localities every single day — morning and evening slots available.
                Not in the list? Register interest and we'll notify you when we arrive.
              </p>

              {/* Zone tab switcher */}
              <div className="mt-5 flex items-center gap-1 rounded-xl bg-white/80 border border-fresh-green/15 shadow-sm p-1 w-fit">
                <button
                  onClick={() => setZoneTab("morning")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    zoneTab === "morning"
                      ? "bg-fresh-green text-white shadow-sm"
                      : "text-muted hover:text-deep-green"
                  }`}
                >
                  <Sunrise className="w-4 h-4" />
                  Morning
                  <span
                    className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                      zoneTab === "morning" ? "bg-white/25 text-white" : "bg-fresh-green/10 text-fresh-green"
                    }`}
                  >
                    {morningZones.length}
                  </span>
                </button>
                <button
                  onClick={() => setZoneTab("evening")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    zoneTab === "evening"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-muted hover:text-deep-green"
                  }`}
                >
                  <Sunset className="w-4 h-4" />
                  Evening
                  <span
                    className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                      zoneTab === "evening" ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {eveningZones.length}
                  </span>
                </button>
              </div>

              {/* Zone timing badge */}
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  {zoneTab === "morning" ? (
                    <motion.div
                      key="morning-zone-badge"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-fresh-green bg-fresh-green/8 border border-fresh-green/15 rounded-full px-3 py-1.5"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fresh-green opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-fresh-green" />
                      </span>
                      Morning Shift · Monday to Sunday
                    </motion.div>
                  ) : (
                    <motion.div
                      key="evening-zone-badge"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-full px-3 py-1.5"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                      Evening Shift · Monday to Sunday
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Zone cards */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={zoneTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 grid sm:grid-cols-2 gap-3"
                >
                  {activeZones.map((z, i) => (
                    <motion.div
                      key={z.name}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04, duration: 0.22 }}
                      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                        zoneTab === "morning"
                          ? "border-fresh-green/25 bg-white/90 text-deep-green hover:border-fresh-green/40"
                          : "border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-white/90 text-deep-green hover:border-amber-300/70"
                      }`}
                    >
                      {/* Left accent bar */}
                      <span
                        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                          zoneTab === "morning" ? "bg-fresh-green" : "bg-amber-500"
                        }`}
                      />
                      {/* List bullet (no index) */}
                      <span
                        className={`ml-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${
                          zoneTab === "morning" ? "bg-fresh-green" : "bg-amber-500"
                        }`}
                        aria-hidden
                      />
                      <span className="flex-1 min-w-0 pl-0.5 leading-snug">{z.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                          zoneTab === "morning"
                            ? "bg-fresh-green/10 text-fresh-green"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        Active
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

           

            {/* WhatsApp alerts */}
            <div className="flex gap-4 rounded-2xl border border-fresh-green/20 bg-white/90 p-5 md:p-6 shadow-md shadow-green-glow backdrop-blur-sm transition-shadow hover:shadow-lg">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fresh-green/15 to-cream text-fresh-green ring-1 ring-fresh-green/20">
                <MapPin className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-deep-green text-sm sm:text-base">WhatsApp Delivery Alerts</h4>
                <p className="text-muted text-xs sm:text-sm mt-1 leading-relaxed">
                  Get instant WhatsApp notifications at collection, dispatch, and doorstep arrival — for
                  both morning and evening slots — so you're never left guessing.
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-fresh-green/10 px-3 py-1.5 text-xs font-semibold text-fresh-green ring-1 ring-fresh-green/15">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fresh-green opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-fresh-green" />
                  </span>
                  Live tracking active for all deliveries
                </div>
              </div>
            </div>

            {/* Ratings */}
            <div className="overflow-hidden rounded-2xl border border-fresh-green/20 bg-white/95 shadow-lg shadow-fresh-green/10">
              <div className="bg-gradient-to-r from-fresh-green/[0.08] via-transparent to-gold/[0.06] px-5 py-4 md:px-6 border-b border-fresh-green/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-gold shadow-sm ring-1 ring-fresh-green/15">
                    <Star className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-deep-green text-sm sm:text-base">Trusted by 2000+ Families</h4>
                    <p className="text-[10px] sm:text-xs font-bold text-fresh-green uppercase tracking-wider mt-0.5">
                      Bengaluru&apos;s #1 Milk Delivery
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 md:p-5">
                <div className="rounded-xl border border-fresh-green/15 bg-gradient-to-b from-white to-cream/50 py-4 px-3 text-center shadow-sm">
                  <strong className="block text-2xl sm:text-3xl font-extrabold text-deep-green leading-none tabular-nums">4.9</strong>
                  <span className="text-[11px] text-muted">Avg. Rating</span>
                  <div className="text-gold text-[11px] mt-1 tracking-tight">★★★★★</div>
                </div>
                <div className="rounded-xl border border-fresh-green/15 bg-gradient-to-b from-white to-cream/50 py-4 px-3 text-center shadow-sm">
                  <strong className="block text-2xl sm:text-3xl font-extrabold text-deep-green leading-none tabular-nums">98%</strong>
                  <span className="text-[11px] text-muted">On-time Delivery</span>
                  <div className="text-[11px] text-fresh-green font-semibold mt-1">↑ This Month</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default Delivery;