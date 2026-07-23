import { TabletSmartphone, Settings, Milk } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: <TabletSmartphone className="w-8 h-8 text-white" />,
    title: "Subscribe in 60 Seconds",
    desc: "Choose vendor, product, quantity, slot, pin address, top up wallet. Done forever.",
  },
  {
    num: "02",
    icon: <Settings className="w-8 h-8 text-yellow-400" />,
    title: "We Automate Everything",
    desc: "Every night at 11 PM, system auto-generates orders. Vendor gets packing list. Delivery gets optimised route.",
  },
  {
    num: "03",
    icon: <Milk className="w-8 h-8 text-blue-200" />,
    title: "Milk at Your Door Every Morning & Evening",
    desc: "Delivered with photo proof. Wallet auto-debited. Repeats forever automatically.",
  },
];

import { EyebrowPill } from "./EyebrowPill";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 md:py-20 relative overflow-hidden bg-gradient-to-b from-[#f9f6ef] to-[#e8f5ec]"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fresh-green/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <EyebrowPill label="HOW IT WORKS" className="mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-deep-green">
            Simple. Automatic. Reliable.
          </h2>
        </div>

        {/* grid with items-stretch so all 3 columns are the same height */}
        <div className="grid md:grid-cols-3 gap-8 relative items-stretch">
          {/* dashed connector line */}
          <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-0.5 border-t-2 border-dashed border-fresh-green/30" />

          {steps.map((step) => (
            <div
              key={step.num}
              className="relative flex flex-col"   /* flex-col so the card fills the row height */
            >
              {/* outer card — h-full makes it stretch to the tallest sibling */}
              <div className="glass h-full rounded-3xl p-7 md:p-8 border border-fresh-green/25 shadow-sm shadow-green-glow flex flex-col">
                <div className="flex flex-col gap-4 flex-1">

                  {/* icon + step label — fixed height via min-h */}
                  <div className="rounded-2xl p-4 border border-fresh-green/20 bg-white/60 flex flex-col items-center min-h-[148px] justify-center">
                    <div className="w-16 h-16 bg-deep-green rounded-full flex items-center justify-center mb-4 shadow-green-glow relative z-10">
                      {step.icon}
                    </div>
                    <span className="text-gold font-bold text-sm">
                      STEP {step.num}
                    </span>
                  </div>

                  {/* title box — flex-1 so it shares leftover space equally */}
                  <div className="rounded-2xl p-4 border border-fresh-green/20 bg-white/60 flex items-center justify-center flex-1">
                    <h3 className="text-xl font-bold text-deep-green leading-snug text-center">
                      {step.title}
                    </h3>
                  </div>

                  {/* desc box — flex-1 so it shares leftover space equally */}
                  <div className="rounded-2xl p-4 border border-fresh-green/20 bg-white/60 flex items-center justify-center flex-1">
                    <p className="text-muted text-sm font-semibold leading-relaxed text-center">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;