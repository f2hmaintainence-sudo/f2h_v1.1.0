// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendors Products List)
// Description : Fetches distinct available products from the products table
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const internalApiUrl = (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
    
    // Fetch products from database via customer products endpoint
    const res = await fetch(`${internalApiUrl}/api/v1/customer/products`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : [];

      // Deduplicate unique products by product_id
      const productMap = new Map<string, any>();

      for (const item of rawList) {
        const id = item.product_id || item.id || `PROD_${item.name}`;
        const name = (item.product_name || item.name || '').trim();
        const category = item.category_name || item.category || 'Fresh Produce';
        const unit = item.unit_type || item.unit || '';
        const image = item.image_url || item.image || item.thumbnail || null;

        if (name && !productMap.has(id)) {
          productMap.set(id, {
            product_id: id,
            name: name,
            category: category,
            unit_type: unit,
            image_url: image,
          });
        }
      }

      const products = Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json({
        success: true,
        data: products,
        total: products.length,
      });
    }

    // Fallback if remote backend unreachable
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to fetch products', data: [] },
      { status: 500 },
    );
  }
}
