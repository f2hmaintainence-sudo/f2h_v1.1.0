// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route.ts (Vendor Profile Photo / Media Upload)
// Description : Uploads vendor profile photo and saves into uploads/vendors
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getInternalApiUrl(): string {
  return (process.env.INTERNAL_API_URL || 'https://dev.f2hfresh.com').replace(/\/+$/, '');
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else {
      const body = await request.json();
      const res = await fetch(`${getInternalApiUrl()}/api/v1/vendors/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to upload vendor photo' },
      { status: 500 },
    );
  }
}
