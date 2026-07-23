"use client";

import { useState, useEffect } from "react";
import { F2H_PUBLIC } from "@/constants/f2hPublicAssets";

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "Products", href: "#products" },
  { name: "Why Us", href: "#why" },
  { name: "How it Works", href: "#how-it-works" },
  { name: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
        <nav
          className={`w-full max-w-6xl rounded-full px-4 sm:px-6 lg:px-8 transition-all duration-500 ${scrolled
            ? "bg-white/75 backdrop-blur-2xl shadow-xl shadow-black/8 border border-white/60"
            : "bg-white/50 backdrop-blur-xl border border-white/40"
            }`}
        >
          <div className="flex items-center justify-between h-14 md:h-16">
            <a href="#home" className="flex items-center gap-2.5 group shrink-0 f2h-media-reset">
              <img
                src={F2H_PUBLIC.logo}
                alt="F2H"
                width={72}
                height={72}
                fetchPriority="high"
                className="h-10 w-auto max-h-10 shrink-0 group-hover:scale-105 transition-transform object-contain"
              />
              <span className="hidden sm:block text-sm font-semibold text-deep-green">
                Farm to Home
              </span>
            </a>

            <div className="hidden md:flex items-center gap-6 lg:gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-deep-green/70 hover:text-fresh-green transition-colors relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-fresh-green rounded-full transition-all duration-300 group-hover:w-full" />
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <a
                href="/login"
                className="px-5 py-2 rounded-full text-sm font-bold bg-gold text-deep-green shadow-gold-glow hover:scale-105 transition-all"
              >
                Login
              </a>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex flex-col gap-1.5 p-2"
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
            >
              <span
                className={`w-5 h-0.5 bg-deep-green transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""
                  }`}
              />
              <span
                className={`w-5 h-0.5 bg-deep-green transition-all duration-300 ${mobileOpen ? "opacity-0" : ""
                  }`}
              />
              <span
                className={`w-5 h-0.5 bg-deep-green transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""
                  }`}
              />
            </button>
          </div>
        </nav>
      </div>

      <div
        className={`fixed inset-y-0 right-0 w-72 z-[60] bg-white/90 backdrop-blur-2xl shadow-2xl p-8 flex flex-col gap-6 md:hidden border-l border-white/50 transition-transform duration-300 ease-out ${mobileOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
          }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="self-end text-muted hover:text-deep-green text-2xl"
          aria-label="Close menu"
        >
          ✕
        </button>
        {navLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className="text-deep-green text-lg font-semibold hover:text-fresh-green transition-colors"
          >
            {link.name}
          </a>
        ))}
        <a
          href="/login"
          onClick={() => setMobileOpen(false)}
          className="text-center px-5 py-2.5 rounded-full bg-gold text-deep-green font-bold hover:scale-105 transition-transform"
        >
          Login
        </a>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm md:hidden border-0 cursor-default"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
    </>
  );
}

export default Navbar;
