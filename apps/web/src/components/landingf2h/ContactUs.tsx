"use client";

import { Phone, Clock, MapPin, Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { EyebrowPill } from "./EyebrowPill";
import { usePublicCompany } from "./PublicCompanyProvider";

export function ContactUs() {
  const company = usePublicCompany();

  const contacts = [
    ...(company.phone
      ? [
          {
            icon: Phone,
            label: "Primary Phone",
            href: company.phone_url || `tel:${company.phone.replace(/\s/g, "")}`,
            linkLabel: company.phone,
            accent: "#2d8a45",
            bg: "rgba(45,138,69,0.09)",
            border: "rgba(45,138,69,0.18)",
          },
        ]
      : []),
    ...(company.secondary_phone
      ? [
          {
            icon: Phone,
            label: "Secondary Phone",
            href: company.secondary_phone_url || `tel:${company.secondary_phone.replace(/\s/g, "")}`,
            linkLabel: company.secondary_phone,
            accent: "#2d8a45",
            bg: "rgba(45,138,69,0.09)",
            border: "rgba(45,138,69,0.18)",
          },
        ]
      : []),
    {
      icon: FaWhatsapp,
      label: "WhatsApp Support",
      href: company.whatsapp_url || `https://wa.me/${(company.whatsapp || company.phone || "").replace(/\D/g, "")}`,
      linkLabel: "Message on WhatsApp",
      accent: "#25d366",
      bg: "rgba(37,211,102,0.09)",
      border: "rgba(37,211,102,0.2)",
    },
    ...(company.email
      ? [
          {
            icon: Mail,
            label: "Support Email",
            href: `mailto:${company.email}`,
            linkLabel: company.email,
            accent: "#0284c7",
            bg: "rgba(2,132,199,0.09)",
            border: "rgba(2,132,199,0.2)",
          },
        ]
      : []),
    {
      icon: Clock,
      label: "Delivery Shifts",
      href: null,
      linkLabel: "Morning & Evening · Every Day",
      accent: "#f0a500",
      bg: "rgba(240,165,0,0.09)",
      border: "rgba(240,165,0,0.2)",
    },
  ];
  return (
    <>
      <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

        .cu-section {
          font-family: 'Poppins', sans-serif;
          position: relative;
          padding: 88px 0 104px;
          overflow: hidden;
          background: linear-gradient(160deg, #f5f9f2 0%, #eef7f1 45%, #faf8f3 100%);
        }
        .cu-blob {
          position: absolute; border-radius: 50%;
          filter: blur(72px); pointer-events: none;
        }
        .cu-blob-1 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, #b8e6c4 0%, transparent 70%);
          top: -80px; right: -60px; opacity: 0.42;
        }
        .cu-blob-2 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, #fde8b4 0%, transparent 70%);
          bottom: -60px; left: -60px; opacity: 0.38;
        }
        .cu-section::after {
          content: ''; position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
          pointer-events: none; opacity: 0.5;
        }

        .cu-inner {
          position: relative; z-index: 10;
          max-width: 1100px; margin: 0 auto; padding: 0 24px;
        }

        /* Header */
        .cu-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(45,138,69,0.1); border: 1px solid rgba(45,138,69,0.2);
          color: #2a7040; padding: 5px 15px; border-radius: 100px;
          font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; margin-bottom: 16px;
        }
        .cu-eyebrow-pulse {
          width: 7px; height: 7px; border-radius: 50%; background: #3a8c55;
          animation: cu-pulse 2s ease-in-out infinite;
        }
        @keyframes cu-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.4; transform:scale(0.65); }
        }
        .cu-heading {
          font-family: 'Poppins', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3rem);
          font-weight: 900; color: #1a3a28;
          line-height: 1.15; margin: 0 0 10px;
          letter-spacing: -0.02em;
        }
        .cu-heading em { font-style: italic; color: #3a8c55; }
        .cu-divider {
          width: 48px; height: 3px;
          background: linear-gradient(90deg, #3a8c55, #7ec89a);
          border-radius: 2px; margin: 16px auto 18px;
        }
        .cu-sub {
          color: #5a7a65; font-size: 0.94rem; font-weight: 400;
          max-width: 440px; margin: 0 auto; line-height: 1.7;
        }
        .cu-trust {
          display: inline-flex; align-items: center; gap: 9px;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(45,138,69,0.16);
          border-radius: 100px; padding: 7px 16px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          backdrop-filter: blur(8px); margin-top: 18px;
        }
        .cu-trust-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #3a8c55; position: relative; flex-shrink: 0;
        }
        .cu-trust-dot::after {
          content: ''; position: absolute; inset: -3px; border-radius: 50%;
          background: rgba(58,140,85,0.25);
          animation: cu-ring 2s ease-out infinite;
        }
        @keyframes cu-ring {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .cu-trust span { font-size: 0.78rem; font-weight: 600; color: #2a7040; }

        /* Centered Container */
        .cu-container {
          max-width: 800px;
          margin: 48px auto 0;
        }

        /* Glass Panel */
        .cu-panel {
          border-radius: 26px;
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(22px) saturate(1.8);
          -webkit-backdrop-filter: blur(22px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.82);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.94) inset,
            0 -1px 0 rgba(0,0,0,0.03) inset,
            0 10px 36px rgba(0,0,0,0.07),
            0 2px 8px rgba(0,0,0,0.04);
          overflow: hidden;
          position: relative;
        }
        .cu-panel::before {
          content: ''; position: absolute;
          top: 0; left: 8%; right: 8%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
        }
        .cu-panel-bar {
          height: 4px;
          background: linear-gradient(90deg, #3a8c55 0%, #7ec89a 55%, #f0a500 100%);
        }
        .cu-panel-body { padding: 36px 32px 38px; }
        @media (max-width: 500px) { .cu-panel-body { padding: 24px 20px 26px; } }

        /* Panel header */
        .cu-panel-label {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: #3a8c55; margin-bottom: 4px;
        }
        .cu-panel-title {
          font-family:'Poppins', sans-serif;;
          font-size: 1.5rem; font-weight: 700;
          color: #1a3a28; margin: 0 0 8px; line-height: 1.3;
        }
        .cu-panel-desc {
          font-size: 0.9rem; color: #5a7a65;
          line-height: 1.7; margin: 0 0 28px; max-width: 600px;
        }

        /* Contact items */
        .cu-contacts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .cu-contacts-grid { grid-template-columns: 1fr; gap: 12px; }
        }

        .cu-contact-item {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.84);
          background: rgba(255,255,255,0.64);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .cu-contact-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.06);
          border-color: rgba(255,255,255,0.96);
        }
        .cu-contact-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; flex-shrink: 0;
          box-shadow: 0 2px 7px rgba(0,0,0,0.06);
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .cu-contact-item:hover .cu-contact-icon { transform: scale(1.1) rotate(-6deg); }
        .cu-contact-meta { min-width: 0; }
        .cu-contact-label {
          font-size: 0.67rem; font-weight: 700; letter-spacing: 0.07em;
          text-transform: uppercase; color: #8aa896; margin-bottom: 2px;
        }
        .cu-contact-value {
          font-size: 0.95rem; font-weight: 600; color: #1a3a28;
          text-decoration: none; transition: color 0.18s; display: block;
        }
        a.cu-contact-value:hover { text-decoration: underline; }

        /* Address card */
        .cu-address-card {
          padding: 18px 20px 20px 24px;
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(58,140,85,0.07) 0%, rgba(255,255,255,0.5) 100%);
          border: 1px solid rgba(58,140,85,0.18);
          position: relative; overflow: hidden;
        }
        .cu-address-card::before {
          content: ''; position: absolute;
          left: 0; top: 0; bottom: 0; width: 4px;
          background: linear-gradient(180deg, #3a8c55, #7ec89a);
          border-radius: 4px 0 0 4px;
        }
        .cu-address-title {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em;
          text-transform: uppercase; color: #3a8c55;
          margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .cu-address-text {
          font-size: 0.95rem; color: #3d5c48;
          line-height: 1.65; font-weight: 500;
        }
        .cu-address-badge {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 12px; font-size: 0.75rem; font-weight: 700;
          color: #2a7040;
          background: rgba(58,140,85,0.1); border: 1px solid rgba(58,140,85,0.2);
          padding: 4px 14px; border-radius: 100px;
        }
      `}</style>

      <section id="contact" className="cu-section">
        <div className="cu-blob cu-blob-1" aria-hidden />
        <div className="cu-blob cu-blob-2" aria-hidden />

        <div className="cu-inner">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <EyebrowPill label="Contact Us" variant="green" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-deep-green tracking-tight">
              Get In Touch{" "}
              <em className="not-italic text-fresh-green">With Us</em>
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-[#3a5c42] text-sm sm:text-base leading-relaxed">
              Have questions about our milk plans? Want to customise your delivery?
              Reach us through any of the channels below and we'll be happy to assist.
            </p>
            <div className="flex justify-center mt-6">
              <div className="cu-trust">
                <span className="cu-trust-dot" />
                <span>Since 2018 · Trusted by 2000+ Happy Families</span>
              </div>
            </div>
          </div>

          {/* Centered Panel */}
          <div className="cu-container">
            <div className="cu-panel">
              <div className="cu-panel-bar" />
              <div className="cu-panel-body">
                <p className="cu-panel-label">F2H Fresh Milk &amp; Dry Fruits</p>
                <h3 className="cu-panel-title">We&apos;re Here to Help</h3>
                <p className="cu-panel-desc">
                  Have questions about our milk plans? Want to customise your
                  delivery? Reach us through any of the channels below and we'll be
                  happy to assist.
                </p>

                <div className="cu-contacts-grid">
                  {contacts.map((c, i) => {
                    const Icon = c.icon;
                    return (
                      <div className="cu-contact-item" key={i}>
                        <div
                          className="cu-contact-icon"
                          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.accent }}
                        >
                          {c.label === "WhatsApp" ? (
                            <Icon size={20} />
                          ) : (
                            Icon && <Icon size={18} strokeWidth={2.1} />
                          )}
                        </div>
                        <div className="cu-contact-meta">
                          <p className="cu-contact-label">{c.label}</p>
                          {c.href ? (
                            <a
                              href={c.href}
                              target={c.href.startsWith("http") ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              className="cu-contact-value"
                              style={{ color: c.accent }}
                            >
                              {c.linkLabel}
                            </a>
                          ) : (
                            <span className="cu-contact-value">{c.linkLabel}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Address */}
                <div className="cu-address-card">
                  <div className="cu-address-title">
                    <MapPin size={14} strokeWidth={2.3} />
                    Registered Office Address
                  </div>
                  <p className="cu-address-text">
                    {company.address || "1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066"}
                  </p>
                  <span className="cu-address-badge">
                    🇮🇳 Made in India &nbsp;·&nbsp; {company.company_name || "F2H Fresh"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default ContactUs;