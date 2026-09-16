// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : AuthContext.tsx
// Description : Auth Context for web application
//
// ============================================================================

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/services/api.client";
import { useRouter, usePathname } from "next/navigation";
import { clearCsrfToken } from "@/lib/csrf";

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
  permissions?: string[];
  is_admin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  activeRole: string | null;
  permissions: string[];
  isAdmin: boolean;
  hasPermission: (requiredPerms: string | string[]) => boolean;
  switchRole: (roleId: string) => Promise<void>;
  refresh: () => Promise<AuthUser | null | void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  activeRole: null,
  permissions: [],
  isAdmin: false,
  hasPermission: () => false,
  switchRole: async () => { },
  refresh: async () => { },
  logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

// Role → default landing page mapping
const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard",
  MILK_COLLECTOR: "/admin/catalog/collections",
  DELIVERY_PARTNER: "/delivery/today",
  CUSTOMER: "/customer/home",
};

export function getHomeForRole(role: string): string {
  const normalized = (role || "").toUpperCase().replace(/\s+/g, "_");
  return ROLE_HOME[normalized] || "/admin/dashboard";
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

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("[AuthContext] Backend logout request failed:", err);
    } finally {
      // Clear cookies from document
      document.cookie = "access_token=; Max-Age=0; path=/";
      document.cookie = "refresh_token=; Max-Age=0; path=/";
      document.cookie = "csrf_token=; Max-Age=0; path=/";

      // Clear local storage tokens and keys
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("token");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("f2h_access_token");
      }

      clearCsrfToken();
      setUser(null);

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      } else {
        router.push("/login");
      }
    }
  }, [router]);

  const activeRole = user?.active_role || (user?.roles?.some(r => (r.role_name || r.role_id || '').toUpperCase() === 'ADMIN') ? 'ADMIN' : (user?.roles?.[0]?.role_id || 'CUSTOMER'));
  const userRoleNames = (user?.roles || []).map((r) => (r.role_name || r.role_id || '').toUpperCase().replace(/\s+/g, '_'));
  const isAdmin = Boolean(user?.is_admin) || activeRole === 'ADMIN' || activeRole === 'SUPER_ADMIN' || userRoleNames.includes('ADMIN') || userRoleNames.includes('SUPER_ADMIN');
  const permissions = user?.permissions || [];

  const hasPermission = useCallback((requiredPerms: string | string[]): boolean => {
    if (isAdmin) return true;
    const reqList = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    if (reqList.length === 0) return true;
    return reqList.some((p) => permissions.includes(p));
  }, [isAdmin, permissions]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeRole,
        permissions,
        isAdmin,
        hasPermission,
        switchRole,
        refresh: fetchUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
