// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Single Vendor Profile)
// Description : Retrieve single vendor profile by ID or vendor_id
// ============================================================================

import { NextResponse } from 'next/server';
import { getRegisteredVendors } from '@/lib/vendors.store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const allVendors = getRegisteredVendors();
    
    const vendor = allVendors.find(
      (v) => String(v.id) === String(id) || v.vendor_id.toLowerCase() === id.toLowerCase(),
    );

    if (!vendor) {
      return NextResponse.json(
        { success: false, message: `Vendor profile '${id}' not found` },
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
