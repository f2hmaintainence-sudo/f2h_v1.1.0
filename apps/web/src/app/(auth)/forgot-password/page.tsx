import { Suspense } from "react";
import AuthFlipCard from "@/components/AuthFlipCard/AuthFlipCard";

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="w-10 h-10 border-4 border-fresh-green/30 border-t-fresh-green rounded-full animate-spin" />
        </div>
      }
    >
      <AuthFlipCard initialSide="forgot-password" />
    </Suspense>
  );
}
