// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : AdminSidebar.tsx
// Description : Dynamic admin sidebar driven purely by database roles & permissions
//
// ============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  Receipt,
  TicketPercent,
  RotateCcw,
  ArrowLeftRight,
  AlignLeft,
  Users,
  Package,
  Truck,
  Menu,
  X,
  ShoppingCart,
  Wallet,
  Settings,
  UserCog,
  Shield,
  RefreshCw,
  PieChart,
  ChevronDown,
  MapPin,
  IndianRupee,
  Archive,
  Building,
  Building2,
  ArrowRightLeft,
  Container,
  CreditCard,
  FileText,
  Gift,
  TrendingUp,
  Bell,
  Layers,
  ShoppingBag,
  Zap,
  UserCheck,
  BarChart,
  CalendarOff,
  Tag,
  UserPlus,
  Sliders,
  Smartphone,
  Radio,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

export interface NavSubItem {
  name: string;
  href: string;
  icon: any;
  permissions: string[];
  exact?: boolean;
}

export interface NavItem {
  name: string;
  href?: string;
  icon: any;
  permissions?: string[];
  subItems?: NavSubItem[];
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const adminNav: NavGroup[] = [
  {
    label: "OPERATIONS",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, permissions: ["dashboard.view", "dashboard.analytics"] },
      { name: "Live Orders", href: "/admin/live-orders", icon: ShoppingCart, permissions: ["orders.view", "orders.manage"] },
      { name: "Live Tracking", href: "/admin/delivery-tracking", icon: MapPin, permissions: ["delivery.view", "delivery.logs.view"] },
    ],
  },
  {
    label: "CUSTOMERS & SUBSCRIPTIONS",
    items: [
      { name: "Customers", href: "/admin/customers/allcustomers", icon: Users, permissions: ["customers.view", "customers.manage"] },
      { name: "Special Prices", href: "/admin/customers/special-prices", icon: Tag, permissions: ["customers.special_prices", "customers.view", "customers.manage"] },
      { name: "Subscriptions", href: "/admin/subscriptions/generate-orders", icon: RefreshCw, permissions: ["subscriptions.view", "subscriptions.manage"] },
      { name: "Refund Candidates", href: "/admin/subscriptions/refund-candidates", icon: RotateCcw, permissions: ["subscriptions.refunds", "subscriptions.view"] },
    ],
  },
  {
    label: "ORDERS & DELIVERIES",
    items: [
      { name: "Orders", href: "/admin/orders/allorders", icon: ShoppingBag, permissions: ["orders.view", "orders.manage"] },
      { name: "Delivery Runs", href: "/admin/delivery/assign", icon: Zap, permissions: ["delivery.assign", "delivery.view"] },
    ],
  },
  {
    label: "DELIVERIES PARTNERS",
    items: [
      { name: "Partner Requests", href: "/admin/delivery/partner-requests", icon: UserPlus, permissions: ["delivery.partners.manage", "delivery.view"] },
      { name: "Partner Availability", href: "/admin/delivery/partner-availability", icon: PieChart, permissions: ["delivery.view", "delivery.partners.manage"] },
      { name: "Delivery Partners", href: "/admin/delivery/partners", icon: UserCog, permissions: ["delivery.partners.manage", "delivery.view"] },
      { name: "Referral Payments", href: "/admin/delivery/referral-payments", icon: Gift, permissions: ["delivery.referrals", "delivery.view"] },
      { name: "Leave Requests", href: "/admin/delivery/leave-requests", icon: CalendarOff, permissions: ["delivery.leave_requests", "delivery.view"] },
    ],
  },
  {
    label: "CATALOG & INVENTORY",
    items: [
      { name: "Products", href: "/admin/catalog/products", icon: Package, permissions: ["catalog.view", "catalog.manage", "catalog.pricing", "catalog.categories"] },
      { name: "Vendors", href: "/admin/catalog/vendors", icon: Building2, permissions: ["vendors.view", "vendors.manage"] },
      { name: "Daily Collections", href: "/admin/catalog/collections", icon: ClipboardCheck, permissions: ["vendors.collections.view", "vendors.collections.create", "vendors.collections.manage", "vendors.slips.send"] },
      { name: "Promotions Coupons", href: "/admin/catalog/promotions-coupons", icon: TicketPercent, permissions: ["catalog.promotions", "catalog.view"] },
      {
        name: "Inventory & Warehouse",
        icon: Archive,
        subItems: [
          { name: "Warehouses", href: "/admin/warehouse/list", icon: Building, permissions: ["warehouse.view", "inventory.view"] },
          { name: "Stock Overview", href: "/admin/inventory/overview", icon: AlignLeft, permissions: ["inventory.view", "inventory.manage"] },
          { name: "Stock In/Out", href: "/admin/warehouse/stock-movements", icon: ArrowRightLeft, permissions: ["warehouse.stock_movements", "inventory.view"] },
          { name: "Dispatch", href: "/admin/warehouse/dispatch", icon: Truck, permissions: ["warehouse.dispatch", "inventory.view"] },
          { name: "Containers", href: "/admin/packages/dashboard", icon: Container, permissions: ["packages.containers", "inventory.view"] },
        ],
      },
      {
        name: "Branch Config",
        icon: Settings,
        subItems: [
          { name: "Branches", href: "/admin/branches/branch-config", icon: Building, permissions: ["branches.view", "branches.manage"] },
          { name: "Partner Allocation", href: "/admin/branches/partners", icon: UserCheck, permissions: ["branches.manage", "delivery.partners.manage", "branches.view"] },
          { name: "Branch Analytics", href: "/admin/branches/analytics", icon: BarChart, permissions: ["branches.view", "dashboard.analytics"] },
          { name: "Zone Requests", href: "/admin/branches/zone-expansion", icon: Radio, permissions: ["branches.zones", "branches.view"] },
        ],
      },
    ],
  },
  {
    label: "STAFF & PERMISSIONS",
    items: [
      { name: "Staff Members", href: "/admin/staffs", icon: Users, permissions: ["staff.view", "staff.manage"] },
      { name: "Roles & Permissions", href: "/admin/system/roles", icon: Shield, permissions: ["system.roles", "staff.roles"] },
    ],
  },
  {
    label: "FINANCE & REPORTS",
    items: [
      {
        name: "Billing",
        icon: Receipt,
        subItems: [
          { name: "Billing", href: "/admin/finance/billing", icon: Receipt, permissions: ["finance.billing", "finance.view"] },
          { name: "Outstandings", href: "/admin/finance/outstandings", icon: IndianRupee, permissions: ["finance.outstandings", "finance.view"] },
          { name: "Payments", href: "/admin/finance/payments", icon: CreditCard, permissions: ["finance.manage", "finance.view"] },
        ],
      },
      {
        name: "Wallet",
        icon: Wallet,
        subItems: [
          { name: "Wallet Transactions", href: "/admin/finance/wallet", icon: ArrowLeftRight, permissions: ["finance.wallet", "finance.view"] },
          { name: "Refunds", href: "/admin/finance/refunds", icon: RotateCcw, permissions: ["finance.refunds", "finance.view"] },
        ],
      },
      {
        name: "Revenue Reports",
        href: "/admin/reports/revenue",
        icon: TrendingUp,
        permissions: ["reports.view", "reports.export", "dashboard.analytics"],
      },
    ],
  },
  {
    label: "DEVELOPER",
    items: [
      {
        name: "API Integrations",
        icon: Zap,
        subItems: [
          { name: "Email", href: "/admin/developer/api-integrations/email", icon: Bell, permissions: ["developer.api_integrations", "system.admins"] },
          { name: "SMS", href: "/admin/developer/api-integrations/sms", icon: FileText, permissions: ["developer.api_integrations", "system.admins"] },
          { name: "Firebase", href: "/admin/developer/api-integrations/firebase", icon: Layers, permissions: ["developer.api_integrations", "system.admins"] },
          { name: "Payment Gateway", href: "/admin/developer/api-integrations/payment-gateway", icon: CreditCard, permissions: ["developer.api_integrations", "system.admins"] },
          { name: "Maps", href: "/admin/developer/api-integrations/maps", icon: MapPin, permissions: ["developer.api_integrations", "system.admins"] },
        ],
      },
      {
        name: "Configurations",
        href: "/admin/developer/config",
        icon: Sliders,
        permissions: ["developer.api_integrations", "system.admins"],
      },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { name: "Company Profile", href: "/admin/profile/company", icon: Shield, permissions: ["system.admins", "dashboard.view"] },
      { name: "App Version Control", href: "/admin/system/app-version", icon: Smartphone, permissions: ["system.version_control", "system.admins"] },
      { name: "Audit Logs", href: "/admin/system/audit", icon: FileText, permissions: ["system.audit", "system.admins"] },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { isAdmin, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Dynamically compute visible navigation purely from database permissions (Admin role has full access bypass)
  const visibleNav = useMemo(() => {
    if (isAdmin) {
      return adminNav;
    }

    return adminNav
      .map((group) => {
        const filteredItems = group.items
          .map((item) => {
            if (item.subItems) {
              const visibleSubItems = item.subItems.filter((sub) =>
                hasPermission(sub.permissions || [])
              );
              if (visibleSubItems.length > 0) {
                return { ...item, subItems: visibleSubItems };
              }
              return null;
            }
            if (hasPermission(item.permissions || [])) {
              return item;
            }
            return null;
          })
          .filter(Boolean) as NavItem[];

        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [isAdmin, hasPermission]);

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    visibleNav.forEach((group) => {
      group.items.forEach((item) => {
        if (item.subItems) {
          const isParentActive = item.subItems.some((sub) =>
            sub.exact ? pathname === sub.href : pathname === sub.href || pathname.startsWith(sub.href + "/")
          );
          if (isParentActive) initial[item.name] = true;
        }
      });
    });
    return initial;
  });

  const activeLinkRef = useRef<HTMLAnchorElement | HTMLDivElement | null>(null);

  useEffect(() => {
    // Ensure parent menu is expanded when pathname matches subitem
    setExpandedMenus((prev) => {
      const next = { ...prev };
      let changed = false;
      visibleNav.forEach((group) => {
        group.items.forEach((item) => {
          if (item.subItems) {
            const isParentActive = item.subItems.some((sub) =>
              sub.exact ? pathname === sub.href : pathname === sub.href || pathname.startsWith(sub.href + "/")
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
  }, [pathname, visibleNav]);

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
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5 pb-24 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
        {visibleNav.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (item.subItems) {
                  const isParentActive = item.subItems.some((sub) =>
                    sub.exact ? pathname === sub.href : pathname === sub.href || pathname.startsWith(sub.href + "/")
                  );
                  const isExpanded = expandedMenus[item.name];

                  return (
                    <div key={item.name} className="space-y-0.5">
                      <div
                        onClick={() => toggleMenu(item.name)}
                        ref={isParentActive && !isExpanded ? (activeLinkRef as any) : null}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group ${isParentActive && !isExpanded
                          ? "bg-brand-blue/10 text-brand-blue font-bold"
                          : "text-slate-600 hover:text-brand-blue hover:bg-green-50"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon
                            size={18}
                            className={isParentActive ? "text-brand-blue" : "text-slate-400 group-hover:text-brand-blue"}
                          />
                          {!collapsed && <span>{item.name}</span>}
                        </div>
                        {!collapsed && (
                          <ChevronDown
                            size={16}
                            className={`text-deep-green/40 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                              }`}
                          />
                        )}
                      </div>

                      {/* Sub Items */}
                      {isExpanded && !collapsed && (
                        <div className="pl-4 pr-1 mt-1 space-y-1">
                          <div className="pl-3 border-l-[1.5px] border-deep-green/10 py-1 space-y-1">
                            {item.subItems.map((sub) => {
                              const isSubActive = sub.exact
                                ? pathname === sub.href
                                : pathname === sub.href || pathname.startsWith(sub.href + "/");

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
                                  <sub.icon
                                    size={14}
                                    className={isSubActive ? "text-white" : "text-deep-green/50 group-hover:text-deep-green"}
                                  />
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
                const isActive = pathname === item.href || (item.href && pathname.startsWith(item.href + "/"));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href || item.name}
                    href={item.href || "#"}
                    ref={isActive ? (activeLinkRef as any) : null}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                      ? "bg-[#388e3c] text-white shadow-lg shadow-green-500/30"
                      : "text-slate-600 hover:text-brand-blue hover:bg-green-50"
                      }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? "text-white" : "text-slate-400 group-hover:text-brand-blue"}
                    />
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
