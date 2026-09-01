"use client";

import { useAuth, getHomeForRole } from "@/context/AuthContext";
import { ChevronDown, LogOut, User, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationPanel } from "./NotificationPanel";

export function AdminHeader() {
  const router = useRouter();
  const { user, activeRole, switchRole, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  const displayName = user?.first_name || user?.user_name || user?.email?.split("@")[0] || "User";
  const currentRoleName = user?.roles.find((r) => r.role_id === activeRole)?.role_name || "Admin";

  const getBackendOrigin = () => {
    const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (envBase) return envBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
    if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.host}`;
    return "";
  };

  const resolveProfileImage = (path?: string, cacheBuster?: string) => {
    if (!path) return "";
    if (/^(https?:|data:|blob:)/i.test(path)) return path;

    const trimmedPath = path.trim();
    const apiPath = `/api/profile/image/${trimmedPath}`;
    const backendOrigin = getBackendOrigin();
    const url = backendOrigin ? `${backendOrigin}${apiPath}` : apiPath;
    const cacheBustParam = cacheBuster || Date.now();
    return `${url}?v=${cacheBustParam}`;
  };

  const profileImage = resolveProfileImage((user as any)?.avatar || (user as any)?.profile, Date.now().toString());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setImgError(false);
  }, [profileImage]);

  return (
    <header className="h-16 bg-white/75 backdrop-blur-2xl border-b border-gray-100 shadow-sm flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Page breadcrumb area */}
      <div className="flex items-center gap-4 pl-8 lg:pl-0">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          {activeRole === "ADMIN" ? "Admin Panel" : activeRole === "DELIVERY_PARTNER" ? "Delivery" : "Dashboard"}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* End-to-end encrypted badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200/60">
          <ShieldCheck size={14} className="text-brand-blue" />
          <span className="text-xs font-semibold text-[#2e7d32] tracking-tight">End-to-End Encrypted</span>
        </div>



        {/* Notifications */}
        <NotificationPanel />

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#2e7d32]-200 bg-[#2e7d32]"
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-brand-blue text-xs font-bold">
              {profileImage && !imgError ? (
                <img
                  src={profileImage}
                  alt={displayName}
                  onError={() => setImgError(true)}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                displayName[0]?.toUpperCase()
              )}
            </div>
            <span className="hidden sm:block text-sm font-semibold text-white">{displayName}</span>
            <ChevronDown size={14} className="hidden sm:block text-green-200" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  router.push("/admin/profile");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <User size={16} /> Profile
              </button>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
