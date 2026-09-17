// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendor Collections API with Milk & Others support)
// Description : Daily vendor procurement and intake endpoints for Milk, Ghee, Fruits & Produce
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${getInternalApiUrl()}/api/v1/vendors/collections${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to fetch vendor collections', data: [], count: 0 },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to record collection' },
      { status: 500 },
    );
  }
}

