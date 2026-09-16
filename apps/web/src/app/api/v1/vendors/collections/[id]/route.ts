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
} from '@/lib/vendor-collections.store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const all = getVendorCollections();
    const found = all.find(
      (c) => String(c.id) === String(id) || c.collection_id.toLowerCase() === id.toLowerCase(),
    );

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = updateVendorCollection(id, body);

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = deleteVendorCollection(id);

    if (!deleted) {
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
