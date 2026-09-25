// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : layout.tsx
// Description : Panel layout guard for web application with dynamic DB permission validation
//
// ============================================================================

"use client";

import { AuthProvider, useAuth, getHomeForRole } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { AdminSidebar, adminNav } from "@/components/f2h/AdminSidebar";
import { AdminHeader } from "@/components/f2h/AdminHeader";
import { RealtimeNotifications } from "@/components/f2h/RealtimeNotifications";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";

function PanelGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, activeRole, isAdmin, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Compute all permitted hrefs for the current user based on database role_permissions
  const permittedHrefs = useMemo(() => {
    if (isAdmin) return []; // Admin has full unrestricted access
    const hrefs: string[] = [];
    adminNav.forEach((group) => {
      group.items.forEach((item) => {
        if (item.subItems) {
          item.subItems.forEach((sub) => {
            if (hasPermission(sub.permissions || [])) {
              hrefs.push(sub.href);
            }
          });
        } else if (hasPermission(item.permissions || [])) {
          if (item.href) hrefs.push(item.href);
        }
      });
    });
    return hrefs;
  }, [isAdmin, hasPermission]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    const role = activeRole || (isAdmin ? "ADMIN" : "CUSTOMER");
    const home = getHomeForRole(role);
    const isAdminPath = pathname.startsWith("/admin");
    const isDeliveryPath = pathname.startsWith("/delivery");
    const isCustomerPath = pathname.startsWith("/customer");

    // Admin / Super Admin bypass
    if (isAdmin) {
      if (!isAdminPath) {
        router.replace(home);
      }
      return;
    }

    if (role === "DELIVERY_PARTNER" && !isDeliveryPath) {
      router.replace(home);
      return;
    }

    if (role === "CUSTOMER" && !isCustomerPath) {
      router.replace(home);
      return;
    }

    // Dynamic database permission route checking for all non-admin panel roles
    if (isAdminPath) {
      // Profile and settings pages are always accessible to logged-in users
      if (pathname === '/admin/profile' || pathname.startsWith('/admin/profile/')) {
        return;
      }

      const isCurrentAllowed = permittedHrefs.some(
        (href) => pathname === href || pathname.startsWith(href + '/')
      );

      if (!isCurrentAllowed && permittedHrefs.length > 0) {
        // Redirect to the user's first permitted route
        router.replace(permittedHrefs[0]);
      }
    }
  }, [user, loading, activeRole, isAdmin, permittedHrefs, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/assets/log1.webp" alt="F2H" className="h-12 w-auto opacity-60" />
          <div className="w-9 h-9 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading your panel...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <AdminHeader />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RealtimeNotifications />
        <PanelGuard>{children}</PanelGuard>
      </NotificationProvider>
    </AuthProvider>
  );
}
