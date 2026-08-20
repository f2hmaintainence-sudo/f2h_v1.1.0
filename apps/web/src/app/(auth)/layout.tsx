// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : layout.tsx
// Description : Session gate for the auth screens — a signed-in user is sent
//               straight to their panel instead of being asked to log in again.
//
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/services/api.client";
import { getHomeForRole, type AuthUser } from "@/context/AuthContext";

/**
 * Screens that must never be shown to someone who already has a session.
 * Password recovery is deliberately left out: those links arrive by email and
 * have to work even while signed in.
 */
const SESSION_GATED_PATHS = ["/login", "/register"];

/** Roles this panel refuses — they keep the login form so they can switch accounts. */
const NON_PANEL_ROLES = ["CUSTOMER", "DELIVERY_PARTNER", "DELIVERY_BOY"];

/**
 * How long the session check may hold the page. A slow or unreachable API must
 * fall through to the login form rather than spin forever.
 */
const SESSION_CHECK_TIMEOUT_MS = 4000;

/** Only same-origin paths are honoured, so ?redirect= cannot bounce off-site. */
function safeRedirect(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isGated = SESSION_GATED_PATHS.includes(pathname);

  // Held true until the session check clears the page for rendering, so the
  // login form never flashes in front of a user who is about to be redirected.
  const [checking, setChecking] = useState(isGated);

  useEffect(() => {
    if (!isGated) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), SESSION_CHECK_TIMEOUT_MS);

    (async () => {
      // A 401 here still triggers the client's silent refresh, so an expired
      // access token alone is not treated as "logged out".
      const { data, error } = await api.get<AuthUser>("/users/me", { signal: abort.signal });
      clearTimeout(timer);
      if (cancelled) return;

      const user = error || !data || (data as { error?: string }).error ? null : data;
      if (!user) {
        setChecking(false);
        return;
      }

      const hasAdmin = user.roles?.some(
        (r) => (r.role_name || r.role_id || "").toUpperCase() === "ADMIN",
      );
      const role = (user.active_role || (hasAdmin ? "ADMIN" : "")).toUpperCase().trim();
      if (!role || NON_PANEL_ROLES.includes(role)) {
        setChecking(false);
        return;
      }

      const redirect = safeRedirect(new URLSearchParams(window.location.search).get("redirect"));
      router.replace(redirect || getHomeForRole(role));
      // `checking` stays true — the login form must not appear behind the redirect.
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      abort.abort();
    };
  }, [isGated, pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="w-10 h-10 border-4 border-fresh-green/30 border-t-fresh-green rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
