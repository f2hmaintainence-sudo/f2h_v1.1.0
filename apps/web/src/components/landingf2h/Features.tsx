const features = [
  {
    emoji: "🌙",
    title: "Auto-Order Generation",
    desc: "Every night at 11 PM, all subscriber orders created automatically. Zero human input.",
  },
  {
    emoji: "📍",
    title: "Live GPS Tracking",
    desc: "Customers track delivery on real-time map. Geo-tagged photo proof on arrival.",
  },
  {
    emoji: "💳",
    title: "Smart Wallet System",
    desc: "Pre-loaded wallet auto-deducted on delivery. Auto-recharge when balance drops.",
  },
  {
    emoji: "⚡",
    title: "2-Hour Refund",
    desc: "Valid complaints resolved with instant wallet credit. No support calls needed.",
  },
  {
    emoji: "📱",
    title: "Offline Delivery App",
    desc: "Works in low-network early-morning zones. Routes cached offline, syncs when connected.",
  },
  {
    emoji: "🔁",
    title: "Subscription Automation",
    desc: "Vacation mode, pause, modify — all handled. Customer never has to remember anything.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="py-20 md:py-28 bg-deep-green relative overflow-hidden"
    >
      <div className="absolute inset-0 organic-pattern opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-gold/15 text-gold px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            FEATURES
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Platform Built for Scale
          </h2>
          <p className="text-fresh-green/70 mt-3 text-lg">
            Engineered for 10,000+ daily deliveries
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.07] rounded-3xl p-6 lg:p-8 border border-white/10 hover:border-gold/40 hover:shadow-gold-glow transition-all duration-300 group"
            >
              <span
                className="text-4xl block mb-4 group-hover:scale-110 transition-transform"
                aria-hidden
              >
                {f.emoji}
              </span>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
