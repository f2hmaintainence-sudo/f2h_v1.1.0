// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Public Vendors List)
// Description : Returns list of verified registered vendors (no dummy data)
// ============================================================================

import { NextResponse } from 'next/server';
import { getRegisteredVendors } from '@/lib/vendors.store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const results = getRegisteredVendors(category, search);

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to fetch vendors', data: [], total: 0 },
      { status: 500 },
    );
  }
}
