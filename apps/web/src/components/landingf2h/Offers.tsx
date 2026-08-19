"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaWallet, FaCrown, FaCalendarCheck } from "react-icons/fa6";
import { F2H_CUSTOMER_PLAYSTORE_URL } from "@/constants/f2hPublicAssets";

/* ─── shared micro-components ─────────────────────────────────────────────── */
const BrandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M9 4h6v3l3 5v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7l3-5V4Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── card data ────────────────────────────────────────────────────────────── */
const CARDS = [
  {
    theme: "is-gold",
    pill: "New here?",
    Icon: FaWallet,
    pct: "50%",
    pctLabel: "Cash back",
    codeLabel: "FIRST ORDER",
    code: "REWARD",
    cta: "Claim now",
    body: "Place your first milk order and get 50% cashback, credited straight to your F2H wallet for the next delivery.",
    confetti: (
      <>
        <circle cx="26" cy="30" r="3" fill="#fff" />
        <rect x="50" y="16" width="6" height="6" fill="#FBD9A0" transform="rotate(20 50 16)" />
        <circle cx="90" cy="14" r="2.4" fill="#fff" />
        <rect x="18" y="70" width="5" height="5" fill="#fff" transform="rotate(45 18 70)" />
        <circle cx="60" cy="60" r="2" fill="#FBD9A0" />
        <rect x="112" y="34" width="5" height="5" fill="#fff" transform="rotate(15 112 34)" />
      </>
    ),
  },
  {
    theme: "is-green",
    pill: "Members",
    Icon: FaCalendarCheck,
    pct: "5%",
    pctLabel: "Off, always",
    codeLabel: "AUTO BENEFIT",
    code: "SAVE5DAILY",
    cta: "Start now",
    body: "Set up a daily or alternate-day subscription and save on every order — no extra taps, no reminders needed.",
    confetti: (
      <>
        <circle cx="30" cy="24" r="3" fill="#fff" />
        <rect x="60" y="14" width="6" height="6" fill="#CDEFDC" transform="rotate(20 60 14)" />
        <circle cx="94" cy="20" r="2.2" fill="#fff" />
        <rect x="14" y="66" width="5" height="5" fill="#fff" transform="rotate(30 14 66)" />
      </>
    ),
  },
  {
    theme: "is-plum",
    pill: "Trusted subscribers",
    Icon: FaCrown,
    pct: "VIP",
    pctLabel: "Pay later",
    codeLabel: "VIP",
    code: "POSTPAID",
    cta: "Check now",
    body: "Stay consistent with your subscription and you'll be offered postpaid — milk arrives first, you settle up at the end of the cycle.",
    confetti: (
      <>
        <circle cx="28" cy="26" r="3" fill="#fff" />
        <rect x="58" y="16" width="6" height="6" fill="#E3DDF7" transform="rotate(20 58 16)" />
        <circle cx="92" cy="18" r="2.2" fill="#fff" />
        <circle cx="40" cy="50" r="2" fill="#C4BBEF" opacity="0.6" />
        <rect x="100" y="40" width="5" height="5" fill="#E3DDF7" transform="rotate(30 100 40)" />
      </>
    ),
  },
];

function useInView(threshold = 0.08) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── component ────────────────────────────────────────────────────────────── */
export function Offers() {
  const { ref: sectionRef, inView } = useInView(0.08);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@500;600;700&display=swap");
        .f2h-offers {
          --gap: 24px;
          --card-w: 100%;
          --bg: #F2EEE2;
          --ink: #1B2B1F;
          --ink-soft: #66756A;
          --line: rgba(27,43,31,0.10);
          --cream: #FBF8F0;
          --gold-1: #F5BA42; --gold-2: #D88916; --gold-3: #9B530A;
          --moss-1: #3CC17C; --moss-2: #1A864D; --moss-3: #0E562F;
          --plum-1: #997CF3; --plum-2: #6848D4; --plum-3: #382181;
          --accent: #1F7A4C;
          box-sizing: border-box;
          position: relative;
          background:
            radial-gradient(1200px 420px at 12% -10%, rgba(31,122,76,0.07), transparent 60%),
            radial-gradient(900px 380px at 92% 8%, rgba(154,90,22,0.06), transparent 55%),
            var(--bg);
          padding: 84px 0 76px;
          font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
          overflow: hidden;
        }
        .f2h-offers *, .f2h-offers *::before, .f2h-offers *::after { box-sizing: border-box; }

        .f2h-offers::before {
          content: "";
          position: absolute; inset: 0;
          opacity: 0.35; pointer-events: none; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.106 0 0 0 0 0.17 0 0 0 0 0.12 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        @media (min-width: 720px)  { .f2h-offers { --card-w: calc((100% - var(--gap)) / 2); } }
        @media (min-width: 1180px) { .f2h-offers { --card-w: calc((100% - 2*var(--gap)) / 3); } }

        .f2h-offers__head {
          position: relative; max-width: 580px; margin: 0 auto 44px; padding: 0 24px; text-align: center;
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.6s cubic-bezier(.22,.61,.36,1), transform 0.6s cubic-bezier(.22,.61,.36,1);
        }
        .f2h-offers__head.visible {
          opacity: 1; transform: translateY(0);
        }

        .f2h-offers__eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          background: rgba(58,140,85,0.1); border: 1px solid rgba(58,140,85,0.22);
          color: #2f7a48; padding: 8px 18px; border-radius: 100px;
          font-size: 0.9rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; line-height: 1; margin-bottom: 20px;
          font-family: 'Poppins', sans-serif;
        }
        .f2h-offers__eyebrow-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #3a8c55;
          display: inline-block; animation: f2h-pulse-dot 2s ease-in-out infinite;
        }
        @keyframes f2h-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }

        .f2h-offers__title {
          font-family: 'Plus Jakarta Sans', var(--font-plus-jakarta), sans-serif;
          font-size: clamp(2rem, 5vw, 2.4rem); font-weight: 800;
          color: #1a3a28; line-height: 1.15; margin: 0 0 12px;
          letter-spacing: -0.03em;
        }
        .f2h-offers__title em { font-style: normal; color: #3a8c55; font-weight: 800; }

        .f2h-offers__sub {
          font-family: 'Poppins', sans-serif; color: #5a7a65; font-size: 1rem;
          font-weight: 400; max-width: 480px; margin: 0 auto; line-height: 1.75;
        }
        .f2h-offers__divider {
          width: 56px; height: 3px; background: linear-gradient(90deg, #3a8c55, #7ec89a);
          border-radius: 2px; margin: 20px auto 0;
        }

        .f2h-cards-wrap {
          display: flex; flex-wrap: wrap; justify-content: center; gap: var(--gap);
          max-width: 1200px; margin: 0 auto; padding: 0 26px;
        }

        .f2h-offer-card {
          flex: 0 0 var(--card-w); max-width: var(--card-w);
          opacity: 0; transform: translateY(22px);
          background: transparent; border: none; box-shadow: none; padding: 0;
        }
        .f2h-offer-card.visible {
          animation: f2h-rise 0.6s cubic-bezier(.22,.61,.36,1) forwards;
        }
        .f2h-offer-card:nth-child(1) { animation-delay: 0.1s; }
        .f2h-offer-card:nth-child(2) { animation-delay: 0.2s; }
        .f2h-offer-card:nth-child(3) { animation-delay: 0.3s; }

        @keyframes f2h-rise { to { opacity: 1; transform: translateY(0); } }

        /* Premium Voucher Ticket (3D Flip) */
        .f2h-voucher {
          position: relative; height: 196px;
          perspective: 1200px;
          background: transparent;
        }
        .f2h-voucher__inner {
          position: relative; width: 100%; height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.65s cubic-bezier(0.22, 0.61, 0.36, 1);
        }
        .f2h-offer-card:hover .f2h-voucher__inner {
          transform: rotateY(180deg);
        }

        .f2h-voucher__front,
        .f2h-voucher__back {
          position: absolute; inset: 0; width: 100%; height: 100%;
          -webkit-backface-visibility: hidden; backface-visibility: hidden;
          border-radius: 20px; overflow: hidden; background: #fff;
          box-shadow:
            0 1px 3px rgba(27,43,31,0.06),
            0 20px 44px -16px rgba(27,43,31,0.32),
            0 0 0 1px rgba(27,43,31,0.04);
          transition: box-shadow 0.4s ease;
          -webkit-mask-image:
            radial-gradient(circle 14px at 63% 0%, transparent 98%, #000 100%),
            radial-gradient(circle 14px at 63% 100%, transparent 98%, #000 100%);
          -webkit-mask-position: top, bottom;
          -webkit-mask-size: 100% 52%, 100% 52%;
          -webkit-mask-repeat: no-repeat;
          mask-image:
            radial-gradient(circle 14px at 63% 0%, transparent 98%, #000 100%),
            radial-gradient(circle 14px at 63% 100%, transparent 98%, #000 100%);
          mask-position: top, bottom;
          mask-size: 100% 52%, 100% 52%;
          mask-repeat: no-repeat;
        }
        .f2h-offer-card:hover .f2h-voucher__front,
        .f2h-offer-card:hover .f2h-voucher__back {
          box-shadow:
            0 4px 12px rgba(27,43,31,0.08),
            0 24px 50px -16px rgba(27,43,31,0.38),
            0 0 0 1px rgba(27,43,31,0.06);
        }

        .f2h-voucher__front {
          transform: rotateY(0deg);
        }
        .f2h-voucher__back {
          transform: rotateY(180deg);
          background: linear-gradient(180deg, #FFFFFF 0%, #FAF6ED 100%);
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 16px 18px; border: 1px solid rgba(27,43,31,0.08);
        }

        .f2h-voucher-back__top {
          display: flex; justify-content: space-between; align-items: center;
        }
        .f2h-voucher-back__code-badge {
          font-family: var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace;
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em;
          color: var(--ink); background: rgba(27,43,31,0.06);
          padding: 3.5px 10px; border-radius: 6px; border: 1px dashed rgba(27,43,31,0.22);
        }
        .f2h-voucher-back__mid {
          display: flex; align-items: center; gap: 14px; margin: 2px 0;
        }
        .f2h-voucher-back__icon-wrap {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; flex: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .f2h-voucher-back__icon-wrap.is-gold  { background: linear-gradient(135deg, var(--gold-1), var(--gold-2)); }
        .f2h-voucher-back__icon-wrap.is-green { background: linear-gradient(135deg, var(--moss-1), var(--moss-2)); }
        .f2h-voucher-back__icon-wrap.is-plum  { background: linear-gradient(135deg, var(--plum-1), var(--plum-2)); }

        .f2h-voucher-back__title {
          font-family: var(--font-fraunces), 'Fraunces', Georgia, serif;
          font-size: 19px; font-weight: 700; color: var(--ink); line-height: 1.15;
        }
        .f2h-voucher-back__text {
          font-size: 12px; color: var(--ink-soft); line-height: 1.4; margin: 3px 0 0;
        }
        .f2h-voucher-back__bot {
          display: flex; justify-content: stretch;
        }
        .f2h-voucher-back__cta {
          width: 100%; justify-content: center; font-size: 12.5px; padding: 7.5px 0;
          box-shadow: none !important;
        }

        .f2h-voucher__clip {
          display: flex; position: relative; width: 100%; height: 196px; min-height: 196px;
          border-radius: 20px; overflow: hidden;
        }

        .f2h-voucher__perf {
          position: absolute; top: 24px; bottom: 14px; left: 63%;
          width: 8px; transform: translateX(-100%); z-index: 10; pointer-events: none;
          background-image: linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 48%, transparent 48%, transparent 100%);
          background-size: 8px 20px; background-repeat: repeat-y; background-position: center top;
        }

        .f2h-voucher__art {
          position: relative; flex: 0 0 63%; padding: 18px 18px 16px;
          display: flex; flex-direction: column; justify-content: space-between;
          overflow: hidden; color: #fff; isolation: isolate;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -12px 30px rgba(0,0,0,0.18);
        }
        .f2h-voucher__art::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(120% 90% at 100% 100%, rgba(0,0,0,0.18), transparent 65%);
        }

        .f2h-voucher.is-gold .f2h-voucher__art  { background: linear-gradient(145deg, var(--gold-1) 0%, var(--gold-2) 52%, var(--gold-3) 100%); }
        .f2h-voucher.is-green .f2h-voucher__art { background: linear-gradient(145deg, var(--moss-1) 0%, var(--moss-2) 52%, var(--moss-3) 100%); }
        .f2h-voucher.is-plum .f2h-voucher__art  { background: linear-gradient(145deg, var(--plum-1) 0%, var(--plum-2) 52%, var(--plum-3) 100%); }

        .f2h-voucher__confetti { position: absolute; inset: 0; opacity: 0.55; z-index: 0; }

        .f2h-voucher__pill {
          align-self: flex-start; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 5px 13px; border-radius: 999px;
          background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.38);
          backdrop-filter: blur(8px); position: relative; z-index: 1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        .f2h-voucher__illustration {
          position: absolute; right: 8px; bottom: -8px;
          width: 100px; height: 100px; z-index: 0;
          display: flex; align-items: center; justify-content: center;
          opacity: 0.35; pointer-events: none;
          transform: rotate(-6deg);
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.28));
        }

        .f2h-voucher__big { position: relative; z-index: 1; }

        .f2h-voucher__pct {
          display: block; font-family: var(--font-fraunces), 'Fraunces', Georgia, serif;
          font-size: 44px; font-weight: 600; line-height: 1; letter-spacing: -0.015em;
          text-shadow: 0 2px 10px rgba(0,0,0,0.18);
        }
        .f2h-voucher__pct-label {
          display: block; font-family: var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          margin-top: 4px; opacity: 0.92;
        }

        .f2h-voucher__stub {
          flex: 1; background: linear-gradient(180deg, #FFFFFF 0%, #FAF6ED 100%);
          padding: 15px 14px;
          display: flex; flex-direction: column; justify-content: space-between; min-width: 0;
          border-left: 1px solid rgba(27,43,31,0.05);
        }

        .f2h-voucher__brand {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--ink-soft);
        }
        .f2h-voucher__brand svg { width: 13px; height: 13px; flex: none; color: var(--accent); }

        .f2h-voucher__code-box {
          text-align: center; border: 1.5px dashed rgba(27,43,31,0.22);
          border-radius: 12px; padding: 6px 4px; margin: 5px 0;
          background: #FFFFFF;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.02);
        }
        .f2h-voucher__code-label {
          display: block; font-family: var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace;
          font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--ink-soft); margin-bottom: 3px;
        }
        .f2h-voucher__code {
          display: block; font-family: var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace;
          font-size: 13px; font-weight: 600; letter-spacing: 0.08em; color: var(--ink);
        }

        .f2h-voucher__cta {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px; padding: 7.5px 0; border-radius: 999px; border: none;
          font-size: 12.5px; font-weight: 700; font-family: inherit;
          cursor: pointer; color: #fff;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .f2h-voucher__cta svg { width: 13px; height: 13px; transition: transform 0.2s ease; }
        .f2h-voucher__cta:hover { transform: translateY(-2px); }
        .f2h-voucher__cta:hover svg { transform: translateX(3px); }
        .f2h-voucher__cta:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

        .f2h-voucher.is-gold .f2h-voucher__cta  { background: linear-gradient(135deg, var(--gold-1), var(--gold-2)); box-shadow: none; }
        .f2h-voucher.is-green .f2h-voucher__cta { background: linear-gradient(135deg, var(--moss-1), var(--moss-2)); box-shadow: none; }
        .f2h-voucher.is-plum .f2h-voucher__cta  { background: linear-gradient(135deg, var(--plum-1), var(--plum-2)); box-shadow: none; }

        .f2h-offer-card__body { margin: 16px 6px 0; font-size: 14px; line-height: 1.65; color: #404F43; font-weight: 450; letter-spacing: -0.005em; }

        @media (max-width: 480px) {
          .f2h-voucher__pct { font-size: 38px; }
          .f2h-voucher__illustration { width: 80px; height: 80px; }
          .f2h-offers { padding: 64px 0 56px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .f2h-voucher__cta, .f2h-voucher, .f2h-offer-card {
            transition: none !important; animation: none !important;
            opacity: 1 !important; transform: none !important;
          }
        }
      ` }} />

      <section className="f2h-offers" aria-label="F2H Fresh member offers" ref={sectionRef}>
        <div className={`f2h-offers__head${inView ? " visible" : ""}`}>
          <div>
            <span className="f2h-offers__eyebrow">
              <span className="f2h-offers__eyebrow-dot" />
              Fresh perks, every day
            </span>
          </div>
          <h2 className="f2h-offers__title">
            More milk in the glass,<br />
            <em>less</em> on the bill
          </h2>
          <p className="f2h-offers__sub">
            Three ways F2H Fresh rewards you — from your very first bottle to becoming a trusted regular.
          </p>
          <div className="f2h-offers__divider" />
        </div>

        <div className="f2h-cards-wrap">
          {CARDS.map(({ theme, pill, Icon, pct, pctLabel, codeLabel, code, cta, body, confetti }) => (
            <div className={`f2h-offer-card${inView ? " visible" : ""}`} key={code}>
              <div className={`f2h-voucher ${theme}`}>
                <div className="f2h-voucher__inner">
                  {/* FRONT FACE */}
                  <div className="f2h-voucher__front">
                    <div className="f2h-voucher__clip">
                      <div className="f2h-voucher__art">
                        <svg className="f2h-voucher__confetti" viewBox="0 0 300 220" preserveAspectRatio="none">
                          {confetti}
                        </svg>
                        <span className="f2h-voucher__pill">{pill}</span>
                        <div className="f2h-voucher__illustration" aria-hidden="true">
                          <Icon size={50} color="#fff" />
                        </div>
                        <div className="f2h-voucher__big">
                          <span className="f2h-voucher__pct">{pct}</span>
                          <span className="f2h-voucher__pct-label">{pctLabel}</span>
                        </div>
                      </div>
                      <span className="f2h-voucher__perf" aria-hidden="true" />
                      <div className="f2h-voucher__stub">
                        <span className="f2h-voucher__brand">
                          <BrandIcon />
                          F2H Fresh
                        </span>
                        <div className="f2h-voucher__code-box">
                          <span className="f2h-voucher__code-label">{codeLabel}</span>
                          <span className="f2h-voucher__code">{code}</span>
                        </div>
                        <button
                          type="button"
                          className="f2h-voucher__cta"
                          onClick={() => window.open(F2H_CUSTOMER_PLAYSTORE_URL, "_blank")}
                        >
                          {cta}
                          <ArrowRight />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div className="f2h-voucher__back">
                    <div className="f2h-voucher-back__top">
                      <span className="f2h-voucher__brand">
                        <BrandIcon />
                        F2H Fresh Perks
                      </span>
                      <span className="f2h-voucher-back__code-badge">
                        CODE: <strong>{code}</strong>
                      </span>
                    </div>

                    <div className="f2h-voucher-back__mid">
                      <div className={`f2h-voucher-back__icon-wrap ${theme}`}>
                        <Icon size={24} color="#fff" />
                      </div>
                      <div>
                        <div className="f2h-voucher-back__title">{pct} {pctLabel}</div>
                        <p className="f2h-voucher-back__text">
                          Use code <strong>{code}</strong> at checkout on the F2H app to claim instantly.
                        </p>
                      </div>
                    </div>

                    <div className="f2h-voucher-back__bot">
                      <button
                        type="button"
                        className={`f2h-voucher__cta f2h-voucher-back__cta ${theme}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(F2H_CUSTOMER_PLAYSTORE_URL, "_blank");
                        }}
                      >
                        {cta} on App
                        <ArrowRight />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="f2h-offer-card__body">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
