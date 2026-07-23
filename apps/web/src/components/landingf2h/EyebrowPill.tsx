interface EyebrowPillProps {
  label: string;
  variant?: "green" | "white" | "gold";
  className?: string;
}

const variants = {
  green: "bg-[rgba(58,140,85,0.1)] border border-[rgba(58,140,85,0.22)] text-[#2f7a48]",
  white: "bg-white/15 border border-white/15 text-white",
  gold: "bg-[rgba(240,165,0,0.12)] border border-[rgba(240,165,0,0.18)] text-gold",
} as const;

const dotColors = {
  green: "bg-[#3a8c55]",
  white: "bg-white",
  gold: "bg-gold",
} as const;

export function EyebrowPill({ label, variant = "green", className = "" }: EyebrowPillProps) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }`,
        }}
      />
      <span
        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold tracking-[0.08em] uppercase leading-none ${variants[variant]} ${className}`}
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <span
          className={`w-[7px] h-[7px] rounded-full inline-block ${dotColors[variant]}`}
          style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
        />
        {label}
      </span>
    </>
  );
}
