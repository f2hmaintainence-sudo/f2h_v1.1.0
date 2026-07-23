"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
}: {
  target: number;
  prefix?: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div
      ref={ref}
      className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gold-gradient"
    >
      {prefix}
      {count.toLocaleString("en-IN")}
      {suffix}
    </div>
  );
}

const stats: {
  target: number;
  prefix?: string;
  suffix?: string;
  label: string;
}[] = [
    { target: 2000, suffix: "+", label: "Daily Deliveries" },
    { target: 5, prefix: "₹", suffix: "L+", label: "Daily Transactions" },
    { target: 4, label: "Stakeholder Roles" },
    { target: 60, suffix: " sec", label: "Onboarding Time" },
  ];

export function ScaleVisionStats() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <AnimatedCounter
              target={s.target}
              prefix={s.prefix}
              suffix={s.suffix}
            />
            <p className="text-black/60 mt-2 font-bold text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-deep-green/[0.07] backdrop-blur-sm rounded-3xl p-8 lg:p-10 text-center max-w-3xl mx-auto border border-deep-green/10">
        <p className="text-black/80 font-semibold text-lg leading-relaxed">
          Starting with milk — expanding to{" "}
          <span className="text-gold font-semibold">
            eggs, curd, ghee, bread, and beyond
          </span>
          . Every ₹100 village order keeps{" "}
          <span className="text-gold font-semibold">₹85 with local farmers</span>.
        </p>
      </div>
    </>
  );
}
