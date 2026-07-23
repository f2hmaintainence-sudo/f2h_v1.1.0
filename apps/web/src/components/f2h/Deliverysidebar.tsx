"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bike,
} from "lucide-react";
import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NavChild {
  name: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: "pending" | "delivered";
}
interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: NavChild[];
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─── Navigation config ────────────────────────────────────────────────────────
const deliveryNav: NavGroup[] = [
  {
    label: "MAIN",
    items: [
      { name: "Dashboard", href: "/delivery/dashboard", icon: LayoutDashboard },
      {
        name: "Today's Deliveries",
        href: "/delivery/today",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "RECORDS",
    items: [
      { name: "History", href: "/delivery/history", icon: History },
    ],
  },
];

// ─── Mock today stats — replace with real API data ────────────────────────────
const todayStats = { total: 12, delivered: 7, pending: 5 };

// ─── Component ────────────────────────────────────────────────────────────────
export function DeliverySidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(
    pathname.startsWith("/delivery/today")
  );

  const deliveredPct = Math.round(
    (todayStats.delivered / todayStats.total) * 100
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Logo + collapse toggle ─────────────────────────────────────── */}
      <div
        className={`flex items-center px-4 pt-5 pb-4 gap-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <img src="/assets/log1.webp" alt="F2H" className="h-9 w-auto" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-fresh-green shadow-md">
              <Bike size={9} className="text-white" />
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-[17px] font-bold text-white tracking-tight leading-none">
                F2H
              </span>
              <span className="block text-[10px] font-semibold text-white/45 uppercase tracking-[0.2em] mt-0.5">
                Delivery
              </span>
            </div>
          )}
        </div>
        {/* Collapse toggle — desktop only */}
        {!mobileOpen && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex flex-shrink-0 h-6 w-6 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all"
          >
            <ChevronRight
              size={13}
              className={`transition-transform duration-300 ${
                collapsed ? "" : "rotate-180"
              }`}
            />
          </button>
        )}
      </div>


      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4 scrollbar-thin">
        {deliveryNav.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                {group.label}
              </p>
            ) : (
              <div className="my-1.5 border-t border-white/10" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const hasChildren = !!item.children?.length;
                const isParentActive =
                  hasChildren &&
                  item.children!.some(
                    (c) =>
                      pathname === c.href ||
                      pathname.startsWith(c.href + "/")
                  );
                const isActive =
                  !hasChildren &&
                  (pathname === item.href ||
                    pathname.startsWith(item.href + "/"));
                const Icon = item.icon;

                return (
                  <div key={item.href}>
                    {/* Nav row */}
                    {hasChildren ? (
                      <button
                        onClick={() =>
                          !collapsed && setTodayOpen(!todayOpen)
                        }
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                          collapsed ? "justify-center" : ""
                        } ${
                          isParentActive
                            ? "bg-white/10 text-white"
                            : "text-white/65 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={`flex-shrink-0 ${
                            isParentActive
                              ? "text-fresh-green"
                              : "text-white/45 group-hover:text-white/75"
                          }`}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">
                              {item.name}
                            </span>
                            {todayStats.pending > 0 && (
                              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400/20 px-1.5 text-[10px] font-bold text-amber-400">
                                {todayStats.pending}
                              </span>
                            )}
                            <ChevronDown
                              size={13}
                              className={`ml-1 text-white/25 transition-transform duration-200 ${
                                todayOpen ? "rotate-180" : ""
                              }`}
                            />
                          </>
                        )}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                          collapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-fresh-green text-white shadow-lg shadow-fresh-green/25"
                            : "text-white/65 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={`flex-shrink-0 ${
                            isActive
                              ? "text-white"
                              : "text-white/45 group-hover:text-white/75"
                          }`}
                        />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    )}

                    {/* Sub-items */}
                    {hasChildren && !collapsed && todayOpen && (
                      <div className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                        {item.children!.map((child) => {
                          const isChildActive =
                            pathname === child.href ||
                            pathname.startsWith(child.href + "/");
                          const ChildIcon = child.icon;
                          const count =
                            child.badgeKey === "pending"
                              ? todayStats.pending
                              : child.badgeKey === "delivered"
                              ? todayStats.delivered
                              : null;
                          const isPending = child.badgeKey === "pending";

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group ${
                                isChildActive
                                  ? isPending
                                    ? "bg-amber-400/15 text-amber-300"
                                    : "bg-fresh-green/15 text-fresh-green"
                                  : "text-white/50 hover:text-white hover:bg-white/8"
                              }`}
                            >
                              <ChildIcon
                                size={15}
                                className={`flex-shrink-0 ${
                                  isChildActive
                                    ? isPending
                                      ? "text-amber-400"
                                      : "text-fresh-green"
                                    : "text-white/30 group-hover:text-white/55"
                                }`}
                              />
                              <span className="flex-1">{child.name}</span>
                              {count !== null && (
                                <span
                                  className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                    isPending
                                      ? "bg-amber-400/20 text-amber-400"
                                      : "bg-fresh-green/20 text-fresh-green"
                                  }`}
                                >
                                  {count}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
      {/* ── Mobile hamburger ─────────────────────────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-deep-green text-white shadow-xl shadow-black/25 active:scale-95 transition-transform"
      >
        <Menu size={20} />
      </button>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-deep-green shadow-2xl shadow-black/40 flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-deep-green z-40 transition-all duration-300 ease-in-out ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

// ─── Sub-component: Stat pill ─────────────────────────────────────────────────
function StatPill({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "neutral" | "green" | "amber";
}) {
  const styles = {
    neutral: "bg-white/8 text-white text-white/40",
    green: "bg-fresh-green/20 text-fresh-green text-fresh-green/60",
    amber: "bg-amber-400/15 text-amber-400 text-amber-400/60",
  };
  const [bg, valueColor, labelColor] = styles[color].split(" ");

  return (
    <div className={`flex flex-col items-center rounded-xl py-2 px-1 ${bg}`}>
      <span className={`text-base font-bold leading-none ${valueColor}`}>
        {value}
      </span>
      <span className={`text-[9px] mt-0.5 uppercase tracking-wide ${labelColor}`}>
        {label}
      </span>
    </div>
  );
}