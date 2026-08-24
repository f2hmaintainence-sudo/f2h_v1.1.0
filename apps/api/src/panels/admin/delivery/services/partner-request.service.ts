import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';

export interface CreatePartnerRequestDto {
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  area: string;
  vehicleType: string;
  vehicleNumber?: string;
  drivingLicenseNumber?: string;
  preferredShift?: string;
  experienceYears?: string;
  source?: string;
}

@Injectable()
export class DeliveryPartnerRequestService {
  constructor(private readonly db: DatabaseService) {}

  async createRequest(dto: CreatePartnerRequestDto) {
    if (!dto.fullName || !dto.fullName.trim()) {
      throw new BadRequestException('Full name is required');
    }
    if (!dto.phone || !dto.phone.trim()) {
      throw new BadRequestException('Phone number is required');
    }
    if (!dto.area || !dto.area.trim()) {
      throw new BadRequestException('Locality/Area is required');
    }
    if (!dto.vehicleType || !dto.vehicleType.trim()) {
      throw new BadRequestException('Vehicle type is required');
    }

    const rows = await this.db.query(
      `INSERT INTO delivery_partner_requests (
        full_name,
        phone,
        email,
        city,
        area,
        vehicle_type,
        vehicle_number,
        driving_license_number,
        preferred_shift,
        experience_years,
        status,
        source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        dto.fullName.trim(),
        dto.phone.trim(),
        dto.email?.trim() || null,
        dto.city?.trim() || 'Bengaluru',
        dto.area.trim(),
        dto.vehicleType.trim(),
        dto.vehicleNumber?.trim() || null,
        dto.drivingLicenseNumber?.trim() || null,
        dto.preferredShift?.trim() || 'Both',
        dto.experienceYears?.trim() || 'Fresher',
        'PENDING',
        dto.source || 'website_landing',
      ],
    );

    return {
      success: true,
      message: 'Your partner application has been received successfully! Our onboarding supervisor will contact you within 24 hours.',
      data: rows[0],
    };
  }

  async getRequests(query: {
    status?: string;
    search?: string;
    shift?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 20), 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let pIdx = 1;

    if (query.status && query.status.toUpperCase() !== 'ALL') {
      conditions.push(`status = $${pIdx++}`);
      params.push(query.status.toUpperCase());
    }

    if (query.shift && query.shift.toUpperCase() !== 'ALL') {
      conditions.push(`preferred_shift ILIKE $${pIdx++}`);
      params.push(`%${query.shift}%`);
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(`(full_name ILIKE $${pIdx} OR phone ILIKE $${pIdx} OR area ILIKE $${pIdx} OR email ILIKE $${pIdx})`);
      params.push(s);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await this.db.query(
      `SELECT COUNT(*)::int as total FROM delivery_partner_requests ${whereClause}`,
      params,
    );
    const total = countRows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const rows = await this.db.query(
      `SELECT 
        id,
        full_name,
        phone,
        email,
        city,
        area,
        vehicle_type,
        vehicle_number,
        driving_license_number,
        preferred_shift,
        experience_years,
        status,
        admin_notes,
        source,
        created_at,
        updated_at
      FROM delivery_partner_requests
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      dataParams,
    );

    // Summary counts by status
    const summaryRows = await this.db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE status = 'CONTACTED') as contacted,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected,
        COUNT(*) as total
      FROM delivery_partner_requests
      WHERE deleted_at IS NULL`,
    );

    return {
      success: true,
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: summaryRows[0] || { pending: 0, contacted: 0, approved: 0, rejected: 0, total: 0 },
    };
  }

  async updateRequestStatus(id: string, status: string, adminNotes?: string) {
    const validStatuses = ['PENDING', 'CONTACTED', 'APPROVED', 'REJECTED'];
    const upperStatus = status?.toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      throw new BadRequestException(`Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}`);
    }

    const existing = await this.db.query(
      `SELECT id FROM delivery_partner_requests WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Partner request not found');
    }

    const rows = await this.db.query(
      `UPDATE delivery_partner_requests
       SET 
         status = $1,
         admin_notes = COALESCE($2, admin_notes),
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [upperStatus, adminNotes ?? null, id],
    );

    return {
      success: true,
      message: `Partner request updated to ${upperStatus}`,
      data: rows[0],
    };
  }

  async deleteRequest(id: string) {
    const rows = await this.db.query(
      `UPDATE delivery_partner_requests SET deleted_at = NOW() WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Partner request not found');
    }
    return { success: true, message: 'Partner request deleted successfully' };
  }
}
