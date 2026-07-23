import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export default function RegisterPage() {
  // AuthFlipCard renders LoginContent too, which uses useSearchParams().
  // Wrap in Suspense to satisfy Next.js build requirements.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="w-10 h-10 border-4 border-fresh-green/30 border-t-fresh-green rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterClient />
    </Suspense>
  );
}