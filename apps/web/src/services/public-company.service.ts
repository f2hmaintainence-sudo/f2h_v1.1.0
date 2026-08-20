import { F2H_PUBLIC } from "@/constants/f2hPublicAssets";
import { getApiBaseUrl } from "@/lib/api-config";

export interface PublicCompanyProfile {
  company_name: string;
  logo_url: string;
  website: string;
  email: string;
  phone: string;
  phone_url: string;
  secondary_phone: string;
  secondary_phone_url: string;
  whatsapp: string;
  whatsapp_url: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
}

export const DEFAULT_PUBLIC_COMPANY: PublicCompanyProfile = {
  company_name: "Farm to Home",
  logo_url: F2H_PUBLIC.logo,
  website: "https://f2hfresh.com",
  email: "support@f2hfresh.com",
  phone: "+91 91487 73591",
  phone_url: "tel:+919148773591",
  secondary_phone: "+91 79893 68142",
  secondary_phone_url: "tel:+917989368142",
  whatsapp: "+91 91487 73591",
  whatsapp_url: "https://wa.me/919148773591",
  address: "1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560066",
  instagram_url: "#",
  facebook_url: "#",
  youtube_url: "#",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(
  data: Record<string, unknown>,
  key: keyof PublicCompanyProfile,
): string | undefined {
  const value = data[key];
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizePublicCompany(data: unknown): PublicCompanyProfile {
  if (!isRecord(data)) return DEFAULT_PUBLIC_COMPANY;

  return {
    company_name: readText(data, "company_name") ?? DEFAULT_PUBLIC_COMPANY.company_name,
    logo_url: readText(data, "logo_url") ?? DEFAULT_PUBLIC_COMPANY.logo_url,
    website: readText(data, "website") ?? DEFAULT_PUBLIC_COMPANY.website,
    email: readText(data, "email") ?? DEFAULT_PUBLIC_COMPANY.email,
    phone: readText(data, "phone") ?? DEFAULT_PUBLIC_COMPANY.phone,
    phone_url: readText(data, "phone_url") ?? DEFAULT_PUBLIC_COMPANY.phone_url,
    secondary_phone:
      readText(data, "secondary_phone") ?? DEFAULT_PUBLIC_COMPANY.secondary_phone,
    secondary_phone_url:
      readText(data, "secondary_phone_url") ??
      DEFAULT_PUBLIC_COMPANY.secondary_phone_url,
    whatsapp: readText(data, "whatsapp") ?? DEFAULT_PUBLIC_COMPANY.whatsapp,
    whatsapp_url:
      readText(data, "whatsapp_url") ?? DEFAULT_PUBLIC_COMPANY.whatsapp_url,
    address: readText(data, "address") ?? DEFAULT_PUBLIC_COMPANY.address,
    city: readText(data, "city") ?? DEFAULT_PUBLIC_COMPANY.city,
    state: readText(data, "state") ?? DEFAULT_PUBLIC_COMPANY.state,
    pincode: readText(data, "pincode") ?? DEFAULT_PUBLIC_COMPANY.pincode,
    instagram_url:
      readText(data, "instagram_url") ?? DEFAULT_PUBLIC_COMPANY.instagram_url,
    facebook_url:
      readText(data, "facebook_url") ?? DEFAULT_PUBLIC_COMPANY.facebook_url,
    youtube_url:
      readText(data, "youtube_url") ?? DEFAULT_PUBLIC_COMPANY.youtube_url,
  };
}

export async function fetchPublicCompany(
  signal?: AbortSignal,
): Promise<PublicCompanyProfile> {
  const response = await fetch(`${getApiBaseUrl()}/auth/public/site-settings`, {
    signal,
  });
  if (!response.ok) throw new Error("Unable to load public company details");

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.status !== true) return DEFAULT_PUBLIC_COMPANY;

  return normalizePublicCompany(payload.data);
}
