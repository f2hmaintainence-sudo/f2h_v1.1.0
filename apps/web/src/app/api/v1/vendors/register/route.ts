// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendor Registration)
// Description : Handles vendor and supplier registration directly into DB
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const payload = {
      businessName: body.business_name || body.businessName,
      contactPerson: body.contact_person || body.contactPerson,
      phone: body.phone,
      email: body.email,
      category: body.category,
      description: body.description,
      address: body.address,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      gstin: body.gstin,
      fssaiLicense: body.fssai_license || body.fssaiLicense,
      supplyCapacity: body.supply_capacity || body.supplyCapacity,
      experienceYears: body.experience_years || body.experienceYears,
      imageUrl: body.image_url || body.imageUrl,
      products: body.products_supplied || body.products || [],
    };

    const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to register vendor' },
      { status: 500 },
    );
  }
}
