// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : layout.tsx
// Description : Panel layout guard for web application
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import dynamic from "next/dynamic";
import { AuthProvider, useAuth, getHomeForRole } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { AdminSidebar } from "@/components/f2h/AdminSidebar";
import { AdminHeader } from "@/components/f2h/AdminHeader";
import { DeliveryHeader } from "@/components/f2h/Deliveryheader";
import { DeliverySidebar } from "@/components/f2h/Deliverysidebar";
import { ToastContainer } from "@/components/Toast";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const RealtimeNotifications = dynamic(
  () => import("@/components/f2h/RealtimeNotifications").then((mod) => mod.RealtimeNotifications),
  { ssr: false }
);

function PanelGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, activeRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    // Strict role-based route guard
    const userHasAdmin = user.roles?.some((r: any) => (r.role_name || r.role_id || '').toUpperCase() === 'ADMIN');
    const role = activeRole || (userHasAdmin ? "ADMIN" : "CUSTOMER");
    const home = getHomeForRole(role);
    const isAdminPath = pathname.startsWith("/admin");
    const isDeliveryPath = pathname.startsWith("/delivery");
    const isCustomerPath = pathname.startsWith("/customer");

    if (role === "ADMIN" && !isAdminPath) {
      router.replace(home);
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
  }, [user, loading, activeRole, pathname, router]);

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

  // Determine which layout to show
  const isDelivery = pathname.startsWith("/delivery");
  const isAdmin = pathname.startsWith("/admin");
  const isCustomer = pathname.startsWith("/customer");

  if (isAdmin && activeRole === "ADMIN") {
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

  // if (isDelivery && activeRole === "DELIVERY_PARTNER") {
  //   return (
  //     <div className="min-h-screen bg-slate-50">
  //       {/* Sidebar — hidden on mobile, shown on lg+ */}
  //       <DeliverySidebar />
  //       {/* Main content area shifted right on desktop to account for sidebar */}
  //       <div className="lg:ml-64 transition-all duration-300 flex flex-col min-h-screen">
  //         <DeliveryHeader />
  //         {/* pb-20 on mobile so bottom nav doesn't overlap content */}
  //         <main className="flex-1 p-4 md:p-6 pb-24 lg:pb-6">{children}</main>
  //       </div>
  //       {/* Bottom nav — mobile only */}
  //     </div>
  //   );
  // }

  // if (isCustomer && activeRole === "CUSTOMER") {
  //   return (
  //     <div className="min-h-screen bg-slate-50">
  //       <header className="h-16 bg-white/75 backdrop-blur-xl border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
  //         <div className="flex items-center gap-3">
  //           <img src="/assets/log1.webp" alt="F2H" className="h-8 w-auto" />
  //           <h1 className="text-base font-semibold text-[#2e7d32]">Customer Panel</h1>
  //         </div>
  //         <button
  //           onClick={() => router.replace("/login")}
  //           className="text-xs font-medium text-brand-blue hover:text-green-800 transition-colors"
  //         >
  //           Switch Account
  //         </button>
  //       </header>
  //       <main className="p-4 md:p-6 max-w-4xl mx-auto">{children}</main>
  //     </div>
  //   );
  // }

  // Default: show with admin sidebar for any other case
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

// function DeliveryBottomNav() {
//   const pathname = usePathname();
//   const navItems = [
//     { name: "List", href: "/delivery/today", icon: "📋" },
//     { name: "Map", href: "/delivery/map", icon: "🗺️" },
//     { name: "Profile", href: "/delivery/profile", icon: "👤" },
//   ];

//   return (
//     <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
//       <div className="max-w-lg mx-auto flex items-center justify-around py-2">
//         {navItems.map((item) => {
//           const isActive = pathname === item.href;
//           return (
//             <a
//               key={item.href}
//               href={item.href}
//               className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-xs font-medium transition-all ${
//                 isActive ? "text-blue-600" : "text-gray-500"
//               }`}
//             >
//               <span className="text-lg">{item.icon}</span>
//               <span>{item.name}</span>
//               {isActive && <span className="w-1 h-1 rounded-full bg-blue-600" />}
//             </a>
//           );
//         })}
//       </div>
//     </nav>
//   );
// }

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastContainer />
        <RealtimeNotifications />
        <PanelGuard>{children}</PanelGuard>
      </NotificationProvider>
    </AuthProvider>
  );
}
