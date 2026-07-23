import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  // Next.js requires useSearchParams() to be under a Suspense boundary
  // to avoid prerender build errors (missing-suspense-with-csr-bailout).
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="w-10 h-10 border-4 border-fresh-green/30 border-t-fresh-green rounded-full animate-spin" />
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}