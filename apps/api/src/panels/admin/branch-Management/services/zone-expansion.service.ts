// ============================================================================
// F2H Fresh
// File        : zone-expansion.service.ts
// Description : Zone Expansion Request Service — Customer submit + Admin queries
// ============================================================================

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { IdGeneratorService } from '../../../../shared/services/idGenerator.service';

@Injectable()
export class ZoneExpansionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER: Submit / update zone expansion request
  // ─────────────────────────────────────────────────────────────────────────
  async submitRequest(
    customerId: string,
    body: {
      latitude: number;
      longitude: number;
      address_label?: string;
      description?: string;
      customer_name?: string;
    },
  ) {
    try {
      const { latitude, longitude, address_label, description, customer_name } = body;

      // Find nearest branch and compute distance
      const branchRows = await this.db.query(
        `SELECT branch_id, branch_name, lat, lng, delivery_radius_km
         FROM branches
         WHERE deleted_at IS NULL AND lat IS NOT NULL AND lng IS NOT NULL`,
        [],
      );

      let nearestBranch: any = null;
      let minDist = Infinity;

      for (const b of branchRows) {
        const dist = this.haversineKm(
          Number(b.lat), Number(b.lng),
          latitude, longitude,
        );
        if (dist < minDist) {
          minDist = dist;
          nearestBranch = b;
        }
      }

      const branchId = nearestBranch?.branch_id ?? null;
      const distanceKm = nearestBranch ? parseFloat(minDist.toFixed(3)) : null;

      // Upsert: one active request per customer per branch
      const existing = await this.db.query(
        `SELECT request_id FROM zone_expansion_requests
         WHERE customer_id = $1
           AND (branch_id = $2 OR (branch_id IS NULL AND $2 IS NULL))
           AND deleted_at IS NULL
         LIMIT 1`,
        [customerId, branchId],
      );

      if (existing.length > 0) {
        await this.db.query(
          `UPDATE zone_expansion_requests
           SET latitude = $1, longitude = $2, address_label = $3,
               description = $4, customer_name = $5, distance_km = $6,
               status = 'pending', updated_at = now()
           WHERE request_id = $7`,
          [
            latitude, longitude,
            address_label ?? null,
            description ?? null,
            customer_name ?? null,
            distanceKm,
            existing[0].request_id,
          ],
        );
        return {
          status: true,
          message: 'Zone expansion request updated. We will review your request.',
          request_id: existing[0].request_id,
        };
      }

      // Insert new
      const requestId = this.idGenerator.generateId('ZER', 8);
      await this.db.query(
        `INSERT INTO zone_expansion_requests
           (request_id, customer_id, branch_id, customer_name,
            latitude, longitude, address_label, description,
            status, distance_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)`,
        [
          requestId, customerId, branchId, customer_name ?? null,
          latitude, longitude,
          address_label ?? null,
          description ?? null,
          distanceKm,
        ],
      );

      return {
        status: true,
        message: 'Zone expansion request submitted. We will review your request.',
        request_id: requestId,
      };
    } catch (error) {
      this.developer.error('ZoneExpansionService.submitRequest', { error });
      throw new InternalServerErrorException('Failed to submit zone expansion request');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER: Get own requests
  // ─────────────────────────────────────────────────────────────────────────
  async getCustomerRequests(customerId: string) {
    try {
      const rows = await this.db.query(
        `SELECT
           zer.request_id, zer.latitude, zer.longitude,
           zer.address_label, zer.description, zer.status,
           zer.distance_km, zer.created_at, zer.updated_at,
           b.branch_name
         FROM zone_expansion_requests zer
         LEFT JOIN branches b ON b.branch_id = zer.branch_id
         WHERE zer.customer_id = $1 AND zer.deleted_at IS NULL
         ORDER BY zer.created_at DESC`,
        [customerId],
      );
      return { status: true, data: rows };
    } catch (error) {
      this.developer.error('ZoneExpansionService.getCustomerRequests', { error });
      throw new InternalServerErrorException('Failed to fetch requests');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: List requests with filters (branchId, status, page, limit)
  // ─────────────────────────────────────────────────────────────────────────
  async getAdminRequests(filters: {
    branchId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(100, filters.limit ?? 20);
      const offset = (page - 1) * limit;

      const conditions: string[] = ['zer.deleted_at IS NULL'];
      const params: any[] = [];
      let pi = 1;

      if (filters.branchId) {
        conditions.push(`zer.branch_id = $${pi++}`);
        params.push(filters.branchId);
      }
      if (filters.status) {
        conditions.push(`zer.status = $${pi++}`);
        params.push(filters.status);
      }

      const where = conditions.join(' AND ');

      const countRows = await this.db.query(
        `SELECT COUNT(*)::int AS total
         FROM zone_expansion_requests zer
         WHERE ${where}`,
        params,
      );
      const total = countRows[0]?.total ?? 0;

      const rows = await this.db.query(
        `SELECT
           zer.request_id, zer.customer_id, zer.customer_name,
           zer.latitude, zer.longitude, zer.address_label,
           zer.description, zer.status, zer.distance_km,
           zer.created_at, zer.updated_at,
           zer.branch_id,
           b.branch_name,
           u.first_name, u.last_name, u.phone
         FROM zone_expansion_requests zer
         LEFT JOIN branches b ON b.branch_id = zer.branch_id
         LEFT JOIN users u ON u.user_id = zer.customer_id
         WHERE ${where}
         ORDER BY zer.created_at DESC
         LIMIT $${pi++} OFFSET $${pi++}`,
        [...params, limit, offset],
      );

      return {
        status: true,
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.developer.error('ZoneExpansionService.getAdminRequests', { error });
      throw new InternalServerErrorException('Failed to fetch zone expansion requests');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Insights — counts by status + top branches by request volume
  // ─────────────────────────────────────────────────────────────────────────
  async getAdminInsights() {
    try {
      const summaryRows = await this.db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
           COUNT(*) FILTER (WHERE status = 'noted')::int    AS noted,
           COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
         FROM zone_expansion_requests
         WHERE deleted_at IS NULL`,
        [],
      );

      const topBranches = await this.db.query(
        `SELECT
           zer.branch_id,
           b.branch_name,
           COUNT(*)::int AS request_count,
           COUNT(*) FILTER (WHERE zer.status = 'pending')::int AS pending_count
         FROM zone_expansion_requests zer
         LEFT JOIN branches b ON b.branch_id = zer.branch_id
         WHERE zer.deleted_at IS NULL
         GROUP BY zer.branch_id, b.branch_name
         ORDER BY request_count DESC
         LIMIT 10`,
        [],
      );

      const recentTrend = await this.db.query(
        `SELECT
           DATE_TRUNC('day', created_at)::date AS day,
           COUNT(*)::int AS count
         FROM zone_expansion_requests
         WHERE deleted_at IS NULL
           AND created_at >= now() - INTERVAL '30 days'
         GROUP BY day
         ORDER BY day ASC`,
        [],
      );

      return {
        status: true,
        data: {
          summary: summaryRows[0] ?? { total: 0, pending: 0, noted: 0, rejected: 0 },
          topBranches,
          recentTrend,
        },
      };
    } catch (error) {
      this.developer.error('ZoneExpansionService.getAdminInsights', { error });
      throw new InternalServerErrorException('Failed to fetch insights');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Map pins — lat/lng for all requests (optionally filtered by branch)
  // ─────────────────────────────────────────────────────────────────────────
  async getMapPins(branchId?: string) {
    try {
      const conditions: string[] = ['zer.deleted_at IS NULL'];
      const params: any[] = [];

      if (branchId) {
        conditions.push(`zer.branch_id = $1`);
        params.push(branchId);
      }

      const rows = await this.db.query(
        `SELECT
           zer.request_id, zer.latitude, zer.longitude,
           zer.address_label, zer.status, zer.distance_km,
           zer.customer_name, zer.created_at,
           u.first_name, u.last_name, u.phone,
           b.branch_name
         FROM zone_expansion_requests zer
         LEFT JOIN users u ON u.user_id = zer.customer_id
         LEFT JOIN branches b ON b.branch_id = zer.branch_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY zer.created_at DESC`,
        params,
      );

      return { status: true, data: rows };
    } catch (error) {
      this.developer.error('ZoneExpansionService.getMapPins', { error });
      throw new InternalServerErrorException('Failed to fetch map pins');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Update status of a request
  // ─────────────────────────────────────────────────────────────────────────
  async updateStatus(requestId: string, status: 'pending' | 'noted' | 'rejected') {
    try {
      const allowed = ['pending', 'noted', 'rejected'];
      if (!allowed.includes(status)) {
        return { status: false, message: 'Invalid status value' };
      }

      await this.db.query(
        `UPDATE zone_expansion_requests
         SET status = $1, updated_at = now()
         WHERE request_id = $2 AND deleted_at IS NULL`,
        [status, requestId],
      );

      return { status: true, message: `Request marked as ${status}` };
    } catch (error) {
      this.developer.error('ZoneExpansionService.updateStatus', { error });
      throw new InternalServerErrorException('Failed to update request status');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Haversine distance in km
  // ─────────────────────────────────────────────────────────────────────────
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
