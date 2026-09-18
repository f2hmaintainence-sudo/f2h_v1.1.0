import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
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
  products_supplied?: any[];
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

  /**
   * Helper to process image input (base64 data URI or raw base64) and write it
   * into filesystem at `uploads/vendors/vnd_<id>_<timestamp>.<ext>`.
   */
  public async processAndSaveVendorImage(
    imageInput?: string | null,
    vendorIdentifier?: string,
  ): Promise<string | null> {
    if (!imageInput || typeof imageInput !== 'string') {
      return null;
    }

    const trimmed = imageInput.trim();
    if (!trimmed) return null;

    // If it's already a relative /uploads/ path or uploads/ path
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }

    // Check if it's base64 data URI (e.g. data:image/png;base64,... or data:image/jpeg;base64,...)
    const matches = trimmed.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      try {
        const mimeType = matches[1].toLowerCase();
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        let ext = '.jpg';
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('gif')) ext = '.gif';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';

        const uploadDir = path.join(process.cwd(), 'uploads', 'vendors');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const safeId = (vendorIdentifier || 'vnd').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, buffer);
        this.logger.log(`Saved vendor profile image to uploads/vendors/${filename}`);
        return `/uploads/vendors/${filename}`;
      } catch (err) {
        this.logger.error('Failed to decode and save base64 vendor image', err);
      }
    }

    // If it's a raw base64 string without data: URI prefix
    if (trimmed.length > 500 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      try {
        const buffer = Buffer.from(trimmed, 'base64');
        const uploadDir = path.join(process.cwd(), 'uploads', 'vendors');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const safeId = (vendorIdentifier || 'vnd').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        this.logger.log(`Saved raw base64 vendor image to uploads/vendors/${filename}`);
        return `/uploads/vendors/${filename}`;
      } catch (err) {
        this.logger.error('Failed to save raw base64 vendor image', err);
      }
    }

    // If it's an external URL (http/https), return as is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    return trimmed;
  }

  /**
   * Dedicated file/photo upload helper for vendor profile photos.
   */
  async uploadVendorFile(
    file?: any,
    base64Image?: string,
    vendorId?: string,
  ): Promise<{ success: boolean; message: string; url?: string }> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'vendors');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let fileUrl: string | null = null;

    if (file && file.buffer) {
      const ext = path.extname(file.originalname || 'profile.jpg') || '.jpg';
      const safeId = (vendorId || 'vnd').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      fileUrl = `/uploads/vendors/${filename}`;
    } else if (base64Image) {
      fileUrl = await this.processAndSaveVendorImage(base64Image, vendorId);
    }

    if (!fileUrl) {
      throw new BadRequestException('No valid image file or base64 data provided');
    }

    // If vendorId was provided, update the vendor's image_url directly in DB
    if (vendorId) {
      const isNumeric = /^\d+$/.test(vendorId);
      await this.db.query(
        `UPDATE public.vendors 
         SET image_url = $1, updated_at = NOW() 
         WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $2::bigint OR ' : ''}vendor_id = $2)`,
        [fileUrl, String(vendorId)],
      );
    }

    return {
      success: true,
      message: 'Vendor profile photo uploaded successfully',
      url: fileUrl,
    };
  }

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

  async getProductsList(): Promise<{ success: boolean; data: any[] }> {
    try {
      const rows = await this.db.query<any>(
        `SELECT DISTINCT ON (p.product_id)
          p.product_id,
          p.name,
          COALESCE(c.name, p.category_id, 'General') AS category,
          p.unit_type
        FROM public.products p
        LEFT JOIN public.categories c ON c.category_id = p.category_id
        WHERE p.is_active = true AND p.deleted_at IS NULL
        ORDER BY p.product_id, p.name ASC`,
      );
      return {
        success: true,
        data: rows || [],
      };
    } catch (err) {
      this.logger.error('Failed to fetch products for vendor registry', err);
      return { success: false, data: [] };
    }
  }

  async getPublicVendors(category?: string, search?: string): Promise<{ success: boolean; data: VendorProfile[]; total: number }> {
    try {
      let query = `
        SELECT 
          v.id, v.vendor_id, v.business_name,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), v.contact_person, u.user_name) AS contact_person,
          COALESCE(u.phone, v.phone) AS phone,
          COALESCE(u.email, v.email) AS email,
          v.category, v.description, v.address, v.city, v.state, v.pincode,
          v.gstin, v.fssai_license, v.supply_capacity, v.experience_years,
          v.rating, v.products_supplied, v.total_products_supplied, v.is_verified, v.is_active,
          v.status, v.image_url, v.logo_url, v.website_url, v.source, v.created_at
        FROM public.vendors v
        LEFT JOIN public.users u ON (u.phone = v.phone OR (u.email IS NOT NULL AND u.email = v.email))
        WHERE v.is_active = true 
          AND v.deleted_at IS NULL
          AND v.status = 'approved'
      `;
      const params: any[] = [];
      let paramIdx = 1;

      if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
        query += ` AND v.category ILIKE $${paramIdx}`;
        params.push(`%${category.trim()}%`);
        paramIdx++;
      }

      if (search && search.trim() !== '') {
        query += ` AND (
          v.business_name ILIKE $${paramIdx} 
          OR u.first_name ILIKE $${paramIdx}
          OR u.last_name ILIKE $${paramIdx}
          OR v.contact_person ILIKE $${paramIdx} 
          OR u.phone ILIKE $${paramIdx}
          OR v.phone ILIKE $${paramIdx}
          OR v.city ILIKE $${paramIdx} 
          OR v.description ILIKE $${paramIdx}
          OR v.category ILIKE $${paramIdx}
        )`;
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      query += ` ORDER BY v.rating DESC, v.created_at DESC LIMIT 50`;

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
    let imageUrl = await this.processAndSaveVendorImage(dto.imageUrl, vendorId);
    if (!imageUrl) {
      imageUrl = this.getDefaultImage(dto.category);
    }
    const city = dto.city?.trim() || 'Bengaluru';
    const state = dto.state?.trim() || 'Karnataka';

    // 1. Sync / Resolve user identity from users table (Single Source of Truth)
    let contactPerson = dto.contactPerson?.trim() || '';
    const userRows = await this.db.query<any>(
      `SELECT user_id, first_name, last_name, phone, email FROM public.users WHERE phone = $1 LIMIT 1`,
      [cleanPhone],
    );

    if (userRows && userRows.length > 0) {
      const u = userRows[0];
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      if (fullName) {
        contactPerson = fullName;
      }
    } else {
      // Create user record in users table
      const nameParts = contactPerson.split(/\s+/);
      const firstName = nameParts[0] || 'Vendor';
      const lastName = nameParts.slice(1).join(' ') || '';
      const userId = `F2H_${Date.now().toString().slice(-6)}_${randomSuffix}`;

      await this.db.query(
        `INSERT INTO public.users (
          user_id, first_name, last_name, phone, email, role_id, account_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'VENDOR', 'active', NOW(), NOW())
        ON CONFLICT (phone) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
          last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
          updated_at = NOW()`,
        [
          userId,
          firstName,
          lastName,
          cleanPhone,
          dto.email?.trim() || null,
        ],
      );
    }

    // Normalize products supplied array
    const productsSupplied = Array.isArray(dto.products)
      ? dto.products.map((p) => (typeof p === 'string' ? { name: p } : p))
      : [];

    const insertQuery = `
      INSERT INTO public.vendors (
        vendor_id, business_name, contact_person, phone, email, category,
        description, address, city, state, pincode, gstin, fssai_license,
        supply_capacity, experience_years, rating, products_supplied, total_products_supplied,
        is_verified, is_active, status, image_url, source, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        4.85, $16, $17, true, true, 'approved', $18, 'website', NOW(), NOW()
      )
      RETURNING *;
    `;

    const inserted = await this.db.query<VendorProfile>(insertQuery, [
      vendorId,
      dto.businessName.trim(),
      contactPerson,
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
      JSON.stringify(productsSupplied),
      productsSupplied.length,
      imageUrl,
    ]);

    if (!inserted || inserted.length === 0) {
      throw new BadRequestException('Failed to register vendor profile. Please try again.');
    }

    this.logger.log(`New vendor registered: ${dto.businessName} (${vendorId}) supplying ${productsSupplied.length} products`);

    return {
      success: true,
      message: 'Vendor profile registered and listed successfully!',
      data: inserted[0],
    };
  }

  // =========================================================================
  // SINGLE VENDOR PROFILE CRUD (BY ID OR VENDOR_ID)
  // =========================================================================

  async getVendorById(id: string): Promise<{ success: boolean; data: VendorProfile | null; message?: string }> {
    try {
      const isNumeric = /^\d+$/.test(id);
      const query = `
        SELECT 
          v.id, v.vendor_id, v.business_name,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), v.contact_person, u.user_name) AS contact_person,
          COALESCE(u.phone, v.phone) AS phone,
          COALESCE(u.email, v.email) AS email,
          v.category, v.description, v.address, v.city, v.state, v.pincode,
          v.gstin, v.fssai_license, v.supply_capacity, v.experience_years,
          v.rating, v.products_supplied, v.total_products_supplied, v.is_verified, v.is_active,
          v.status, v.image_url, v.logo_url, v.website_url, v.source, v.created_at
        FROM public.vendors v
        LEFT JOIN public.users u ON (u.phone = v.phone OR (u.email IS NOT NULL AND u.email = v.email))
        WHERE v.deleted_at IS NULL
          AND (${isNumeric ? 'v.id = $1::bigint OR ' : ''}v.vendor_id = $1)
        LIMIT 1
      `;
      const rows = await this.db.query<VendorProfile>(query, [String(id)]);
      if (!rows || rows.length === 0) {
        return { success: false, data: null, message: `Vendor '${id}' not found` };
      }
      return { success: true, data: rows[0] };
    } catch (err: any) {
      this.logger.error(`Failed to get vendor ${id}`, err);
      return { success: false, data: null, message: err?.message || 'Failed to retrieve vendor profile' };
    }
  }

  async updateVendor(id: string, body: any): Promise<{ success: boolean; message: string; data?: VendorProfile }> {
    try {
      const isNumeric = /^\d+$/.test(id);
      const existing = await this.getVendorById(id);
      if (!existing.success || !existing.data) {
        return { success: false, message: `Vendor '${id}' not found` };
      }
      const cur = existing.data;

      const isVerified = body.is_verified !== undefined ? Boolean(body.is_verified) : cur.is_verified;
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : cur.is_active;
      const status = body.status || (isVerified ? 'approved' : cur.status || 'pending');
      const businessName = body.business_name !== undefined ? body.business_name : cur.business_name;
      const contactPerson = body.contact_person !== undefined ? body.contact_person : cur.contact_person;
      const phone = body.phone !== undefined ? body.phone : cur.phone;
      const email = body.email !== undefined ? body.email : cur.email;
      const category = body.category !== undefined ? body.category : cur.category;
      const description = body.description !== undefined ? body.description : cur.description;
      const address = body.address !== undefined ? body.address : cur.address;
      const city = body.city !== undefined ? body.city : cur.city;
      const state = body.state !== undefined ? body.state : cur.state;
      const pincode = body.pincode !== undefined ? body.pincode : cur.pincode;

      let imageUrl = cur.image_url;
      if (body.image_url !== undefined || body.imageUrl !== undefined || body.image !== undefined) {
        const rawImg = body.image_url ?? body.imageUrl ?? body.image;
        if (rawImg) {
          imageUrl = await this.processAndSaveVendorImage(rawImg, String(id));
        } else {
          imageUrl = null;
        }
      }

      const gstin = body.gstin !== undefined ? body.gstin : cur.gstin;
      const fssaiLicense = body.fssai_license !== undefined ? body.fssai_license : (body.fssaiLicense !== undefined ? body.fssaiLicense : cur.fssai_license);
      const supplyCapacity = body.supply_capacity !== undefined ? body.supply_capacity : (body.supplyCapacity !== undefined ? body.supplyCapacity : cur.supply_capacity);
      const experienceYears = body.experience_years !== undefined ? body.experience_years : (body.experienceYears !== undefined ? body.experienceYears : cur.experience_years);

      let productsSupplied = cur.products_supplied;
      let totalProductsSupplied = cur.total_products_supplied;
      if (body.products_supplied !== undefined || body.products !== undefined) {
        const rawProds = body.products_supplied ?? body.products;
        if (Array.isArray(rawProds)) {
          productsSupplied = rawProds.map((p) => (typeof p === 'string' ? { name: p } : p));
          totalProductsSupplied = productsSupplied.length;
        }
      }

      const updateQuery = `
        UPDATE public.vendors
        SET 
          is_verified = $1,
          is_active = $2,
          status = $3,
          business_name = $4,
          contact_person = $5,
          phone = $6,
          email = $7,
          category = $8,
          description = $9,
          address = $10,
          city = $11,
          state = $12,
          pincode = $13,
          image_url = $14,
          gstin = $15,
          fssai_license = $16,
          supply_capacity = $17,
          experience_years = $18,
          products_supplied = $19,
          total_products_supplied = $20,
          updated_at = NOW()
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $21::bigint OR ' : ''}vendor_id = $21)
        RETURNING *;
      `;

      const rows = await this.db.query<VendorProfile>(updateQuery, [
        isVerified,
        isActive,
        status,
        businessName,
        contactPerson,
        phone,
        email,
        category,
        description,
        address,
        city,
        state,
        pincode,
        imageUrl,
        gstin,
        fssaiLicense,
        supplyCapacity,
        experienceYears,
        JSON.stringify(productsSupplied || []),
        totalProductsSupplied || 0,
        String(id),
      ]);

      // Sync identity attributes to users table
      if (cur.phone) {
        const nameParts = String(contactPerson || '').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Vendor';
        const lastName = nameParts.slice(1).join(' ') || '';
        await this.db.query(
          `UPDATE public.users SET 
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            email = COALESCE($3, email),
            updated_at = NOW()
           WHERE phone = $4`,
          [firstName, lastName, email ? String(email).trim() : null, cur.phone],
        );
      }

      return {
        success: true,
        message: 'Vendor profile updated successfully',
        data: rows?.[0],
      };
    } catch (err: any) {
      this.logger.error(`Failed to update vendor ${id}`, err);
      return { success: false, message: err?.message || 'Failed to update vendor profile' };
    }
  }

  async deleteVendor(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const isNumeric = /^\d+$/.test(id);
      const query = `
        UPDATE public.vendors
        SET deleted_at = NOW(), is_active = false, updated_at = NOW()
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $1::bigint OR ' : ''}vendor_id = $1)
        RETURNING id;
      `;
      const rows = await this.db.query(query, [String(id)]);
      if (!rows || rows.length === 0) {
        return { success: false, message: `Vendor '${id}' not found or already removed` };
      }
      return { success: true, message: 'Vendor removed successfully' };
    } catch (err: any) {
      this.logger.error(`Failed to delete vendor ${id}`, err);
      return { success: false, message: err?.message || 'Failed to remove vendor' };
    }
  }

  // =========================================================================
  // VENDOR COLLECTIONS & PROCUREMENT ENDPOINTS
  // =========================================================================

  async getCollections(filter: {
    date?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    shift?: string;
    vendorId?: string;
    category?: string;
    search?: string;
    status?: string;
    summary?: boolean;
  }): Promise<{ success: boolean; data: any[]; summary?: any; count: number }> {
    try {
      let query = `
        SELECT 
          c.id, c.collection_id, COALESCE(c.collection_type, 'MILK') as collection_type,
          c.collection_date, c.shift, c.vendor_id,
          COALESCE(v.business_name, c.vendor_name) as vendor_name,
          COALESCE(u.phone, v.phone) as vendor_phone,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), v.contact_person, c.vendor_name) as contact_person,
          c.collector_name, c.collector_phone,
          c.product_id, c.product_name, c.category, c.quantity, c.unit, c.rate_per_unit, c.total_amount,
          c.fat_percentage, c.snf_percentage, c.clr_reading, c.temperature, c.acidity, c.quality_grade,
          c.container_can_no, c.batch_lot_no, c.packaging_type, c.purity_percentage, c.storage_location,
          c.harvest_date, c.expiry_date, c.gross_quantity, c.defect_quantity, c.payment_status,
          c.payment_mode, c.payment_reference, c.notes, c.extra_attributes, c.status, c.created_at
        FROM public.vendor_collections c
        LEFT JOIN public.vendors v ON v.vendor_id = c.vendor_id
        LEFT JOIN public.users u ON (u.phone = v.phone OR (u.email IS NOT NULL AND u.email = v.email))
        WHERE c.deleted_at IS NULL
      `;
      const params: any[] = [];
      let idx = 1;

      if (filter.date && filter.date.trim()) {
        query += ` AND c.collection_date = $${idx}`;
        params.push(filter.date.trim());
        idx++;
      } else {
        if (filter.startDate && filter.startDate.trim() && filter.endDate && filter.endDate.trim()) {
          query += ` AND c.collection_date BETWEEN $${idx} AND $${idx + 1}`;
          params.push(filter.startDate.trim(), filter.endDate.trim());
          idx += 2;
        } else if (filter.startDate && filter.startDate.trim()) {
          query += ` AND c.collection_date >= $${idx}`;
          params.push(filter.startDate.trim());
          idx++;
        } else if (filter.endDate && filter.endDate.trim()) {
          query += ` AND c.collection_date <= $${idx}`;
          params.push(filter.endDate.trim());
          idx++;
        }
      }

      if (filter.type && filter.type !== 'ALL') {
        query += ` AND c.collection_type = $${idx}`;
        params.push(filter.type.trim());
        idx++;
      }

      if (filter.shift && filter.shift !== 'ALL') {
        query += ` AND c.shift = $${idx}`;
        params.push(filter.shift.trim());
        idx++;
      }

      if (filter.vendorId && filter.vendorId.trim()) {
        query += ` AND c.vendor_id = $${idx}`;
        params.push(filter.vendorId.trim());
        idx++;
      }

      if (filter.category && filter.category.trim()) {
        query += ` AND c.category ILIKE $${idx}`;
        params.push(`%${filter.category.trim()}%`);
        idx++;
      }

      if (filter.status && filter.status.trim()) {
        query += ` AND c.status = $${idx}`;
        params.push(filter.status.trim());
        idx++;
      }

      if (filter.search && filter.search.trim()) {
        query += ` AND (
          c.vendor_name ILIKE $${idx}
          OR v.business_name ILIKE $${idx}
          OR u.first_name ILIKE $${idx}
          OR u.last_name ILIKE $${idx}
          OR v.contact_person ILIKE $${idx}
          OR u.phone ILIKE $${idx}
          OR v.phone ILIKE $${idx}
          OR c.product_name ILIKE $${idx}
          OR c.collection_id ILIKE $${idx}
          OR c.collector_name ILIKE $${idx}
        )`;
        params.push(`%${filter.search.trim()}%`);
        idx++;
      }

      query += ` ORDER BY c.collection_date DESC, c.created_at DESC LIMIT 500`;

      const rows = (await this.db.query<any>(query, params)) || [];

      // Compute aggregate stats summary
      let totalMilkQuantity = 0;
      let totalOthersQuantity = 0;
      let morningMilkQuantity = 0;
      let eveningMilkQuantity = 0;
      let afternoonMilkQuantity = 0;
      let generalMilkQuantity = 0;
      let totalAmount = 0;
      let paidAmount = 0;
      let pendingAmount = 0;
      let partialAmount = 0;
      let fatSum = 0;
      let fatCount = 0;
      let snfSum = 0;
      let snfCount = 0;
      let clrSum = 0;
      let clrCount = 0;
      let tempSum = 0;
      let tempCount = 0;
      let milkCollectionsCount = 0;
      let othersCollectionsCount = 0;
      const vendorsSet = new Set<string>();
      const productSummaryMap = new Map<string, { name: string; quantity: number; unit: string; amount: number; count: number }>();
      const vendorSummaryMap = new Map<string, { vendor_id: string; vendor_name: string; vendor_phone?: string; quantity: number; amount: number; count: number; paid_amount: number; pending_amount: number }>();

      for (const item of rows) {
        const isMilk = item.collection_type === 'MILK' || !item.collection_type;
        const qty = Number(item.quantity) || 0;
        const amt = Number(item.total_amount) || 0;
        totalAmount += amt;

        if (item.payment_status === 'PAID') {
          paidAmount += amt;
        } else if (item.payment_status === 'PARTIAL') {
          partialAmount += amt;
        } else {
          pendingAmount += amt;
        }

        if (item.vendor_id) {
          vendorsSet.add(item.vendor_id);
          const vKey = item.vendor_id || item.vendor_name;
          const existingV = vendorSummaryMap.get(vKey) || {
            vendor_id: item.vendor_id,
            vendor_name: item.vendor_name || 'Vendor',
            vendor_phone: item.vendor_phone || undefined,
            quantity: 0,
            amount: 0,
            count: 0,
            paid_amount: 0,
            pending_amount: 0,
          };
          existingV.quantity += qty;
          existingV.amount += amt;
          existingV.count += 1;
          if (item.payment_status === 'PAID') existingV.paid_amount += amt;
          else existingV.pending_amount += amt;
          vendorSummaryMap.set(vKey, existingV);
        }

        // Product Breakdown
        const pKey = item.product_name || (isMilk ? 'Fresh Milk' : 'Produce');
        const existingP = productSummaryMap.get(pKey) || {
          name: pKey,
          quantity: 0,
          unit: item.unit || (isMilk ? 'Liters' : 'Kg'),
          amount: 0,
          count: 0,
        };
        existingP.quantity += qty;
        existingP.amount += amt;
        existingP.count += 1;
        productSummaryMap.set(pKey, existingP);

        if (isMilk) {
          milkCollectionsCount++;
          totalMilkQuantity += qty;
          if (item.shift === 'MORNING') morningMilkQuantity += qty;
          else if (item.shift === 'EVENING') eveningMilkQuantity += qty;
          else if (item.shift === 'AFTERNOON') afternoonMilkQuantity += qty;
          else generalMilkQuantity += qty;

          if (item.fat_percentage != null && !isNaN(Number(item.fat_percentage))) {
            fatSum += Number(item.fat_percentage);
            fatCount++;
          }
          if (item.snf_percentage != null && !isNaN(Number(item.snf_percentage))) {
            snfSum += Number(item.snf_percentage);
            snfCount++;
          }
          if (item.clr_reading != null && !isNaN(Number(item.clr_reading))) {
            clrSum += Number(item.clr_reading);
            clrCount++;
          }
          if (item.temperature != null && !isNaN(Number(item.temperature))) {
            tempSum += Number(item.temperature);
            tempCount++;
          }
        } else {
          othersCollectionsCount++;
          totalOthersQuantity += qty;
        }
      }

      const summaryStats = {
        totalMilkQuantity: Number(totalMilkQuantity.toFixed(2)),
        totalOthersQuantity: Number(totalOthersQuantity.toFixed(2)),
        morningMilkQuantity: Number(morningMilkQuantity.toFixed(2)),
        eveningMilkQuantity: Number(eveningMilkQuantity.toFixed(2)),
        afternoonMilkQuantity: Number(afternoonMilkQuantity.toFixed(2)),
        generalMilkQuantity: Number(generalMilkQuantity.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        pendingAmount: Number(pendingAmount.toFixed(2)),
        partialAmount: Number(partialAmount.toFixed(2)),
        avgFat: fatCount > 0 ? Number((fatSum / fatCount).toFixed(2)) : 0,
        avgSnf: snfCount > 0 ? Number((snfSum / snfCount).toFixed(2)) : 0,
        avgClr: clrCount > 0 ? Number((clrSum / clrCount).toFixed(2)) : 0,
        avgTemperature: tempCount > 0 ? Number((tempSum / tempCount).toFixed(2)) : 0,
        totalCollections: rows.length,
        milkCollectionsCount,
        othersCollectionsCount,
        activeVendorsCount: vendorsSet.size,
        productBreakdown: Array.from(productSummaryMap.values()),
        vendorBreakdown: Array.from(vendorSummaryMap.values()).sort((a, b) => b.amount - a.amount),
      };

      return {
        success: true,
        data: rows,
        summary: summaryStats,
        count: rows.length,
      };
    } catch (err: any) {
      this.logger.error('Failed to fetch vendor collections', err);
      return {
        success: false,
        data: [],
        count: 0,
      };
    }
  }

  async getCollectionById(id: string): Promise<{ success: boolean; data: any | null; message?: string }> {
    try {
      const isNumeric = /^\d+$/.test(id);
      const query = `
        SELECT 
          c.*,
          COALESCE(v.business_name, c.vendor_name) as vendor_name,
          COALESCE(u.phone, v.phone) as vendor_phone,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''), v.contact_person, c.vendor_name) as contact_person
        FROM public.vendor_collections c
        LEFT JOIN public.vendors v ON v.vendor_id = c.vendor_id
        LEFT JOIN public.users u ON (u.phone = v.phone OR (u.email IS NOT NULL AND u.email = v.email))
        WHERE c.deleted_at IS NULL
          AND (${isNumeric ? 'c.id = $1::bigint OR ' : ''}c.collection_id = $1)
        LIMIT 1
      `;
      const rows = await this.db.query<any>(query, [String(id)]);
      if (!rows || rows.length === 0) {
        return { success: false, data: null, message: `Collection slip '${id}' not found` };
      }
      return { success: true, data: rows[0] };
    } catch (err: any) {
      this.logger.error(`Failed to get collection ${id}`, err);
      return { success: false, data: null, message: err?.message || 'Failed to retrieve collection slip' };
    }
  }

  async createCollection(body: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!body.vendor_id || !body.vendor_name) {
        throw new BadRequestException('Vendor selection is required');
      }
      if (!body.collector_name) {
        throw new BadRequestException('Collector person name is required');
      }
      if (!body.product_name) {
        throw new BadRequestException('Product name is required');
      }
      if (!body.quantity || Number(body.quantity) <= 0) {
        throw new BadRequestException('Valid quantity is required');
      }

      const collectionType = body.collection_type === 'OTHERS' ? 'OTHERS' : 'MILK';
      const quantity = Number(body.quantity);
      const ratePerUnit = Number(body.rate_per_unit) || 0;
      const totalAmount = Number((quantity * ratePerUnit).toFixed(2));

      const dateStr = (body.collection_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const collectionId = `COL-${dateStr}-${randomSuffix}`;

      const insertQuery = `
        INSERT INTO public.vendor_collections (
          collection_id, collection_type, collection_date, shift, vendor_id, vendor_name,
          collector_name, collector_phone, product_id, product_name, category, quantity, unit,
          rate_per_unit, total_amount, fat_percentage, snf_percentage, clr_reading, temperature,
          acidity, quality_grade, container_can_no, batch_lot_no, packaging_type,
          purity_percentage, storage_location, harvest_date, expiry_date, gross_quantity,
          defect_quantity, payment_status, payment_mode, payment_reference, notes,
          extra_attributes, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34, $35, $36, NOW(), NOW()
        )
        RETURNING *;
      `;

      const rows = await this.db.query<any>(insertQuery, [
        collectionId,
        collectionType,
        body.collection_date || new Date().toISOString().split('T')[0],
        body.shift || 'MORNING',
        body.vendor_id,
        body.vendor_name,
        body.collector_name,
        body.collector_phone || null,
        body.product_id || null,
        body.product_name,
        body.category || (collectionType === 'MILK' ? 'Dairy & Milk' : 'Fresh Produce'),
        quantity,
        body.unit || (collectionType === 'MILK' ? 'Liters' : 'Kg'),
        ratePerUnit,
        totalAmount,
        body.fat_percentage != null ? Number(body.fat_percentage) : null,
        body.snf_percentage != null ? Number(body.snf_percentage) : null,
        body.clr_reading != null ? Number(body.clr_reading) : null,
        body.temperature != null ? Number(body.temperature) : null,
        body.acidity != null ? Number(body.acidity) : null,
        body.quality_grade || 'Grade A',
        body.container_can_no || null,
        body.batch_lot_no || null,
        body.packaging_type || null,
        body.purity_percentage != null ? Number(body.purity_percentage) : null,
        body.storage_location || null,
        body.harvest_date || null,
        body.expiry_date || null,
        body.gross_quantity != null ? Number(body.gross_quantity) : null,
        body.defect_quantity != null ? Number(body.defect_quantity) : 0,
        body.payment_status || 'PENDING',
        body.payment_mode || 'CASH',
        body.payment_reference || null,
        body.notes || null,
        JSON.stringify(body.extra_attributes || {}),
        body.status || 'RECORDED',
      ]);

      return {
        success: true,
        message: `${collectionType === 'MILK' ? 'Milk' : 'Produce'} collection recorded successfully`,
        data: rows?.[0],
      };
    } catch (err: any) {
      this.logger.error('Failed to create collection', err);
      return { success: false, message: err?.message || 'Failed to record collection' };
    }
  }

  async updateCollection(id: string, body: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const isNumeric = /^\d+$/.test(id);
      const existing = await this.getCollectionById(id);
      if (!existing.success || !existing.data) {
        return { success: false, message: `Collection slip '${id}' not found` };
      }
      const cur = existing.data;

      const paymentStatus = body.payment_status !== undefined ? body.payment_status : cur.payment_status;
      const paymentMode = body.payment_mode !== undefined ? body.payment_mode : cur.payment_mode;
      const paymentReference = body.payment_reference !== undefined ? body.payment_reference : cur.payment_reference;
      const status = body.status !== undefined ? body.status : cur.status;
      const notes = body.notes !== undefined ? body.notes : cur.notes;

      const updateQuery = `
        UPDATE public.vendor_collections
        SET 
          payment_status = $1,
          payment_mode = $2,
          payment_reference = $3,
          status = $4,
          notes = $5,
          updated_at = NOW()
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $6::bigint OR ' : ''}collection_id = $6)
        RETURNING *;
      `;

      const rows = await this.db.query<any>(updateQuery, [
        paymentStatus,
        paymentMode,
        paymentReference,
        status,
        notes,
        String(id),
      ]);

      return {
        success: true,
        message: 'Collection slip updated successfully',
        data: rows?.[0],
      };
    } catch (err: any) {
      this.logger.error(`Failed to update collection ${id}`, err);
      return { success: false, message: err?.message || 'Failed to update collection slip' };
    }
  }

  async deleteCollection(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const isNumeric = /^\d+$/.test(id);
      const query = `
        UPDATE public.vendor_collections
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $1::bigint OR ' : ''}collection_id = $1)
        RETURNING id;
      `;
      const rows = await this.db.query(query, [String(id)]);
      if (!rows || rows.length === 0) {
        return { success: false, message: `Collection slip '${id}' not found or already deleted` };
      }
      return { success: true, message: 'Collection slip removed successfully' };
    } catch (err: any) {
      this.logger.error(`Failed to delete collection ${id}`, err);
      return { success: false, message: err?.message || 'Failed to delete collection slip' };
    }
  }
}


