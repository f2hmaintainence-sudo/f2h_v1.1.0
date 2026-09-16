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
          id, vendor_id, business_name, contact_person, phone, email,
          category, description, address, city, state, pincode,
          gstin, fssai_license, supply_capacity, experience_years,
          rating, products_supplied, total_products_supplied, is_verified, is_active,
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
          id, vendor_id, business_name, contact_person, phone, email,
          category, description, address, city, state, pincode,
          gstin, fssai_license, supply_capacity, experience_years,
          rating, products_supplied, total_products_supplied, is_verified, is_active,
          status, image_url, logo_url, website_url, source, created_at
        FROM public.vendors
        WHERE deleted_at IS NULL
          AND (${isNumeric ? 'id = $1 OR ' : ''}vendor_id = $1)
        LIMIT 1
      `;
      const rows = await this.db.query<VendorProfile>(query, [isNumeric ? Number(id) : id]);
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
          updated_at = NOW()
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $14 OR ' : ''}vendor_id = $14)
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
        isNumeric ? Number(id) : id,
      ]);

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
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $1 OR ' : ''}vendor_id = $1)
        RETURNING id;
      `;
      const rows = await this.db.query(query, [isNumeric ? Number(id) : id]);
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
          id, collection_id, COALESCE(collection_type, 'MILK') as collection_type,
          collection_date, shift, vendor_id, vendor_name, collector_name, collector_phone,
          product_id, product_name, category, quantity, unit, rate_per_unit, total_amount,
          fat_percentage, snf_percentage, clr_reading, temperature, acidity, quality_grade,
          container_can_no, batch_lot_no, packaging_type, purity_percentage, storage_location,
          harvest_date, expiry_date, gross_quantity, defect_quantity, payment_status,
          payment_mode, payment_reference, notes, extra_attributes, status, created_at
        FROM public.vendor_collections
        WHERE deleted_at IS NULL
      `;
      const params: any[] = [];
      let idx = 1;

      if (filter.date && filter.date.trim()) {
        query += ` AND collection_date = $${idx}`;
        params.push(filter.date.trim());
        idx++;
      } else if (filter.startDate && filter.endDate) {
        query += ` AND collection_date BETWEEN $${idx} AND $${idx + 1}`;
        params.push(filter.startDate.trim(), filter.endDate.trim());
        idx += 2;
      }

      if (filter.type && filter.type !== 'ALL') {
        query += ` AND collection_type = $${idx}`;
        params.push(filter.type.trim());
        idx++;
      }

      if (filter.shift && filter.shift !== 'ALL') {
        query += ` AND shift = $${idx}`;
        params.push(filter.shift.trim());
        idx++;
      }

      if (filter.vendorId && filter.vendorId.trim()) {
        query += ` AND vendor_id = $${idx}`;
        params.push(filter.vendorId.trim());
        idx++;
      }

      if (filter.category && filter.category.trim()) {
        query += ` AND category ILIKE $${idx}`;
        params.push(`%${filter.category.trim()}%`);
        idx++;
      }

      if (filter.status && filter.status.trim()) {
        query += ` AND status = $${idx}`;
        params.push(filter.status.trim());
        idx++;
      }

      if (filter.search && filter.search.trim()) {
        query += ` AND (
          vendor_name ILIKE $${idx}
          OR product_name ILIKE $${idx}
          OR collection_id ILIKE $${idx}
          OR collector_name ILIKE $${idx}
        )`;
        params.push(`%${filter.search.trim()}%`);
        idx++;
      }

      query += ` ORDER BY created_at DESC LIMIT 200`;

      const rows = (await this.db.query<any>(query, params)) || [];

      // Compute aggregate stats summary
      let totalMilkQuantity = 0;
      let totalOthersQuantity = 0;
      let morningMilkQuantity = 0;
      let eveningMilkQuantity = 0;
      let totalAmount = 0;
      let fatSum = 0;
      let fatCount = 0;
      let snfSum = 0;
      let snfCount = 0;
      let milkCollectionsCount = 0;
      let othersCollectionsCount = 0;
      const vendorsSet = new Set<string>();

      for (const item of rows) {
        const isMilk = item.collection_type === 'MILK' || !item.collection_type;
        const qty = Number(item.quantity) || 0;
        const amt = Number(item.total_amount) || 0;
        totalAmount += amt;
        vendorsSet.add(item.vendor_id);

        if (isMilk) {
          milkCollectionsCount++;
          totalMilkQuantity += qty;
          if (item.shift === 'MORNING') morningMilkQuantity += qty;
          if (item.shift === 'EVENING') eveningMilkQuantity += qty;
          if (item.fat_percentage != null) {
            fatSum += Number(item.fat_percentage);
            fatCount++;
          }
          if (item.snf_percentage != null) {
            snfSum += Number(item.snf_percentage);
            snfCount++;
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
        totalAmount: Number(totalAmount.toFixed(2)),
        avgFat: fatCount > 0 ? Number((fatSum / fatCount).toFixed(2)) : 0,
        avgSnf: snfCount > 0 ? Number((snfSum / snfCount).toFixed(2)) : 0,
        totalCollections: rows.length,
        milkCollectionsCount,
        othersCollectionsCount,
        activeVendorsCount: vendorsSet.size,
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
        SELECT *
        FROM public.vendor_collections
        WHERE deleted_at IS NULL
          AND (${isNumeric ? 'id = $1 OR ' : ''}collection_id = $1)
        LIMIT 1
      `;
      const rows = await this.db.query<any>(query, [isNumeric ? Number(id) : id]);
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
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $6 OR ' : ''}collection_id = $6)
        RETURNING *;
      `;

      const rows = await this.db.query<any>(updateQuery, [
        paymentStatus,
        paymentMode,
        paymentReference,
        status,
        notes,
        isNumeric ? Number(id) : id,
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
        WHERE deleted_at IS NULL AND (${isNumeric ? 'id = $1 OR ' : ''}collection_id = $1)
        RETURNING id;
      `;
      const rows = await this.db.query(query, [isNumeric ? Number(id) : id]);
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

