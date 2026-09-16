import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../shared/database/Database.service';
import { RegisterVendorDto } from './dto/register-vendor.dto';

export interface VendorProfile {
  id: number;
  vendor_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  category: string;
  description: string | null;
  address: string | null;
  city: string;
  state: string;
  pincode: string | null;
  gstin: string | null;
  fssai_license: string | null;
  supply_capacity: string | null;
  experience_years: string | null;
  rating: number;
  total_products_supplied: number;
  is_verified: boolean;
  is_active: boolean;
  status: string;
  image_url: string | null;
  logo_url: string | null;
  website_url: string | null;
  source: string;
  created_at: string;
}

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(private readonly db: DatabaseService) {}

  private getDefaultImage(category: string): string {
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
    if (cat.includes('egg') || cat.includes('honey') || cat.includes('poultry')) {
      return 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.includes('pack') || cat.includes('box')) {
      return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80';
    }
    return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80';
  }

  async getPublicVendors(category?: string, search?: string): Promise<{ success: boolean; data: VendorProfile[]; total: number }> {
    try {
      let query = `
        SELECT 
          id, vendor_id, business_name, contact_person, phone, email,
          category, description, address, city, state, pincode,
          gstin, fssai_license, supply_capacity, experience_years,
          rating, total_products_supplied, is_verified, is_active,
          status, image_url, logo_url, website_url, source, created_at
        FROM public.vendors
        WHERE is_active = true 
          AND deleted_at IS NULL
          AND status = 'approved'
      `;
      const params: any[] = [];
      let paramIdx = 1;

      if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
        query += ` AND category ILIKE $${paramIdx}`;
        params.push(`%${category.trim()}%`);
        paramIdx++;
      }

      if (search && search.trim() !== '') {
        query += ` AND (
          business_name ILIKE $${paramIdx} 
          OR contact_person ILIKE $${paramIdx} 
          OR city ILIKE $${paramIdx} 
          OR description ILIKE $${paramIdx}
          OR category ILIKE $${paramIdx}
        )`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      query += ` ORDER BY rating DESC, created_at DESC LIMIT 50`;

      const rows = await this.db.query<VendorProfile>(query, params);
      return {
        success: true,
        data: rows || [],
        total: rows?.length || 0,
      };
    } catch (err) {
      this.logger.error('Failed to fetch public vendors', err);
      return {
        success: false,
        data: [],
        total: 0,
      };
    }
  }

  async registerVendor(dto: RegisterVendorDto): Promise<{ success: boolean; message: string; data: VendorProfile }> {
    const cleanPhone = dto.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new BadRequestException('Please provide a valid 10-digit Indian mobile number.');
    }

    // Check existing vendor by phone
    const existing = await this.db.query<VendorProfile>(
      `SELECT id, vendor_id, business_name FROM public.vendors WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`,
      [cleanPhone],
    );

    if (existing && existing.length > 0) {
      throw new BadRequestException(`A vendor with phone number ${cleanPhone} is already registered (${existing[0].business_name}).`);
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const vendorId = `VND_${Date.now().toString().slice(-6)}_${randomSuffix}`;
    const imageUrl = dto.imageUrl || this.getDefaultImage(dto.category);
    const city = dto.city?.trim() || 'Bengaluru';
    const state = dto.state?.trim() || 'Karnataka';

    const insertQuery = `
      INSERT INTO public.vendors (
        vendor_id, business_name, contact_person, phone, email, category,
        description, address, city, state, pincode, gstin, fssai_license,
        supply_capacity, experience_years, rating, is_verified, is_active,
        status, image_url, source, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        4.85, true, true, 'approved', $16, 'website', NOW(), NOW()
      )
      RETURNING *;
    `;

    const inserted = await this.db.query<VendorProfile>(insertQuery, [
      vendorId,
      dto.businessName.trim(),
      dto.contactPerson.trim(),
      cleanPhone,
      dto.email?.trim() || null,
      dto.category.trim(),
      dto.description?.trim() || `Verified producer and farm partner supplying fresh ${dto.category.toLowerCase()} to F2H Fresh network.`,
      dto.address?.trim() || null,
      city,
      state,
      dto.pincode?.trim() || null,
      dto.gstin?.trim() || null,
      dto.fssaiLicense?.trim() || null,
      dto.supplyCapacity?.trim() || 'Regular Batch Supply',
      dto.experienceYears?.trim() || '1-2 Years',
      imageUrl,
    ]);

    if (!inserted || inserted.length === 0) {
      throw new BadRequestException('Failed to register vendor profile. Please try again.');
    }

    this.logger.log(`New vendor registered: ${dto.businessName} (${vendorId})`);

    return {
      success: true,
      message: 'Vendor profile registered and listed successfully!',
      data: inserted[0],
    };
  }
}
