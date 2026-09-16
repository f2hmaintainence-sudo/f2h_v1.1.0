// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendor Collections & Procurement API)
// Description : Daily vendor procurement and milk collection endpoints
// ============================================================================

import { NextResponse } from 'next/server';
import {
  getVendorCollections,
  addVendorCollection,
  getCollectionSummary,
} from '@/lib/vendor-collections.store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const shift = searchParams.get('shift');
    const vendorId = searchParams.get('vendorId');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const summary = searchParams.get('summary');

    if (summary === 'true') {
      const stats = getCollectionSummary(date);
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    const collections = getVendorCollections({
      date,
      startDate,
      endDate,
      shift,
      vendorId,
      category,
      search,
      status,
    });

    const stats = getCollectionSummary(date);

    return NextResponse.json({
      success: true,
      data: collections,
      summary: stats,
      count: collections.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to fetch vendor collections' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.vendor_id || !body.vendor_name) {
      return NextResponse.json(
        { success: false, message: 'Vendor selection is required' },
        { status: 400 },
      );
    }

    if (!body.collector_name) {
      return NextResponse.json(
        { success: false, message: 'Collector person name is required' },
        { status: 400 },
      );
    }

    if (!body.product_name) {
      return NextResponse.json(
        { success: false, message: 'Product name is required' },
        { status: 400 },
      );
    }

    if (!body.quantity || Number(body.quantity) <= 0) {
      return NextResponse.json(
        { success: false, message: 'Valid quantity is required' },
        { status: 400 },
      );
    }

    const record = addVendorCollection({
      collection_date: body.collection_date || new Date().toISOString().split('T')[0],
      shift: body.shift || 'MORNING',
      vendor_id: body.vendor_id,
      vendor_name: body.vendor_name,
      collector_name: body.collector_name,
      collector_phone: body.collector_phone || null,
      product_id: body.product_id || null,
      product_name: body.product_name,
      category: body.category || 'Dairy & Milk',
      quantity: Number(body.quantity),
      unit: body.unit || 'Liters',
      rate_per_unit: Number(body.rate_per_unit) || 0,
      fat_percentage: body.fat_percentage ? Number(body.fat_percentage) : null,
      snf_percentage: body.snf_percentage ? Number(body.snf_percentage) : null,
      clr_reading: body.clr_reading ? Number(body.clr_reading) : null,
      temperature: body.temperature ? Number(body.temperature) : null,
      acidity: body.acidity ? Number(body.acidity) : null,
      quality_grade: body.quality_grade || 'Grade A',
      container_can_no: body.container_can_no || null,
      payment_status: body.payment_status || 'PENDING',
      payment_mode: body.payment_mode || 'CASH',
      payment_reference: body.payment_reference || null,
      notes: body.notes || null,
      extra_attributes: body.extra_attributes || {},
      status: body.status || 'RECORDED',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Collection recorded successfully',
        data: record,
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to record collection' },
      { status: 500 },
    );
  }
}
