"use client";

import { useEffect, useRef, useState } from "react";
import {
  Leaf,
  Package,
  ShieldCheck,
  Sunrise,
  BadgePercent,
  ShoppingBasket,
} from "lucide-react";

const reasons = [
  {
    icon: Leaf,
    title: "Farm to Home",
    subtitle: "100% Pure & Natural",
    body: "Every drop travels straight from our partner farms to your doorstep — untouched, unblended, and brimming with natural goodness.",
    accent: "#3a8c55",
    glow: "rgba(58,140,85,0.18)",
    badge: "Pure",
  },
  {
    icon: Package,
    title: "Eco-Friendly",
    subtitle: "Glass Bottle Packaging",
    body: "We deliver in reusable glass bottles — better for your health, better for the planet. No plastic, no compromise.",
    accent: "#2e7d9c",
    glow: "rgba(46,125,156,0.18)",
    badge: "Green",
  },
  {
    icon: ShieldCheck,
    title: "Zero Adulteration",
    subtitle: "No Preservatives Added",
    body: "Rigorously tested and completely free of chemicals, additives, or adulterants. Pure milk, guaranteed — every single time.",
    accent: "#7a5c2e",
    glow: "rgba(122,92,46,0.18)",
    badge: "Safe",
  },
  {
    icon: Sunrise,
    title: "Daily Fresh",
    subtitle: "Production Every Morning",
    body: "Milk is never stored overnight. Fresh production begins at dawn so you receive the same-day batch at your door before breakfast.",
    accent: "#c47d1a",
    glow: "rgba(196,125,26,0.18)",
    badge: "Fresh",
  },
  {
    icon: BadgePercent,
    title: "Trial Offer",
    subtitle: "& Postpaid Option",
    body: "Try before you commit. Start with a no-risk trial, and enjoy the convenience of postpaid billing on your terms.",
    accent: "#6b4ea8",
    glow: "rgba(107,78,168,0.18)",
    badge: "Flexible",
  },
  {
    icon: ShoppingBasket,
    title: "More Than Milk",
    subtitle: "Sweets & Cold-Pressed Oils",
    body: "From homemade traditional sweets to cold-pressed oils — our farm store brings pure, artisanal goodness to your table.",
    accent: "#b54a4a",
    glow: "rgba(181,74,74,0.18)",
    badge: "Artisan",
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function WhyChooseUs() {
  const { ref: sectionRef, inView } = useInView(0.08);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,600;1,700&display=swap');

        .f2h-section {
          font-family: 'Poppins', sans-serif;
          position: relative;
          padding: 96px 0 112px;
          overflow: hidden;
          background: linear-gradient(160deg, #f5f9f2 0%, #eef7f1 40%, #faf8f3 100%);
        }

        /* Decorative blobs */
        .f2h-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.45;
        }
        .f2h-blob-1 {
          width: 520px; height: 520px;
          background: radial-gradient(circle, #b8e6c4 0%, transparent 70%);
          top: -120px; left: -160px;
        }
        .f2h-blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #fde8b4 0%, transparent 70%);
          bottom: -80px; right: -100px;
        }
        .f2h-blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #d4eaf8 0%, transparent 70%);
          top: 40%; left: 55%;
          opacity: 0.3;
        }

        /* Subtle grain texture */
        .f2h-section::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.6;
        }

        .f2h-inner {
          position: relative;
          z-index: 10;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Header */
        .f2h-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(58,140,85,0.1);
          border: 1px solid rgba(58,140,85,0.22);
          color: #2f7a48;
          padding: 8px 18px;
          border-radius: 100px;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 20px;
          font-family: 'Poppins', sans-serif;
        }
        .f2h-eyebrow-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #3a8c55;
          display: inline-block;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }

        .f2h-heading {
          font-family: 'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback';
          font-size: clamp(2rem, 5vw, 2.4rem);
          font-weight: 800;
          color: #1a3a28;
          line-height: 1.15;
          margin: 0 0 12px;
          letter-spacing: -0.03em;
        }
        .f2h-heading em {
          font-style: normal;
          color: #3a8c55;
        }
        .f2h-subtext {
          color: #5a7a65;
          font-size: 1rem;
          font-weight: 400;
          max-width: 480px;
          margin: 0 auto;
          line-height: 1.75;
          font-family: 'Poppins', sans-serif;
        }
        .f2h-divider {
          width: 56px; height: 3px;
          background: linear-gradient(90deg, #3a8c55, #7ec89a);
          border-radius: 2px;
          margin: 20px auto 0;
        }

        /* Grid */
        .f2h-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 64px;
        }
        @media (max-width: 900px) {
          .f2h-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 580px) {
          .f2h-grid { grid-template-columns: 1fr; gap: 16px; }
        }

        /* Last card center if 7 items */
        .f2h-grid > article:last-child:nth-child(7) {
          grid-column: 2;
        }
        @media (max-width: 900px) {
          .f2h-grid > article:last-child:nth-child(7) {
            grid-column: 1 / -1;
            max-width: 420px;
            margin: 0 auto;
            width: 100%;
          }
        }
        @media (max-width: 580px) {
          .f2h-grid > article:last-child:nth-child(7) {
            grid-column: 1;
            max-width: 100%;
          }
        }

        /* Glass Card */
        .f2h-card {
          position: relative;
          border-radius: 24px;
          padding: 28px 24px 26px;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(18px) saturate(1.6);
          -webkit-backdrop-filter: blur(18px) saturate(1.6);
          border: 1px solid rgba(255,255,255,0.75);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.9) inset,
            0 -1px 0 rgba(0,0,0,0.04) inset,
            0 8px 32px rgba(0,0,0,0.07),
            0 2px 8px rgba(0,0,0,0.04);
          transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.32s ease,
                      border-color 0.25s ease;
          cursor: default;
          overflow: hidden;
          opacity: 0;
          transform: translateY(32px);
        }
        .f2h-card.visible {
          animation: card-in 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes card-in {
          to { opacity: 1; transform: translateY(0); }
        }
        .f2h-card:hover {
          transform: translateY(-6px) scale(1.012);
          border-color: rgba(255,255,255,0.9);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.95) inset,
            0 -1px 0 rgba(0,0,0,0.04) inset,
            0 20px 48px rgba(0,0,0,0.11),
            0 4px 12px rgba(0,0,0,0.06),
            var(--card-glow, 0 0 0 transparent);
        }

        /* Card glow ring on hover */
        .f2h-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 25px;
          padding: 1px;
          background: linear-gradient(135deg, var(--card-accent, #3a8c55) 0%, transparent 60%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }
        .f2h-card:hover::before { opacity: 1; }

        /* Top shimmer line */
        .f2h-card::after {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
          border-radius: 1px;
        }

        /* Card inner glow spot */
        .f2h-card-glow {
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: var(--card-accent, #3a8c55);
          opacity: 0.08;
          filter: blur(30px);
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .f2h-card:hover .f2h-card-glow { opacity: 0.16; }

        /* Badge */
        .f2h-badge {
          position: absolute;
          top: 18px; right: 18px;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--card-accent, #3a8c55);
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.9);
          padding: 3px 9px;
          border-radius: 100px;
          backdrop-filter: blur(8px);
          font-family: 'Poppins', sans-serif;
        }

        /* Icon wrapper */
        .f2h-icon-wrap {
          width: 52px; height: 52px;
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          margin-bottom: 18px;
          color: var(--card-accent, #3a8c55);
          position: relative;
          z-index: 1;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .f2h-card:hover .f2h-icon-wrap {
          transform: scale(1.08) rotate(-4deg);
        }

        .f2h-card-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #1a3a28;
          margin: 0 0 3px;
          line-height: 1.3;
          position: relative; z-index: 1;
          letter-spacing: -0.01em;
        }
        .f2h-card-subtitle {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--card-accent, #3a8c55);
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          position: relative; z-index: 1;
        }
        .f2h-card-body {
          font-family: 'Poppins', sans-serif;
          font-size: 0.855rem;
          line-height: 1.75;
          color: #4e6758;
          font-weight: 400;
          margin: 0;
          position: relative; z-index: 1;
        }

        /* Bottom accent line */
        .f2h-card-line {
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, var(--card-accent, #3a8c55), transparent);
          margin-top: 18px;
          opacity: 0.25;
          transition: opacity 0.3s ease, width 0.4s ease;
          width: 40%;
        }
        .f2h-card:hover .f2h-card-line { opacity: 0.7; width: 70%; }
      `}</style>

      <section id="why" className="f2h-section" ref={sectionRef}>
        {/* Background blobs */}
        <div className="f2h-blob f2h-blob-1" aria-hidden />
        <div className="f2h-blob f2h-blob-2" aria-hidden />
        <div className="f2h-blob f2h-blob-3" aria-hidden />

        <div className="f2h-inner">
          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <div>
              <span className="f2h-eyebrow">
                <span className="f2h-eyebrow-dot" />
                Our Promise to You
              </span>
            </div>
            <h2 className="f2h-heading">
              Why Choose{" "}
              <em>F2H?</em>
            </h2>
            <p className="f2h-subtext">
              From our farms to your family — here's everything that makes
              Farm&nbsp;to&nbsp;Home different, pure, and worth trusting.
            </p>
            <div className="f2h-divider" />
          </div>

          {/* Cards */}
          <div className="f2h-grid">
            {reasons.map((item, i) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className={`f2h-card${inView ? " visible" : ""}`}
                  style={
                    {
                      "--card-accent": item.accent,
                      "--card-glow": `0 8px 32px ${item.glow}`,
                      animationDelay: inView ? `${i * 90}ms` : "0ms",
                    } as React.CSSProperties
                  }
                >
                  {/* Glow spot */}
                  <div className="f2h-card-glow" aria-hidden />

                  {/* Badge */}
                  <span className="f2h-badge">{item.badge}</span>

                  {/* Icon */}
                  <div className="f2h-icon-wrap" aria-hidden>
                    <Icon size={22} strokeWidth={1.9} />
                  </div>

                  <h3 className="f2h-card-title">{item.title}</h3>
                  <p className="f2h-card-subtitle">{item.subtitle}</p>
                  <p className="f2h-card-body">{item.body}</p>

                  {/* Bottom accent line */}
                  <div className="f2h-card-line" aria-hidden />
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export default WhyChooseUs;