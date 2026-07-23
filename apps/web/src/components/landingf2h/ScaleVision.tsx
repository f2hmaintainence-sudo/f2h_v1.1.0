import { ScaleVisionStats } from "./ScaleVisionStats.client";
import { EyebrowPill } from "./EyebrowPill";

export function ScaleVision() {
  return (
    <section
      id="scale-vision"
      className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-[#e8f5ec] to-[#f9f6ef]"
    >
      {/* same ambient blob as HowItWorks */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fresh-green/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <EyebrowPill label="SCALE & VISION" className="mb-4" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-deep-green">
            Numbers That Speak
          </h2>
        </div>

        <ScaleVisionStats />
      </div>
    </section>
  );
}

export default ScaleVision;