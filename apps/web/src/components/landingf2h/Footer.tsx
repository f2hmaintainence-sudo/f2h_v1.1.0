"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { F2H_PUBLIC } from "@/constants/f2hPublicAssets";
import { FaInstagram, FaWhatsapp, FaFacebookF, FaYoutube } from "react-icons/fa";
import { FiPhone, FiMail, FiMapPin } from "react-icons/fi";

const quickLinks = [
  { name: "Home", href: "#home" },
  { name: "Milk Plans", href: "#products" },
  { name: "Delivery", href: "#delivery" },
  { name: "Why Us", href: "#why" },
  { name: "Benefits", href: "#benefits" },
  { name: "Contact", href: "#contact" },
];

const badges = ["Pure & Natural", "No Preservatives", "Daily Fresh Delivery", "Directly from Farms", "Cold-Chain Maintained"];

const DROPS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${8 + (i * 6.5) % 84}%`,
  delay: (i * 0.7) % 5,
  duration: 5 + (i * 0.4) % 4,
  size: 4 + (i * 0.3) % 5,
}));

/* ── Default contact values (shown if admin hasn't configured yet) ── */
const DEFAULT_CONTACT = {
  phone: "+91 91487 73591",
  phone_url: "tel:+919148773591",
  whatsapp: "+91 91487 73591",
  whatsapp_url: "https://wa.me/919148773591",
  email: "support@f2hfresh.com",
  address: "1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066",
  instagram_url: "#",
  facebook_url: "#",
  youtube_url: "#",
};

import { usePublicCompany } from "./PublicCompanyProvider";

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const company = usePublicCompany();

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  const socialLinks = [
    { name: "instagram", icon: FaInstagram, href: company.instagram_url || "#", hoverClass: "hover:bg-pink-500", active: Boolean(company.instagram_url && company.instagram_url !== "#") },
    { name: "whatsapp", icon: FaWhatsapp, href: company.whatsapp_url || `https://wa.me/${(company.whatsapp || company.phone || "").replace(/\D/g, "")}`, hoverClass: "hover:bg-green-500", active: Boolean(company.whatsapp || company.phone) },
    { name: "facebook", icon: FaFacebookF, href: company.facebook_url || "#", hoverClass: "hover:bg-blue-600", active: Boolean(company.facebook_url && company.facebook_url !== "#") },
    { name: "youtube", icon: FaYoutube, href: company.youtube_url || "#", hoverClass: "hover:bg-red-600", active: Boolean(company.youtube_url && company.youtube_url !== "#") },
  ];

  const contactItems = [
    { href: company.phone_url || `tel:${company.phone.replace(/\s/g, "")}`, Icon: FiPhone, label: company.phone || "+91 91487 73591" },
    ...(company.secondary_phone ? [{ href: company.secondary_phone_url || `tel:${company.secondary_phone.replace(/\s/g, "")}`, Icon: FiPhone, label: company.secondary_phone }] : []),
    { href: company.whatsapp_url || `https://wa.me/${(company.whatsapp || company.phone || "").replace(/\D/g, "")}`, Icon: FaWhatsapp, label: "WhatsApp Us" },
    { href: `mailto:${company.email || "support@f2hfresh.com"}`, Icon: FiMail, label: company.email || "support@f2hfresh.com" },
  ];

  return (
    <footer
      ref={footerRef}
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0a3015 0%, #0a3015 25%, #0d3714 60%, #071e0b 100%)",
        fontFamily: "Poppins, sans-serif",
      }}
    >

      {/* ── Milk Delivery Scene SVG ── */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <svg viewBox="0 0 1440 380" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"
          className="absolute bottom-0 w-full" style={{ opacity: 0.45 }}>
          <defs>
            <radialGradient id="sunriseGlow" cx="15%" cy="85%" r="35%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.6" />
              <stop offset="40%" stopColor="#f97316" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0a2e12" stopOpacity="0" />
            </radialGradient>
            <filter id="softBlur"><feGaussianBlur stdDeviation="1.5" /></filter>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="1440" height="380" fill="#051409" />

          {/* Sunrise glow */}
          <ellipse cx="200" cy="340" rx="280" ry="140" fill="url(#sunriseGlow)" />
          <circle cx="200" cy="325" r="32" fill="#fde68a" opacity="0.18" filter="url(#softBlur)" />
          <circle cx="200" cy="325" r="18" fill="#fbbf24" opacity="0.35" />
          <path d="M60,320 A160,160 0 0,1 340,320" fill="none" stroke="#fde68a" strokeWidth="1.5" opacity="0.3" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
            const r = (deg * Math.PI) / 180;
            return <line key={i} x1={200 + Math.cos(r) * 24} y1={325 + Math.sin(r) * 24} x2={200 + Math.cos(r) * 38} y2={325 + Math.sin(r) * 38} stroke="#fde68a" strokeWidth="1" opacity="0.25" strokeLinecap="round" />;
          })}

          {/* Stars */}
          {[[700, 30], [900, 18], [1100, 40], [1300, 22], [1380, 55], [800, 55], [1200, 38], [600, 20]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.2" fill="#d1fae5" opacity="0.4" />
          ))}

          {/* Hills */}
          <path d="M0 260 Q240 220 480 245 Q720 270 960 235 Q1200 200 1440 230 L1440 380 L0 380Z" fill="#0a2810" opacity="0.75" />
          <path d="M0 290 Q300 255 600 275 Q900 295 1200 265 Q1340 252 1440 262 L1440 380 L0 380Z" fill="#0c3214" opacity="0.75" />

          {/* Barn */}
          <g transform="translate(1220, 200)" opacity="0.7">
            <rect x="0" y="50" width="120" height="80" fill="#061408" />
            <polygon points="60,-10 -10,55 130,55" fill="#051209" />
            <rect x="40" y="90" width="40" height="40" fill="#0a2010" rx="2" />
            <rect x="10" y="65" width="22" height="18" fill="#0d3018" rx="2" />
            <rect x="88" y="65" width="22" height="18" fill="#0d3018" rx="2" />
            <line x1="40" y1="90" x2="80" y2="130" stroke="#0d3018" strokeWidth="2" />
            <line x1="80" y1="90" x2="40" y2="130" stroke="#0d3018" strokeWidth="2" />
            <rect x="125" y="30" width="28" height="100" fill="#072010" rx="4" />
            <ellipse cx="139" cy="30" rx="14" ry="8" fill="#061808" />
          </g>

          {/* Cow */}
          <g transform="translate(1060, 268)" opacity="0.65">
            <ellipse cx="0" cy="0" rx="32" ry="18" fill="#051a09" />
            <circle cx="32" cy="-10" r="13" fill="#051a09" />
            <rect x="-22" y="14" width="7" height="20" fill="#051a09" rx="2" />
            <rect x="-8" y="14" width="7" height="20" fill="#051a09" rx="2" />
            <rect x="8" y="14" width="7" height="20" fill="#051a09" rx="2" />
            <rect x="22" y="14" width="7" height="20" fill="#051a09" rx="2" />
            <path d="M-32,0 Q-44,-6 -42,-14" stroke="#051a09" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M28,-20 Q24,-30 30,-34" stroke="#051a09" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M36,-20 Q40,-30 36,-34" stroke="#051a09" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="0" cy="20" rx="12" ry="6" fill="#061808" />
          </g>

          {/* House with milk bottles on doorstep */}
          <g transform="translate(820, 210)" opacity="0.75">
            <rect x="0" y="50" width="110" height="90" fill="#061408" />
            <polygon points="55,-5 -15,55 125,55" fill="#051209" />
            <rect x="38" y="95" width="34" height="45" fill="#0a2010" rx="3" />
            <circle cx="66" cy="118" r="3" fill="#0f3a1a" />
            <rect x="8" y="65" width="28" height="24" fill="#0d3018" rx="3" />
            <rect x="74" y="65" width="28" height="24" fill="#0d3018" rx="3" />
            <line x1="22" y1="65" x2="22" y2="89" stroke="#051209" strokeWidth="1.5" />
            <line x1="8" y1="77" x2="36" y2="77" stroke="#051209" strokeWidth="1.5" />
            <line x1="88" y1="65" x2="88" y2="89" stroke="#051209" strokeWidth="1.5" />
            <line x1="74" y1="77" x2="102" y2="77" stroke="#051209" strokeWidth="1.5" />
            <rect x="28" y="138" width="54" height="5" fill="#0d3018" rx="1" />
            <rect x="22" y="143" width="66" height="5" fill="#0d3018" rx="1" />
          </g>

          {/* House left 1 */}
          <g transform="translate(150, 235)" opacity="0.7">
            <rect x="0" y="50" width="110" height="90" fill="#061408" />
            <polygon points="55,-5 -15,55 125,55" fill="#051209" />
            <rect x="38" y="95" width="34" height="45" fill="#0a2010" rx="3" />
            <circle cx="66" cy="118" r="3" fill="#0f3a1a" />
            <rect x="8" y="65" width="28" height="24" fill="#0d3018" rx="3" />
            <rect x="74" y="65" width="28" height="24" fill="#0d3018" rx="3" />
            <line x1="22" y1="65" x2="22" y2="89" stroke="#051209" strokeWidth="1.5" />
            <line x1="8" y1="77" x2="36" y2="77" stroke="#051209" strokeWidth="1.5" />
            <line x1="88" y1="65" x2="88" y2="89" stroke="#051209" strokeWidth="1.5" />
            <line x1="74" y1="77" x2="102" y2="77" stroke="#051209" strokeWidth="1.5" />
            <rect x="28" y="138" width="54" height="5" fill="#0d3018" rx="1" />
            <rect x="22" y="143" width="66" height="5" fill="#0d3018" rx="1" />
          </g>

          {/* House left 2 */}
          <g transform="translate(480, 215)" opacity="0.65">
            <rect x="0" y="40" width="80" height="70" fill="#061408" />
            <polygon points="40,-5 -10,44 90,44" fill="#051209" />
            <rect x="25" y="75" width="30" height="35" fill="#0a2010" rx="2" />
            <rect x="5" y="52" width="22" height="18" fill="#0d3018" rx="2" />
            <rect x="53" y="52" width="22" height="18" fill="#0d3018" rx="2" />
          </g>

          {/* Road */}
          <rect x="0" y="335" width="1440" height="45" fill="#040f07" opacity="0.8" />
          {[100, 240, 380, 520, 660, 800, 940, 1080, 1220, 1360].map((x, i) => (
            <rect key={i} x={x} y="355" width="60" height="5" fill="#0d3018" rx="2" opacity="0.6" />
          ))}

          {/* Second house right */}
          <g transform="translate(1300, 230)" opacity="0.6">
            <rect x="0" y="40" width="80" height="70" fill="#061408" />
            <polygon points="40,-5 -10,44 90,44" fill="#051209" />
            <rect x="25" y="75" width="30" height="35" fill="#0a2010" rx="2" />
            <rect x="5" y="52" width="22" height="18" fill="#0d3018" rx="2" />
            <rect x="53" y="52" width="22" height="18" fill="#0d3018" rx="2" />
            <rect x="28" y="62" width="7" height="12" fill="#0d3018" rx="1" opacity="0.7" />
            <rect x="30" y="56" width="3" height="7" fill="#0a2010" rx="1" opacity="0.7" />
          </g>

          {/* Delivery Scooter — animated to move right-to-left */}
          <g filter="url(#glow)" style={{ animation: "scooterMove 12s linear infinite" }}>
            {/* Headlight beam */}
            <path d="M145,30 L200,15 L200,45Z" fill="#fde68a" opacity="0.15" />
            <circle cx="148" cy="30" r="6" fill="#fde68a" opacity="0.6" />
            {/* Crate */}
            <rect x="-10" y="5" width="55" height="38" fill="#0d3d1a" rx="4" />
            <line x1="8" y1="5" x2="8" y2="43" stroke="#155724" strokeWidth="1.5" />
            <line x1="26" y1="5" x2="26" y2="43" stroke="#155724" strokeWidth="1.5" />
            <line x1="-10" y1="20" x2="45" y2="20" stroke="#155724" strokeWidth="1.5" />
            {/* Milk bottles in crate */}
            {[0, 9, 18, 27, 36].map((x) => (
              <g key={x}>
                <rect x={x} y="8" width="6" height="11" fill="#d4edda" rx="1" opacity="0.9" />
              </g>
            ))}
            <text x="2" y="32" fontFamily="monospace" fontSize="5.5" fill="#4ade80" opacity="0.9">FRESH MILK</text>
            {/* Body */}
            <path d="M45,30 Q70,10 110,12 Q140,12 155,25 L155,50 Q130,55 90,55 Q60,55 45,50Z" fill="#0f4a20" />
            <path d="M60,12 Q90,5 120,10 L118,18 Q90,13 62,18Z" fill="#072e10" />
            <rect x="130" y="8" width="4" height="20" fill="#0a3515" rx="2" />
            <rect x="124" y="8" width="16" height="4" fill="#0a3515" rx="2" />
            <path d="M115,12 Q130,6 142,10 L140,20 Q128,16 113,20Z" fill="#1a5c2a" opacity="0.6" />
            {/* Wheels */}
            <circle cx="55" cy="56" r="22" fill="#051209" />
            <circle cx="55" cy="56" r="14" fill="#0a2010" />
            <circle cx="55" cy="56" r="5" fill="#0d3018" />
            <circle cx="142" cy="56" r="22" fill="#051209" />
            <circle cx="142" cy="56" r="14" fill="#0a2010" />
            <circle cx="142" cy="56" r="5" fill="#0d3018" />
            {/* Rider */}
            <circle cx="108" cy="-5" r="16" fill="#0a3515" />
            <path d="M94,-5 Q95,10 108,12 Q121,10 122,-5Z" fill="#072e10" />
            <path d="M96,-8 Q108,-15 120,-8 L119,-4 Q108,-10 97,-4Z" fill="#155724" opacity="0.7" />
            <path d="M98,10 Q108,8 118,10 L122,28 Q108,32 94,28Z" fill="#0f4a20" />
            <path d="M116,20 Q128,15 133,12" stroke="#0a3515" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>

          {/* Speed lines */}
          {[[-40, 330], [-80, 320], [-120, 335], [-50, 342]].map(([x, y], i) => (
            <line key={i} x1={420 + x} y1={y} x2={420 + x - 35} y2={y} stroke="#1a5c2a" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
          ))}

          <path d="M0 360 L1440 360 L1440 380 L0 380Z" fill="#030e05" />
        </svg>
      </div>

      {/* Grain overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        opacity: 0.5,
      }} />

      {/* Sunrise ambient */}
      <div className="absolute bottom-0 left-0 w-80 h-64 pointer-events-none" style={{ background: "radial-gradient(ellipse at bottom left, rgba(251,191,36,0.06) 0%, transparent 70%)" }} />

      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(74,222,128,0.5) 50%, transparent 100%)" }} />

      {/* Floating milk drops */}
      {DROPS.map((d) => (
        <span key={d.id} className="absolute pointer-events-none" style={{
          left: d.left, bottom: "-10px",
          width: d.size, height: d.size * 1.4,
          borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
          background: "rgba(167,243,208,0.2)",
          animation: `dropRise ${d.duration}s ease-in ${d.delay}s infinite`,
        }} />
      ))}

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-3">

          {/* Brand */}
          <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transitionDelay: "0ms" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-green-400/20 blur-md animate-pulse" />
                <img
                  src={company.logo_url || F2H_PUBLIC.logo}
                  alt={company.company_name || "F2H"}
                  className="relative h-12 w-12 rounded-full ring-2 ring-green-500/30 object-contain bg-white/10"
                />
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight tracking-wide">{company.company_name || "Farm to Home"}</p>
                <p className="text-green-400 text-[10px] tracking-[0.25em] uppercase font-medium">Fresh Milk Daily</p>
              </div>
            </div>
            <p className="text-white/65 text-sm leading-relaxed mb-3" style={{ fontFamily: "Poppins, sans-serif" }}>
              Pure, farm-fresh milk delivered to your doorstep every morning before 7 AM.
            </p>
            {company.address && (
              <div className="flex gap-2 text-white/55 text-xs leading-relaxed mb-3">
                <FiMapPin className="mt-0.5 shrink-0 text-green-400" size={12} />
                <span>{company.address}</span>
              </div>
            )}
            <div className="flex gap-2.5">
              {socialLinks.filter(s => s.active).map(({ name, icon: Icon, href, hoverClass }) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer"
                  className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/8 border border-white/10 text-white/50 hover:text-white ${hoverClass} hover:border-transparent hover:scale-110 transition-all duration-200`}>
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transitionDelay: "100ms" }}>
            <h4 className="text-white text-xs font-bold mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-4 h-px bg-green-500 inline-block" />Quick Links
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="group text-white/60 text-sm hover:text-green-400 transition-all duration-200 flex items-center gap-2.5">
                    <span className="w-0 group-hover:w-3 h-px bg-green-400 inline-block transition-all duration-300 ease-out" />
                    <span className="group-hover:translate-x-1 transition-transform duration-200">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact — dynamically loaded */}
          <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transitionDelay: "200ms" }}>
            <h4 className="text-white text-xs font-bold mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-4 h-px bg-green-500 inline-block" />Contact Us
            </h4>
            <ul className="space-y-3.5 text-sm text-white/65">
              {contactItems.map(({ href, Icon, label }) => (
                <li key={label}>
                  <a href={href} className="group flex items-center gap-3 hover:text-green-400 transition-colors duration-200">
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/6 border border-white/8 group-hover:border-green-500/40 group-hover:bg-green-500/10 transition-all duration-200">
                      <Icon size={13} />
                    </span>
                    {label}
                  </a>
                </li>
              ))}
              {company.address && (
                <li className="group flex items-center gap-3 text-white/65 hover:text-green-400 transition-colors duration-200">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/6 border border-white/8 group-hover:border-green-500/40 group-hover:bg-green-500/10 transition-all duration-200 shrink-0">
                    <FiMapPin size={13} />
                  </span>
                  <span className="text-xs leading-relaxed">{company.address}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Why Choose Us */}
          <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transitionDelay: "300ms" }}>
            <h4 className="text-white text-xs font-bold mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-4 h-px bg-green-500 inline-block" />Why Choose Us
            </h4>
            <div className="space-y-3 mb-6">
              {badges.map((badge) => (
                <div key={badge} className="group flex items-center gap-3 text-sm text-white/60 hover:text-white/90 transition-colors duration-200 cursor-default">
                  <span className="w-6 h-6 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center text-green-400 text-[11px] shrink-0 group-hover:bg-green-500/25 group-hover:scale-110 transition-all duration-200">✓</span>
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-700"
          style={{ opacity: visible ? 1 : 0, transitionDelay: "450ms" }}>
          <p className="text-white/60 text-xs tracking-wide text-center sm:text-left">
            © {new Date().getFullYear()} F2H — Farm to Home. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/privacy-policy" className="text-white/60 hover:text-green-400 transition-colors duration-200">
              Privacy Policy
            </Link>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <Link href="/terms-and-conditions" className="text-white/60 hover:text-green-400 transition-colors duration-200">
              Terms & Conditions
            </Link>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <Link href="/refund-policy" className="text-white/60 hover:text-green-400 transition-colors duration-200">
              Refund Policy
            </Link>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <Link href="/delivery-policy" className="text-white/60 hover:text-green-400 transition-colors duration-200">
              Delivery Policy
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dropRise {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          15%  { opacity: 0.5; }
          80%  { opacity: 0.25; }
          100% { transform: translateY(-320px) scale(0.4); opacity: 0; }
        }
        @keyframes scooterMove {
          0%   { transform: translate(-300px, 290px); }
          100% { transform: translate(1500px, 290px); }
        }
      `}</style>
    </footer>
  );
}

export default Footer;