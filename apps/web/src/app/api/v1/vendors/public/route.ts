// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Public Vendors List)
// Description : Returns list of verified registered vendors (no dummy data)
// ============================================================================

import { NextResponse } from 'next/server';
import { getRegisteredVendors, addRegisteredVendor } from '@/lib/vendors.store';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const localResults = getRegisteredVendors(category, search);

    // Also attempt fetching from backend API and merge
    try {
      const q = new URLSearchParams();
      if (category) q.set('category', category);
      if (search) q.set('search', search);

      const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/public?${q.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        for (const remoteVendor of data.data) {
          const exists = localResults.some((l) => l.vendor_id === remoteVendor.vendor_id);
          if (!exists) {
            addRegisteredVendor(remoteVendor);
            localResults.push(remoteVendor);
          }
        }
      }
    } catch {
      // ignore backend fetch errors
    }

    return NextResponse.json({
      success: true,
      data: localResults,
      total: localResults.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to fetch vendors', data: [], total: 0 },
      { status: 500 },
    );
  }
}

