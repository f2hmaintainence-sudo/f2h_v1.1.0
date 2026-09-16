// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendor Profile)
// Description : Get single vendor profile by query id, vendor_id, or phone
// ============================================================================

import { NextResponse } from 'next/server';
import { getRegisteredVendors } from '@/lib/vendors.store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('vendor_id') || searchParams.get('vendorId');
    const phone = searchParams.get('phone');

    const allVendors = getRegisteredVendors();
    
    let vendor = null;
    if (id) {
      const q = id.trim().toLowerCase();
      vendor = allVendors.find(
        (v) => String(v.id) === q || v.vendor_id.toLowerCase() === q,
      );
    } else if (phone) {
      const p = phone.replace(/\D/g, '');
      vendor = allVendors.find((v) => v.phone.replace(/\D/g, '') === p);
    }

    if (!vendor) {
      return NextResponse.json(
        { success: false, message: 'Vendor profile not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: vendor,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to retrieve vendor profile' },
      { status: 500 },
    );
  }
}
