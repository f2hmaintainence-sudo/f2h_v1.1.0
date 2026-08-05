// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : AdminSidebar.tsx
// Description : Admin sidebar component with DEVELOPER section for API integrations
//
// ============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardCheck, CalendarCheck, Boxes, AlignLeft, TriangleAlert, Users, Package, Truck, BarChart3, Menu, X, ShoppingCart, Wallet, Settings, ClipboardList, UserCog, Shield, RefreshCw, AlertTriangle, PieChart, ChevronDown, MapPin, Banknote, LineChart, BookOpen, Box, Archive, Factory, Clipboard, Building, Building2, ArrowRightLeft, Container, CreditCard, FileText, ShieldAlert, Ticket, Percent, Gift, TrendingUp, Bell, Layers, Calendar, AlertOctagon, ShoppingBag, Clock, Orbit, Activity, IndianRupee, Target, Zap, Eye, UserCheck, BarChart, Gauge, CalendarOff, Tag, Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const adminNav = [
  {
    label: "OPERATIONS",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Live Orders", href: "/admin/live-orders", icon: ShoppingCart },
      { name: "Live Tracking", href: "/admin/delivery-tracking", icon: MapPin },
    ],
  },
  {
    label: "CUSTOMERS & SUBSCRIPTIONS",
    items: [
      { name: "Customers", href: "/admin/customers/allcustomers", icon: Users },
      { name: "Special Prices", href: "/admin/customers/special-prices", icon: Tag },
      { name: "Subscriptions", href: "/admin/subscriptions/generate-orders", icon: RefreshCw },
    ],
  },

  {
    label: "ORDERS & DELIVERIES",
    items: [
      { name: "Orders", href: "/admin/orders/allorders", icon: ShoppingBag },
      {
        name: "Delivery Operations",
        icon: Truck,
        subItems: [
          { name: "Delivery Runs", href: "/admin/delivery/assign", icon: Zap },
          { name: "Delivery Partners", href: "/admin/delivery/partners", icon: UserCog },
          { name: "Delivery Logs", href: "/admin/delivery/logs", icon: PieChart },
          { name: "Leave Requests", href: "/admin/delivery/leave-requests", icon: CalendarOff },
        ]
      },
      { name: "Containers", href: "/admin/packages/dashboard", icon: Container },
    ],
  },
  {
    label: "CATALOG & INVENTORY",
    items: [
      { name: "Categories", href: "/admin/catalog/categories", icon: Layers },
      { name: "Products", href: "/admin/catalog/products", icon: Package },
      { name: "Offers", href: "/admin/catalog/offers", icon: Tag },
      {
        name: "Inventory & Warehouse",
        icon: Archive,
        subItems: [
          { name: "Warehouses", href: "/admin/warehouse/list", icon: Building },
          { name: "Stock Overview", href: "/admin/inventory/overview", icon: AlignLeft },
          { name: "Stock In/Out", href: "/admin/warehouse/stock-movements", icon: ArrowRightLeft },
          { name: "Dispatch Requirements", href: "/admin/warehouse/dispatch", icon: Truck },
        ]
      },
      {
        name: "Branch Config",
        icon: Settings,
        subItems: [
          { name: "Branches", href: "/admin/branches", icon: Building },
          { name: "Partner Allocation", href: "/admin/branches/partners", icon: UserCheck },
          { name: "Branch Analytics", href: "/admin/branches/analytics", icon: BarChart },
        ]
      },
    ],
  },
  {
    label: "FINANCE & REPORTS",
    items: [
      { name: "Payments & Billing", href: "/admin/finance/payments", icon: CreditCard },
      { name: "Wallet Transactions", href: "/admin/finance/wallet", icon: Wallet },
      { name: "Refunds", href: "/admin/finance/refunds", icon: ArrowRightLeft },
      { name: "Revenue Reports", href: "/admin/reports/revenue", icon: TrendingUp },
    ],
  },
  {
    label: "DEVELOPER",
    items: [
      {
        name: "API Integrations",
        icon: Zap,
        subItems: [
          { name: "Email", href: "/admin/developer/api-integrations/email", icon: Bell },
          { name: "SMS", href: "/admin/developer/api-integrations/sms", icon: FileText },
          { name: "Firebase", href: "/admin/developer/api-integrations/firebase", icon: Layers },
          { name: "Payment Gateway", href: "/admin/developer/api-integrations/payment-gateway", icon: CreditCard },
          { name: "Maps", href: "/admin/developer/api-integrations/maps", icon: MapPin },
        ]
      }
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { name: "Company Profile", href: "/admin/profile/company", icon: Shield },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    adminNav.forEach(group => {
      group.items.forEach((item: any) => {
        if (item.subItems) {
          const isParentActive = item.subItems.some((sub: any) =>
            sub.exact ? pathname === sub.href : (pathname === sub.href || pathname.startsWith(sub.href + "/"))
          );
          if (isParentActive) initial[item.name] = true;
        }
      });
    });
    return initial;
  });
  const activeLinkRef = useRef<HTMLAnchorElement | HTMLDivElement | null>(null);
  useEffect(() => {
    // Also ensure parent is open when pathname changes via other means
    setExpandedMenus(prev => {
      const next = { ...prev };
      let changed = false;
      adminNav.forEach(group => {
        group.items.forEach((item: any) => {
          if (item.subItems) {
            const isParentActive = item.subItems.some((sub: any) =>
              sub.exact ? pathname === sub.href : (pathname === sub.href || pathname.startsWith(sub.href + "/"))
            );
            if (isParentActive && !next[item.name]) {
              next[item.name] = true;
              changed = true;
            }
          }
        });
      });
      return changed ? next : prev;
    });

    const timer = setTimeout(() => {
      if (activeLinkRef.current) {
        activeLinkRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname]);
  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <img src="/assets/log1.webp" alt="F2H" className="h-10 w-auto" />
        {!collapsed && (
          <div>
            <span className="text-lg font-bold text-deep-green tracking-tight">F2H</span>
            <span className="block text-[10px] font-medium text-deep-green/60 uppercase tracking-[0.2em] -mt-0.5">
              Farm to Home
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5 pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {adminNav.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item: any) => {
                if (item.subItems) {
                  const isParentActive = item.subItems.some((sub: any) =>
                    sub.exact ? pathname === sub.href : (pathname === sub.href || pathname.startsWith(sub.href + "/"))
                  );
                  const isExpanded = expandedMenus[item.name];

                  return (
                    <div key={item.name} className="space-y-0.5">
                      <div
                        onClick={() => toggleMenu(item.name)}
                        ref={isParentActive && !isExpanded ? activeLinkRef as any : null}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group ${isParentActive && !isExpanded
                          ? "bg-brand-blue/10 text-brand-blue font-bold"
                          : "text-slate-600 hover:text-brand-blue hover:bg-green-50"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon size={18} className={isParentActive ? "text-brand-blue" : "text-slate-400 group-hover:text-brand-blue"} />
                          {!collapsed && <span>{item.name}</span>}
                        </div>
                        {!collapsed && (
                          <ChevronDown
                            size={16}
                            className={`text-deep-green/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </div>

                      {/* Sub Items */}
                      {isExpanded && !collapsed && (
                        <div className="pl-4 pr-1 mt-1 space-y-1">
                          <div className="pl-3 border-l-[1.5px] border-deep-green/10 py-1 space-y-1">
                            {item.subItems.map((sub: any) => {
                              const isSubActive = sub.exact
                                ? pathname === sub.href
                                : (pathname === sub.href || pathname.startsWith(sub.href + "/"));

                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  ref={isSubActive ? (activeLinkRef as any) : null}
                                  onClick={() => setMobileOpen(false)}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group ${isSubActive
                                    ? "bg-[#388e3c] text-white shadow-md shadow-green-500/20"
                                    : "text-slate-600 hover:text-brand-blue hover:bg-green-50"
                                    }`}
                                >
                                  <sub.icon size={14} className={isSubActive ? "text-white" : "text-deep-green/50 group-hover:text-deep-green"} />
                                  <span>{sub.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular Items
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={isActive ? (activeLinkRef as any) : null}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                      ? "bg-[#388e3c] text-white shadow-lg shadow-green-500/30"
                      : "text-slate-600 hover:text-brand-blue hover:bg-green-50"
                      }`}
                  >
                    <Icon size={18} className={isActive ? "text-white" : "text-slate-400 group-hover:text-brand-blue"} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white text-slate-600 shadow-lg border border-slate-200"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 h-full bg-white shadow-xl border-r border-slate-200">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-deep-green/60 hover:text-deep-green"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-slate-50 border-r border-slate-200 z-40 transition-all duration-300 ${collapsed ? "w-20" : "w-64"
          }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
