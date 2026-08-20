export interface CompanyProfileRecord {
  id?: string;
  name?: unknown;
  legal_name?: unknown;
  gst_number?: unknown;
  pan_number?: unknown;
  email?: unknown;
  phone?: unknown;
  secondary_phone?: unknown;
  whatsapp?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
  logo_url?: unknown;
  website?: unknown;
  instagram_url?: unknown;
  facebook_url?: unknown;
  youtube_url?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface EditableCompanyProfile {
  id: string;
  name: string;
  legal_name: string;
  gst_number: string;
  pan_number: string;
  email: string;
  phone: string;
  secondary_phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  logo_url: string;
  website: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  created_at: unknown | null;
  updated_at: unknown | null;
}

export interface PublicCompanyProfile {
  company_name: string;
  name: string;
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

export interface SiteSettingRow {
  key: string;
  value: string;
}

type LegacySiteSettings = Record<string, unknown>;

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return '';
};

const sanitizeHttpUrl = (value: unknown, allowRelative = false): string => {
  const candidate = text(value);
  if (!candidate) return '';
  if (
    allowRelative &&
    candidate.startsWith('/') &&
    !candidate.startsWith('//')
  ) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
};

const sanitizeTelephoneUrl = (value: unknown): string => {
  const candidate = text(value);
  if (!candidate.toLowerCase().startsWith('tel:')) return '';
  return buildTelephoneUrl(candidate.slice(4));
};

const sanitizeWhatsAppUrl = (value: unknown): string => {
  const candidate = text(value);
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' &&
      (hostname === 'wa.me' || hostname === 'api.whatsapp.com')
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
};

export const buildTelephoneUrl = (phone: unknown): string => {
  const normalized = text(phone).replace(/(?!^\+)[^\d]/g, '');
  return normalized ? `tel:${normalized}` : '';
};

export const buildWhatsAppUrl = (phone: unknown): string => {
  const digits = text(phone).replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
};

export const parseSiteSettings = (
  rows: SiteSettingRow[],
): LegacySiteSettings => {
  const settings: LegacySiteSettings = {};

  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }

  return settings;
};

export const buildEditableCompanyProfile = (
  profile: CompanyProfileRecord | null | undefined,
  legacy: LegacySiteSettings,
): EditableCompanyProfile => ({
  id: text(profile?.id),
  name: firstText(profile?.name, legacy.company_name, legacy.name, 'F2H Fresh'),
  legal_name: text(profile?.legal_name),
  gst_number: text(profile?.gst_number),
  pan_number: text(profile?.pan_number),
  email: firstText(profile?.email, legacy.email),
  phone: firstText(profile?.phone, legacy.phone),
  secondary_phone: firstText(profile?.secondary_phone, legacy.secondary_phone),
  whatsapp: firstText(profile?.whatsapp, legacy.whatsapp),
  address: firstText(profile?.address, legacy.address),
  city: firstText(profile?.city, legacy.city),
  state: firstText(profile?.state, legacy.state),
  pincode: firstText(profile?.pincode, legacy.pincode),
  logo_url: firstText(profile?.logo_url, legacy.logo_url),
  website: firstText(profile?.website, legacy.website),
  instagram_url: firstText(profile?.instagram_url, legacy.instagram_url),
  facebook_url: firstText(profile?.facebook_url, legacy.facebook_url),
  youtube_url: firstText(profile?.youtube_url, legacy.youtube_url),
  created_at: profile?.created_at ?? null,
  updated_at: profile?.updated_at ?? null,
});

export const formatCompanyAddress = (
  profile: CompanyProfileRecord | null | undefined,
  legacy: LegacySiteSettings = {},
): string => {
  const canonicalParts = [
    profile?.address,
    profile?.city,
    profile?.state,
    profile?.pincode,
  ]
    .map(text)
    .filter(Boolean);

  return canonicalParts.join(', ') || text(legacy.address);
};

export const buildPublicCompanyProfile = (
  profile: CompanyProfileRecord | null | undefined,
  legacy: LegacySiteSettings,
): PublicCompanyProfile => {
  const companyName = firstText(
    profile?.name,
    legacy.company_name,
    legacy.name,
    'F2H Fresh',
  );
  const phone = firstText(profile?.phone, legacy.phone);
  const secondaryPhone = firstText(
    profile?.secondary_phone,
    legacy.secondary_phone,
  );
  const whatsapp = firstText(profile?.whatsapp, legacy.whatsapp, phone);

  return {
    company_name: companyName,
    name: companyName,
    logo_url: sanitizeHttpUrl(
      firstText(profile?.logo_url, legacy.logo_url),
      true,
    ),
    website: sanitizeHttpUrl(firstText(profile?.website, legacy.website)),
    email: firstText(profile?.email, legacy.email),
    phone,
    phone_url:
      buildTelephoneUrl(phone) || sanitizeTelephoneUrl(legacy.phone_url),
    secondary_phone: secondaryPhone,
    secondary_phone_url:
      buildTelephoneUrl(secondaryPhone) ||
      sanitizeTelephoneUrl(legacy.secondary_phone_url),
    whatsapp,
    whatsapp_url:
      buildWhatsAppUrl(whatsapp) || sanitizeWhatsAppUrl(legacy.whatsapp_url),
    address: formatCompanyAddress(profile, legacy),
    city: firstText(profile?.city, legacy.city),
    state: firstText(profile?.state, legacy.state),
    pincode: firstText(profile?.pincode, legacy.pincode),
    instagram_url: sanitizeHttpUrl(
      firstText(profile?.instagram_url, legacy.instagram_url),
    ),
    facebook_url: sanitizeHttpUrl(
      firstText(profile?.facebook_url, legacy.facebook_url),
    ),
    youtube_url: sanitizeHttpUrl(
      firstText(profile?.youtube_url, legacy.youtube_url),
    ),
  };
};
