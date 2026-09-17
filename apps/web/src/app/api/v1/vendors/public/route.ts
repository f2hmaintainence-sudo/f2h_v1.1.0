// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Public Vendors List)
// Description : Returns list of verified registered vendors directly from DB
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const q = new URLSearchParams();
    if (category && category !== 'All') q.set('category', category);
    if (search) q.set('search', search);

    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/public?${q.toString()}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      return NextResponse.json({
        success: Boolean(data?.success !== false),
        data: list,
        total: list.length,
      });
    }

    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to fetch vendors', data: [], total: 0 },
      { status: 500 },
    );
  }
}
