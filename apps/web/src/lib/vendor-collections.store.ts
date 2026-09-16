// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : vendor-collections.store.ts
// Description : Daily vendor procurement & milk collection data store
// ============================================================================

export interface VendorCollectionRecord {
  id: number;
  collection_id: string;
  collection_date: string; // YYYY-MM-DD
  shift: 'MORNING' | 'EVENING' | 'AFTERNOON' | 'GENERAL';
  vendor_id: string;
  vendor_name: string;
  collector_name: string;
  collector_phone?: string | null;
  product_id?: string | null;
  product_name: string;
  category: string;
  quantity: number;
  unit: string; // 'Liters', 'Kg', 'Units', 'Crates'
  rate_per_unit: number;
  total_amount: number;

  // Dairy & Milk Quality
  fat_percentage?: number | null; // e.g. 4.5
  snf_percentage?: number | null; // e.g. 8.5
  clr_reading?: number | null;    // Lactometer reading e.g. 28.5
  temperature?: number | null;    // °C e.g. 4.2
  acidity?: number | null;        // pH e.g. 6.6
  quality_grade?: string | null;  // 'Grade A', 'Grade B', 'Premium', etc.
  container_can_no?: string | null; // e.g. 'CAN-01'

  // Payment & Tracking
  payment_status: 'PENDING' | 'PAID' | 'PARTIAL';
  payment_mode?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT' | null;
  payment_reference?: string | null;
  notes?: string | null;
  extra_attributes?: Record<string, any>;
  status: 'RECORDED' | 'VERIFIED' | 'REJECTED' | 'CANCELLED';

  created_at: string;
  updated_at?: string;
}

export interface CollectionSummary {
  totalQuantity: number;
  morningQuantity: number;
  eveningQuantity: number;
  totalAmount: number;
  avgFat: number;
  avgSnf: number;
  totalCollections: number;
  activeVendorsCount: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __F2H_VENDOR_COLLECTIONS__: VendorCollectionRecord[] | undefined;
}

if (!global.__F2H_VENDOR_COLLECTIONS__) {
  global.__F2H_VENDOR_COLLECTIONS__ = [];
}

export function getVendorCollections(filters?: {
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  shift?: string | null;
  vendorId?: string | null;
  category?: string | null;
  search?: string | null;
  status?: string | null;
}): VendorCollectionRecord[] {
  let list = global.__F2H_VENDOR_COLLECTIONS__ || [];

  if (filters?.date) {
    list = list.filter((c) => c.collection_date === filters.date);
  } else if (filters?.startDate && filters?.endDate) {
    list = list.filter(
      (c) => c.collection_date >= filters.startDate! && c.collection_date <= filters.endDate!,
    );
  }

  if (filters?.shift && filters.shift !== 'ALL') {
    list = list.filter((c) => c.shift.toUpperCase() === filters.shift!.toUpperCase());
  }

  if (filters?.vendorId && filters.vendorId !== 'ALL') {
    list = list.filter((c) => c.vendor_id === filters.vendorId);
  }

  if (filters?.category && filters.category !== 'All' && filters.category.trim() !== '') {
    const catLower = filters.category.trim().toLowerCase();
    list = list.filter((c) => c.category.toLowerCase().includes(catLower));
  }

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((c) => c.status === filters.status);
  }

  if (filters?.search && filters.search.trim() !== '') {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.vendor_name.toLowerCase().includes(q) ||
        c.collector_name.toLowerCase().includes(q) ||
        c.product_name.toLowerCase().includes(q) ||
        c.collection_id.toLowerCase().includes(q) ||
        (c.container_can_no && c.container_can_no.toLowerCase().includes(q)),
    );
  }

  return list;
}

export function addVendorCollection(
  data: Omit<VendorCollectionRecord, 'id' | 'collection_id' | 'total_amount' | 'created_at'> & {
    collection_id?: string;
    total_amount?: number;
  },
): VendorCollectionRecord {
  const store = global.__F2H_VENDOR_COLLECTIONS__ || [];
  const now = new Date();
  const dateStr = data.collection_date || now.toISOString().split('T')[0];
  const compactDate = dateStr.replace(/-/g, '');
  const countToday = store.filter((c) => c.collection_date === dateStr).length + 1;
  const generatedId =
    data.collection_id || `COL-${compactDate}-${String(countToday).padStart(3, '0')}`;

  const quantity = Number(data.quantity) || 0;
  const rate = Number(data.rate_per_unit) || 0;
  const total_amount = data.total_amount !== undefined ? data.total_amount : quantity * rate;

  const newRecord: VendorCollectionRecord = {
    ...data,
    id: Date.now(),
    collection_id: generatedId,
    collection_date: dateStr,
    quantity,
    rate_per_unit: rate,
    total_amount,
    shift: data.shift || 'MORNING',
    unit: data.unit || 'Liters',
    payment_status: data.payment_status || 'PENDING',
    status: data.status || 'RECORDED',
    created_at: now.toISOString(),
  };

  store.unshift(newRecord);
  global.__F2H_VENDOR_COLLECTIONS__ = store;
  return newRecord;
}

export function updateVendorCollection(
  idOrCollectionId: string,
  updates: Partial<VendorCollectionRecord>,
): VendorCollectionRecord | null {
  const store = global.__F2H_VENDOR_COLLECTIONS__ || [];
  const index = store.findIndex(
    (c) =>
      String(c.id) === String(idOrCollectionId) ||
      c.collection_id.toLowerCase() === idOrCollectionId.toLowerCase(),
  );

  if (index === -1) return null;

  const current = store[index];
  const updatedQuantity = updates.quantity !== undefined ? Number(updates.quantity) : current.quantity;
  const updatedRate = updates.rate_per_unit !== undefined ? Number(updates.rate_per_unit) : current.rate_per_unit;
  const updatedTotal = updates.total_amount !== undefined ? Number(updates.total_amount) : updatedQuantity * updatedRate;

  store[index] = {
    ...current,
    ...updates,
    quantity: updatedQuantity,
    rate_per_unit: updatedRate,
    total_amount: updatedTotal,
    updated_at: new Date().toISOString(),
  };

  global.__F2H_VENDOR_COLLECTIONS__ = store;
  return store[index];
}

export function deleteVendorCollection(idOrCollectionId: string): boolean {
  const store = global.__F2H_VENDOR_COLLECTIONS__ || [];
  const initialLength = store.length;
  const filtered = store.filter(
    (c) =>
      String(c.id) !== String(idOrCollectionId) &&
      c.collection_id.toLowerCase() !== idOrCollectionId.toLowerCase(),
  );

  global.__F2H_VENDOR_COLLECTIONS__ = filtered;
  return filtered.length < initialLength;
}

export function getCollectionSummary(date?: string | null): CollectionSummary {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const collections = getVendorCollections({ date: targetDate });

  let totalQuantity = 0;
  let morningQuantity = 0;
  let eveningQuantity = 0;
  let totalAmount = 0;
  let fatSum = 0;
  let fatCount = 0;
  let snfSum = 0;
  let snfCount = 0;
  const vendorsSet = new Set<string>();

  for (const c of collections) {
    const qty = Number(c.quantity) || 0;
    totalQuantity += qty;
    totalAmount += Number(c.total_amount) || 0;
    vendorsSet.add(c.vendor_id);

    if (c.shift === 'MORNING') {
      morningQuantity += qty;
    } else if (c.shift === 'EVENING') {
      eveningQuantity += qty;
    }

    if (c.fat_percentage && c.fat_percentage > 0) {
      fatSum += Number(c.fat_percentage) * qty;
      fatCount += qty;
    }

    if (c.snf_percentage && c.snf_percentage > 0) {
      snfSum += Number(c.snf_percentage) * qty;
      snfCount += qty;
    }
  }

  return {
    totalQuantity: Number(totalQuantity.toFixed(2)),
    morningQuantity: Number(morningQuantity.toFixed(2)),
    eveningQuantity: Number(eveningQuantity.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    avgFat: fatCount > 0 ? Number((fatSum / fatCount).toFixed(2)) : 0,
    avgSnf: snfCount > 0 ? Number((snfSum / snfCount).toFixed(2)) : 0,
    totalCollections: collections.length,
    activeVendorsCount: vendorsSet.size,
  };
}
