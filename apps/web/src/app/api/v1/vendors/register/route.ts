import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getDefaultImage(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('dairy') || cat.includes('milk')) {
    return 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=600&q=80';
  }
  if (cat.includes('produce') || cat.includes('green') || cat.includes('vegetable')) {
    return 'https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=600&q=80';
  }
  if (cat.includes('fruit')) {
    return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80';
  }
  if (cat.includes('oil') || cat.includes('spice')) {
    return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80';
  }
  if (cat.includes('egg') || cat.includes('honey')) {
    return 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80';
  }
  if (cat.includes('pack') || cat.includes('box')) {
    return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80';
  }
  return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const businessName = (body.businessName || '').trim();
    const contactPerson = (body.contactPerson || '').trim();
    const phone = (body.phone || '').replace(/\D/g, '');

    if (!businessName) {
      return NextResponse.json({ success: false, message: 'Business or Farm Name is required' }, { status: 400 });
    }
    if (!contactPerson) {
      return NextResponse.json({ success: false, message: 'Contact Person Name is required' }, { status: 400 });
    }
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ success: false, message: 'Valid 10-digit Indian phone number is required' }, { status: 400 });
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const vendorId = `VND_${Date.now().toString().slice(-6)}_${randomSuffix}`;
    const category = body.category || 'Dairy & Milk';
    const imageUrl = body.imageUrl || getDefaultImage(category);

    const vendorProfile = {
      id: Date.now(),
      vendor_id: vendorId,
      business_name: businessName,
      contact_person: contactPerson,
      phone: phone,
      email: body.email?.trim() || null,
      category: category,
      description: body.description?.trim() || `Verified local producer farm supplying fresh ${category.toLowerCase()} to F2H Fresh.`,
      address: body.address?.trim() || null,
      city: body.city?.trim() || 'Bengaluru',
      state: body.state?.trim() || 'Karnataka',
      pincode: body.pincode?.trim() || null,
      gstin: body.gstin?.trim() || null,
      fssai_license: body.fssaiLicense?.trim() || null,
      supply_capacity: body.supplyCapacity?.trim() || 'Regular Daily Harvest',
      experience_years: body.experienceYears || '1-2 Years',
      rating: 4.85,
      is_verified: true,
      is_active: true,
      status: 'approved',
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: 'Vendor profile registered and listed successfully!',
      data: vendorProfile,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Registration failed' }, { status: 500 });
  }
}
