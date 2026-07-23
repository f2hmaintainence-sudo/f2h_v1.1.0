"use client";

import { useState, useEffect } from "react";
import { FiUser, FiMail, FiPhone, FiMapPin, FiCalendar, FiAtSign, FiGlobe } from "react-icons/fi";
import { Home } from "lucide-react";
import { api } from "@/services/api.client";
import Breadcrumb from "@/components/Breadcrumbs";
import "./profile.css";

type ProfileData = {
  first_name: string; last_name: string;
  email: string; username: string;
  gender: string; date_of_birth: string;
  phone: string; city: string; country: string; state: string; postal_code: string;
  avatar?: string;
  profile?: string;
};

const formatDate = (raw: string) => {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const val = (v?: string) => v?.trim() || "—";

const initials = (first: string, last: string) =>
  ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "U";

const getBackendOrigin = () => {
  const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBase) return envBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }

  return "";
};

const resolveProfileImage = (path?: string, cacheBuster?: string) => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  const backendOrigin = getBackendOrigin();
  const trimmedPath = path.trim();
  const apiPath = `/api/profile/image/${trimmedPath}`;

  const url = backendOrigin ? `${backendOrigin}${apiPath}` : apiPath;
  const cacheBustParam = cacheBuster || Date.now();
  return `${url}?v=${cacheBustParam}`;
};

const Field = ({ icon: Icon, label, value, accent = "#6366f1" }: {
  icon: React.ElementType; label: string; value: string; accent?: string;
}) => (
  <div className="pv-field">
    <div className="pv-field-icon" style={{ "--accent": accent } as React.CSSProperties}>
      <Icon size={13} />
    </div>
    <div className="pv-field-body">
      <span className="pv-field-label">{label}</span>
      <span className={`pv-field-value${value === "—" ? " pv-empty" : ""}`}>{value}</span>
    </div>
  </div>
);

const Section = ({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) => (
  <div className="card pv-card">
    <div className="card-header pv-card-header">
      <div className="pv-dot" style={{ background: dot }} />
      <span className="card-title mb-0">{title}</span>
    </div>
    <div className="card-body pv-card-body">{children}</div>
  </div>
);

const ProfileViewComponent = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await api.get<any>("/resolveNavigation?path=/profile");

      setLoading(false);
      if (!error && data?.status) setProfile(data?.data?.profile ?? null);
    })();
  }, []);

  const p = profile;
  const fullName = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "—" : "—";
  const profileImage = resolveProfileImage(p?.avatar || p?.profile, Date.now().toString());

  useEffect(() => {
    setImageError(false);
  }, [profileImage]);

  return (
    <div className="page-wrapper">
      <div className="content container-fluid">

        <div className="ps-page-header" style={{ marginBottom: 24 }}>
          <Breadcrumb
            title="Profile"
            items={[
              { icon: <Home size={13} /> },
              { label: "Delivery" },
              { label: "Profile" },
            ]}
          />
        </div>

        {loading ? (
          <div className="pv-layout">
            <div className="pv-skel" style={{ height: 280, borderRadius: 16 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[6, 2].map((cols, i) => (
                <div key={i} className="card pv-card">
                  <div className="pv-card-header" style={{ height: 46 }} />
                  <div className="pv-card-body">
                    <div className="pv-fields-grid">
                      {Array.from({ length: cols }).map((_, j) => (
                        <div key={j} className="pv-skel" style={{ height: 54 }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pv-layout">

            {/* Left: Hero */}
            <div className="pv-hero-wrapper">
              <div className="pv-hero">
                <div className="pv-hero-banner" />
                <div className="pv-hero-inner">
                  <div className="pv-avatar">
                    {profileImage && !imageError
                      ? <img src={profileImage} alt="avatar" onError={() => setImageError(true)} />
                      : initials(p?.first_name ?? "", p?.last_name ?? "")
                    }
                  </div>

                  <div>
                    <p className="pv-hero-name">{fullName}</p>
                  </div>

                  {/* ADD THIS BACK */}
                  <div className="pv-hero-hr" />

                  <div className="pv-hero-stats">
                    <div className="pv-hero-stat">
                      <span className="pv-hero-stat-lbl">Gender</span>
                      <span className="pv-hero-stat-val">{val(p?.gender)}</span>
                    </div>
                    <div className="pv-hero-stat">
                      <span className="pv-hero-stat-lbl">Date of Birth</span>
                      <span className="pv-hero-stat-val">{formatDate(p?.date_of_birth ?? "")}</span>
                    </div>
                    <div className="pv-hero-stat">
                      <span className="pv-hero-stat-lbl">City</span>
                      <span className="pv-hero-stat-val">{val(p?.city)}</span>
                    </div>
                    <div className="pv-hero-stat">
                      <span className="pv-hero-stat-lbl">Country</span>
                      <span className="pv-hero-stat-val">{val(p?.country)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Sections */}
            <div>
              <Section dot="#2e7d32" title="Personal Information">
                <div className="pv-fields-grid">
                  <Field icon={FiUser} label="First Name" value={val(p?.first_name)} accent="#2e7d32" />
                  <Field icon={FiUser} label="Last Name" value={val(p?.last_name)} accent="#388e3c" />
                  <Field icon={FiMail} label="Email" value={val(p?.email)} accent="#2e7d32" />
                  <Field icon={FiPhone} label="Phone" value={val(p?.phone)} accent="#388e3c" />
                  <Field icon={FiUser} label="Gender" value={val(p?.gender)} accent="#2e7d32" />
                  <Field icon={FiCalendar} label="Date of Birth" value={formatDate(p?.date_of_birth ?? "")} accent="#388e3c" />
                </div>
              </Section>

              <Section dot="#2e7d32" title="Location">
                <div className="pv-fields-grid">
                  <Field icon={FiMapPin} label="City" value={val(p?.city)} accent="#2e7d32" />
                  <Field icon={FiMapPin} label="State" value={val(p?.state)} accent="#388e3c" />
                  <Field icon={FiGlobe} label="Country" value={val(p?.country)} accent="#2e7d32" />
                  <Field icon={FiMapPin} label="Pincode" value={val(p?.postal_code)} accent="#388e3c" />
                </div>
              </Section>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default ProfileViewComponent;
