// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Single Vendor Collection API)
// Description : Retrieve, update, or remove specific collection entry
// ============================================================================

import { NextResponse } from 'next/server';
import {
  getVendorCollections,
  updateVendorCollection,
  deleteVendorCollection,
  addVendorCollection,
} from '@/lib/vendor-collections.store';

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
      return NextResponse.json({ success: false, message: 'Collection ID is required' }, { status: 400 });
    }

    const all = getVendorCollections();
    let found = all.find(
      (c) => String(c.id) === String(id) || c.collection_id.toLowerCase() === id.toLowerCase(),
    );

    if (!found) {
      try {
        const backendRes = await fetch(`${getInternalApiUrl()}/api/v1/vendors/collections/${id}`, { cache: 'no-store' });
        const backendData = await backendRes.json();
        if (backendData.success && backendData.data) {
          found = backendData.data;
        }
      } catch {
        // ignore
      }
    }

    if (!found) {
      return NextResponse.json(
        { success: false, message: `Collection record '${id}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: found,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to retrieve collection record' },
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
      return NextResponse.json({ success: false, message: 'Collection ID is required' }, { status: 400 });
    }

    const body = await request.json();
    let updated = updateVendorCollection(id, body);

    // Sync with remote backend API
    try {
      const backendRes = await fetch(`${getInternalApiUrl()}/api/v1/vendors/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const backendData = await backendRes.json();
      if (backendData.success && backendData.data) {
        if (!updated) {
          updated = addVendorCollection(backendData.data);
        } else {
          updated = { ...updated, ...backendData.data };
        }
      }
    } catch {
      // ignore
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, message: `Collection record '${id}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Collection record updated successfully',
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to update collection record' },
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
      return NextResponse.json({ success: false, message: 'Collection ID is required' }, { status: 400 });
    }

    const deletedLocally = deleteVendorCollection(id);
    let deletedRemotely = false;

    try {
      const backendRes = await fetch(`${getInternalApiUrl()}/api/v1/vendors/collections/${id}`, {
        method: 'DELETE',
      });
      const backendData = await backendRes.json();
      deletedRemotely = Boolean(backendData?.success);
    } catch {
      // ignore
    }

    if (!deletedLocally && !deletedRemotely) {
      return NextResponse.json(
        { success: false, message: `Collection record '${id}' not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Collection record deleted successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to delete collection record' },
      { status: 500 },
    );
  }
}

