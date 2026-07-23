const testimonials = [
  {
    stars: 5,
    quote:
      "I forgot what it's like to worry about milk. It just appears every morning.",
    name: "Priya R.",
    tag: "Customer since 2021",
    initials: "PR",
    color: "bg-blue-500",
  },
  {
    stars: 5,
    quote:
      "My income doubled. F2H brings guaranteed orders, I just focus on quality.",
    name: "Ramu Dairy Farm",
    tag: "Vendor Partner",
    initials: "RD",
    color: "bg-fresh-green",
  },
  {
    stars: 5,
    quote:
      "Got wallet refund before I could even get upset. That's how you build trust.",
    name: "Venkat S.",
    tag: "Customer since 2022",
    initials: "VS",
    color: "bg-gold",
  },
];

import { EyebrowPill } from "./EyebrowPill";

export function Testimonials() {
  return (
    <section className="py-20 md:py-28 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <EyebrowPill label="TESTIMONIALS" className="mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-deep-green">
            Families Who Wake Up to Fresh Milk
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden"
            >
              <span className="absolute -top-4 -right-2 text-[120px] leading-none text-fresh-green/5 font-serif select-none pointer-events-none" aria-hidden>
                &ldquo;
              </span>

              <div className="flex gap-0.5 mb-4" aria-label={`${t.stars} out of 5 stars`}>
                {Array.from({ length: t.stars }).map((_, j) => (
                  <span key={j} className="text-gold text-lg" aria-hidden>
                    ⭐
                  </span>
                ))}
              </div>

              <p className="text-deep-green font-medium leading-relaxed mb-6 relative z-10">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm`}
                >
                  {t.initials}
                </span>
                <div>
                  <p className="text-deep-green font-semibold text-sm">{t.name}</p>
                  <p className="text-muted text-xs">{t.tag}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
