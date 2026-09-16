// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : vendors.store.ts
// Description : Real vendor registry store for Next.js web application
// ============================================================================

export interface SuppliedProduct {
  product_id?: string;
  name: string;
  category?: string;
}

export interface VendorRecord {
  id: number;
  vendor_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string | null;
  category: string;
  description?: string | null;
  address?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  gstin?: string | null;
  fssai_license?: string | null;
  supply_capacity?: string | null;
  experience_years?: string | null;
  rating?: number;
  products_supplied?: SuppliedProduct[];
  total_products_supplied?: number;
  is_verified?: boolean;
  is_active?: boolean;
  status?: string;
  image_url?: string | null;
  created_at: string;
}

// Global real vendors array (starts empty - no dummy data)
declare global {
  // eslint-disable-next-line no-var
  var __F2H_REGISTERED_VENDORS__: VendorRecord[] | undefined;
}

if (!global.__F2H_REGISTERED_VENDORS__) {
  global.__F2H_REGISTERED_VENDORS__ = [];
}

export function getRegisteredVendors(category?: string | null, search?: string | null): VendorRecord[] {
  let list = global.__F2H_REGISTERED_VENDORS__ || [];

  if (category && category !== 'All' && category.trim() !== '') {
    const catLower = category.trim().toLowerCase();
    list = list.filter((v) => v.category.toLowerCase().includes(catLower));
  }

  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (v) =>
        v.business_name.toLowerCase().includes(q) ||
        v.contact_person.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.products_supplied && v.products_supplied.some((p) => p.name.toLowerCase().includes(q))),
    );
  }

  return list;
}

export function addRegisteredVendor(vendor: Omit<VendorRecord, 'id' | 'created_at'>): VendorRecord {
  const store = global.__F2H_REGISTERED_VENDORS__ || [];
  
  const record: VendorRecord = {
    ...vendor,
    id: Date.now(),
    created_at: new Date().toISOString(),
  };

  // Prepend so latest registered appears first
  store.unshift(record);
  global.__F2H_REGISTERED_VENDORS__ = store;
  return record;
}
