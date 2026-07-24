import { Phone, Sprout } from "lucide-react";

const phoneTel = "+919148773591";

import { EyebrowPill } from "./EyebrowPill";

export function FinalCTA() {
  return (
    <section
      id="cta"
      className="relative py-20 md:py-28 overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(135deg, #0d3d1a 0%, #145a28 45%, #0f4a22 100%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-24 -left-16 w-[min(90vw,420px)] h-[min(90vw,420px)] rounded-full bg-white/12 blur-3xl opacity-90" />
        <div className="absolute top-1/3 -right-20 w-[min(85vw,380px)] h-[min(85vw,380px)] rounded-full bg-[#e8f5ec]/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-[min(100vw,500px)] h-[min(100vw,500px)] rounded-full bg-gold/10 blur-3xl" />
      </div>
      <div className="absolute inset-0 organic-pattern opacity-25 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center mb-5">
          <EyebrowPill label="Get Started" variant="gold" className="border-white/25 backdrop-blur-sm" />
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-5">
          Start Your Fresh Milk
          <br />
          <em className="not-italic text-gold">Subscription Today</em>
        </h2>

        <p className="text-white/75 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Healthy mornings begin with pure milk. Join 500+ families who wake up to
          freshness every day.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
          <a
            href="#contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base sm:text-lg text-deep-green shadow-lg hover:scale-[1.02] transition-transform"
            style={{
              background: "linear-gradient(135deg, #ffffff, #e8f5ee)",
            }}
          >
            <Sprout className="w-5 h-5 text-fresh-green shrink-0" aria-hidden />
            Subscribe Now
          </a>
          <a
            href={`tel:${phoneTel}`}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-white/50 text-white font-semibold text-base sm:text-lg hover:bg-white/10 transition-colors"
          >
            <Phone className="w-5 h-5 shrink-0" aria-hidden />
            Call Us Today
          </a>
        </div>
      </div>
    </section>
  );
}

export default FinalCTA;
