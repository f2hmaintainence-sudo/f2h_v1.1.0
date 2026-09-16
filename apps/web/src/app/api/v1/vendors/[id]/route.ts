// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Single Vendor Profile)
// Description : Retrieve, update, or remove single vendor profile by ID or vendor_id
// ============================================================================

import { NextResponse } from 'next/server';
import { getRegisteredVendors, updateRegisteredVendor, deleteRegisteredVendor, addRegisteredVendor } from '@/lib/vendors.store';

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

    const allVendors = getRegisteredVendors();
    let vendor = allVendors.find(
      (v) => String(v.id) === String(id) || v.vendor_id.toLowerCase() === id.toLowerCase(),
    );

    if (!vendor) {
      try {
        const backendRes = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${id}`, { cache: 'no-store' });
        const backendData = await backendRes.json();
        if (backendData.success && backendData.data) {
          vendor = backendData.data;
        }
      } catch {
        // ignore
      }
    }

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
    let updated = updateRegisteredVendor(id, body);

    // Sync with remote backend API if possible
    try {
      const backendRes = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const backendData = await backendRes.json();
      if (backendData.success && backendData.data) {
        if (!updated) {
          updated = addRegisteredVendor(backendData.data);
        } else {
          updated = { ...updated, ...backendData.data };
        }
      }
    } catch {
      // ignore
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, message: `Vendor profile '${id}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor profile updated successfully',
      data: updated,
    });
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

    const deletedLocally = deleteRegisteredVendor(id);
    let deletedRemotely = false;

    try {
      const backendRes = await fetch(`${getInternalApiUrl()}/api/v1/vendors/${id}`, {
        method: 'DELETE',
      });
      const backendData = await backendRes.json();
      deletedRemotely = Boolean(backendData?.success);
    } catch {
      // ignore
    }

    if (!deletedLocally && !deletedRemotely) {
      return NextResponse.json(
        { success: false, message: `Vendor profile '${id}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor removed successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to remove vendor' },
      { status: 500 },
    );
  }
}


