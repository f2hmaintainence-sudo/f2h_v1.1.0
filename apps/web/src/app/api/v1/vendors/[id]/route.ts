// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Single Vendor Profile)
// Description : Retrieve, update, or remove single vendor profile by ID or vendor_id
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const rawParams = await props.params;
    const id = rawParams?.id;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Vendor ID is required' }, { status: 400 });
    }

    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to retrieve vendor profile' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const rawParams = await props.params;
    const id = rawParams?.id;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Vendor ID is required' }, { status: 400 });
    }

    const body = await request.json();

    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
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
      { success: false, message: err?.message || 'Failed to update vendor profile' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const rawParams = await props.params;
    const id = rawParams?.id;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Vendor ID is required' }, { status: 400 });
    }

    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to remove vendor' },
      { status: 500 },
    );
  }
}



