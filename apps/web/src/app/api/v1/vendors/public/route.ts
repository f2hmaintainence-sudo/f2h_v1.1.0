import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SEED_VENDORS = [
  {
    id: 1,
    vendor_id: "VND_DAIRY_001",
    business_name: "Malnad Pure Organic Dairy",
    contact_person: "Ramesh Hegde",
    phone: "9845012341",
    email: "ramesh@malnaddairy.in",
    category: "Dairy & Milk",
    description: "Direct source of pure A2 Desi Cow Milk, Buffalo Milk, and traditional Bilona Cow Ghee from grass-fed cattle in the Western Ghats.",
    city: "Shimoga",
    state: "Karnataka",
    supply_capacity: "1,200 Liters / Day",
    experience_years: "10+ Years",
    rating: 4.92,
    is_verified: true,
    image_url: "https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    vendor_id: "VND_FARMS_002",
    business_name: "Kaveri River Fresh Farms",
    contact_person: "Siddaraju M.",
    phone: "9886023452",
    email: "orders@kaverifarms.co",
    category: "Fresh Produce & Greens",
    description: "Daily harvested organic greens, hydroponic spinach, coriander, and pesticide-free country vegetables grown along the fertile Kaveri basin.",
    city: "Mandya",
    state: "Karnataka",
    supply_capacity: "3.5 Tons / Week",
    experience_years: "7+ Years",
    rating: 4.88,
    is_verified: true,
    image_url: "https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    vendor_id: "VND_ORCH_003",
    business_name: "Nilgiri Crest Organic Orchards",
    contact_person: "Anand Kurup",
    phone: "9944034563",
    email: "anand@nilgiricrest.org",
    category: "Organic Fruits",
    description: "Freshly plucked high-altitude avocados, sweet papayas, hill bananas, and seasonal pomegranates certified 100% natural and residue-free.",
    city: "Nilgiris",
    state: "Tamil Nadu",
    supply_capacity: "2 Tons / Week",
    experience_years: "5+ Years",
    rating: 4.85,
    is_verified: true,
    image_url: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 4,
    vendor_id: "VND_SPICE_004",
    business_name: "Deccan Heritage Cold Pressed Oils",
    contact_person: "Venkatesh Rao",
    phone: "9731045674",
    email: "venkat@deccanoils.com",
    category: "Oils & Native Spices",
    description: "Traditional wood-pressed (Marachekku) sesame, groundnut, and coconut oils alongside authentic single-origin organic turmeric and pepper.",
    city: "Ramanagara",
    state: "Karnataka",
    supply_capacity: "800 Liters / Week",
    experience_years: "8+ Years",
    rating: 4.90,
    is_verified: true,
    image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 5,
    vendor_id: "VND_POULTRY_005",
    business_name: "Nandi Foothills Free-Range Farm",
    contact_person: "Pradeep Reddy",
    phone: "9620056785",
    email: "pradeep@nandifarms.in",
    category: "Farm Eggs & Honey",
    description: "Pasture-raised country chicken eggs (Nati Koli Motte) and raw unprocessed multifloral forest honey with batch lab testing.",
    city: "Chikkaballapur",
    state: "Karnataka",
    supply_capacity: "5,000 Eggs / Day",
    experience_years: "4+ Years",
    rating: 4.86,
    is_verified: true,
    image_url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 6,
    vendor_id: "VND_PKG_006",
    business_name: "EcoPack Biodegradable Solutions",
    contact_person: "Sujatha Narayanan",
    phone: "9448067896",
    email: "contact@ecopacksolutions.in",
    category: "Eco Packaging",
    description: "100% compostable PLA dairy pouches, paper bottles, biodegradable delivery boxes, and eco-friendly temperature-controlled insulation pouches.",
    city: "Bengaluru",
    state: "Karnataka",
    supply_capacity: "50,000 Units / Month",
    experience_years: "6+ Years",
    rating: 4.80,
    is_verified: true,
    image_url: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let results = [...SEED_VENDORS];

  if (category && category !== 'All' && category.trim() !== '') {
    results = results.filter((v) => v.category.toLowerCase().includes(category.toLowerCase()));
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase();
    results = results.filter(
      (v) =>
        v.business_name.toLowerCase().includes(q) ||
        v.contact_person.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q),
    );
  }

  return NextResponse.json({
    success: true,
    data: results,
    total: results.length,
  });
}
