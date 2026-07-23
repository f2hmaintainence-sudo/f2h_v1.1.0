// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : AuthContext.tsx
// Description : Auth Context for web application
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/services/api.client";
import { useRouter, usePathname } from "next/navigation";

export interface UserRole {
  role_id: string;
  role_name: string;
}

export interface AuthUser {
  user_id: string;
  email: string;
  user_name: string;
  first_name: string;
  last_name: string;
  profile: string | null;
  roles: UserRole[];
  active_role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  activeRole: string | null;
  switchRole: (roleId: string) => Promise<void>;
  refresh: () => Promise<AuthUser | null | void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  activeRole: null,
  switchRole: async () => {},
  refresh: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Role → default landing page mapping
const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  DELIVERY_PARTNER: "/delivery/today",
  CUSTOMER: "/customer/home",
};

export function getHomeForRole(role: string): string {
  return ROLE_HOME[role] || "/admin/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    try {
      //console.log("[AuthContext] Fetching user profile...");
      const { data, error } = await api.get<AuthUser>("/users/me");
      console.log("[AuthContext] Fetching user profile...", {
        data,
        error,
      });
      if (error || !data || (data as any).error) {
        console.warn("[AuthContext] Fetch user failed or returned error:", error);
        setUser(null);
        return null;
      }
      //console.log("[AuthContext] User fetched successfully:", data.email);
      setUser(data);
      return data;
    } catch (err) {
      console.error("[AuthContext] Fetch user exception:", err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip auth check on public pages
    const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
    if (publicPaths.includes(pathname)) {
      setLoading(false);
      return;
    }
    fetchUser();
  }, [pathname, fetchUser]);

  const switchRole = useCallback(async (roleId: string) => {
    await api.patch("/users/selected-role", { role_key: roleId });
    const data = await fetchUser();
    if (data) {
      router.push(getHomeForRole(roleId));
    }
  }, [fetchUser, router]);

  const logout = useCallback(() => {
    // Clear cookies
    document.cookie = "access_token=; Max-Age=0; path=/";
    document.cookie = "refresh_token=; Max-Age=0; path=/";
    document.cookie = "csrf_token=; Max-Age=0; path=/";
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeRole: user?.active_role || (user?.roles?.some(r => (r.role_name || r.role_id || '').toUpperCase() === 'ADMIN') ? 'ADMIN' : 'CUSTOMER'),
        switchRole,
        refresh: fetchUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
