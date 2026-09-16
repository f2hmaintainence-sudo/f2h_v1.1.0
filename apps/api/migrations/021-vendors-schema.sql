-- ============================================================================
-- Migration: 021-vendors-schema.sql
-- Description: Create vendors table for supplier registration and public showcase
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendors (
    id SERIAL PRIMARY KEY,
    vendor_id VARCHAR(50) NOT NULL UNIQUE,
    business_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(120),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    address TEXT,
    city VARCHAR(80) NOT NULL DEFAULT 'Bengaluru',
    state VARCHAR(80) NOT NULL DEFAULT 'Karnataka',
    pincode VARCHAR(10),
    gstin VARCHAR(30),
    fssai_license VARCHAR(30),
    supply_capacity VARCHAR(100),
    experience_years VARCHAR(50) DEFAULT '1-2 Years',
    rating NUMERIC(3,2) DEFAULT 4.85,
    total_products_supplied INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(30) DEFAULT 'approved',
    image_url TEXT,
    logo_url TEXT,
    website_url TEXT,
    source VARCHAR(50) DEFAULT 'website',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_id ON public.vendors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON public.vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON public.vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON public.vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors(is_active);

-- Seed Initial Curated Vendor Partners for immediate rich showcase
INSERT INTO public.vendors (
    vendor_id, business_name, contact_person, phone, email, category,
    description, address, city, state, pincode, supply_capacity, experience_years,
    rating, is_verified, is_active, status, image_url, source
) VALUES
(
    'VND_DAIRY_001',
    'Malnad Pure Organic Dairy',
    'Ramesh Hegde',
    '9845012341',
    'ramesh@malnaddairy.in',
    'Dairy & Milk',
    'Direct source of pure A2 Desi Cow Milk, Buffalo Milk, and traditional Bilona Cow Ghee from grass-fed cattle in the Western Ghats.',
    'Sagar Road, Shimoga District',
    'Shimoga',
    'Karnataka',
    '577201',
    '1,200 Liters / Day',
    '10+ Years',
    4.92,
    true,
    true,
    'approved',
    'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=600&q=80',
    'curated_partner'
),
(
    'VND_FARMS_002',
    'Kaveri River Fresh Farms',
    'Siddaraju M.',
    '9886023452',
    'orders@kaverifarms.co',
    'Fresh Produce & Greens',
    'Daily harvested organic greens, hydroponic spinach, coriander, and pesticide-free country vegetables grown along the fertile Kaveri basin.',
    'Srirangapatna Taluk, Mandya',
    'Mandya',
    'Karnataka',
    '571438',
    '3.5 Tons / Week',
    '7+ Years',
    4.88,
    true,
    true,
    'approved',
    'https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=600&q=80',
    'curated_partner'
),
(
    'VND_ORCH_003',
    'Nilgiri Crest Organic Orchards',
    'Anand Kurup',
    '9944034563',
    'anand@nilgiricrest.org',
    'Organic Fruits',
    'Freshly plucked high-altitude avocados, sweet papayas, hill bananas, and seasonal pomegranates certified 100% natural and residue-free.',
    'Kotagiri Road, Coonoor',
    'Nilgiris',
    'Tamil Nadu',
    '643101',
    '2 Tons / Week',
    '5+ Years',
    4.85,
    true,
    true,
    'approved',
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
    'curated_partner'
),
(
    'VND_SPICE_004',
    'Deccan Heritage Cold Pressed Oils',
    'Venkatesh Rao',
    '9731045674',
    'venkat@deccanoils.com',
    'Oils & Native Spices',
    'Traditional wood-pressed (Marachekku) sesame, groundnut, and coconut oils alongside authentic single-origin organic turmeric and pepper.',
    'APMC Yard, Channapatna',
    'Ramanagara',
    'Karnataka',
    '562160',
    '800 Liters / Week',
    '8+ Years',
    4.90,
    true,
    true,
    'approved',
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    'curated_partner'
),
(
    'VND_POULTRY_005',
    'Nandi Foothills Free-Range Farm',
    'Pradeep Reddy',
    '9620056785',
    'pradeep@nandifarms.in',
    'Farm Eggs & Honey',
    'Pasture-raised country chicken eggs (Nati Koli Motte) and raw unprocessed multifloral forest honey with batch lab testing.',
    'Chikkaballapur Road, Nandi Hills',
    'Chikkaballapur',
    'Karnataka',
    '562101',
    '5,000 Eggs / Day',
    '4+ Years',
    4.86,
    true,
    true,
    'approved',
    'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
    'curated_partner'
),
(
    'VND_PKG_006',
    'EcoPack Biodegradable Solutions',
    'Sujatha Narayanan',
    '9448067896',
    'contact@ecopacksolutions.in',
    'Eco Packaging',
    '100% compostable PLA dairy pouches, paper bottles, biodegradable delivery boxes, and eco-friendly temperature-controlled insulation pouches.',
    'Peenya Industrial Area Phase 2',
    'Bengaluru',
    'Karnataka',
    '560058',
    '50,000 Units / Month',
    '6+ Years',
    4.80,
    true,
    true,
    'approved',
    'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
    'curated_partner'
)
ON CONFLICT (vendor_id) DO NOTHING;

COMMIT;
