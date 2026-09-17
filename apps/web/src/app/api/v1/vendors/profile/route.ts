// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendor Profile)
// Description : Get single vendor profile by query id, vendor_id, or phone
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('vendor_id') || searchParams.get('vendorId');
    const phone = searchParams.get('phone');

    if (!id && !phone) {
      return NextResponse.json(
        { success: false, message: 'Vendor ID or phone number is required' },
        { status: 400 },
      );
    }

    if (id) {
      const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${encodeURIComponent(id)}`, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // Lookup by phone via public vendors search
    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/public?search=${encodeURIComponent(phone!)}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    const cleanPhone = phone!.replace(/\D/g, '');
    const found = list.find((v: any) => String(v.phone).replace(/\D/g, '').includes(cleanPhone));

    if (!found) {
      return NextResponse.json(
        { success: false, message: 'Vendor profile not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: found,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to retrieve vendor profile' },
      { status: 500 },
    );
  }
}

