import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class SectorService {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // Pure-math bearing → sector index (no H3 needed)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute which sector index a lat/lng falls in relative to branch center.
   * Sectors are equal-angle pie slices starting from North (0°).
   */
  computeSectorIndex(
    centerLat: number,
    centerLng: number,
    pointLat: number,
    pointLng: number,
    sectorCount: number,
  ): number {
    const dLat = pointLat - centerLat;
    const dLng = pointLng - centerLng;
    let angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return Math.min(Math.floor(angle / (360 / sectorCount)), sectorCount - 1);
  }

  // ═══════════════════════════════════════════════════════════════
  // Create sector rows for a branch
  // ═══════════════════════════════════════════════════════════════

  async createSectors(branchId: string, sectorCount: number, tx?: any): Promise<void> {
    for (let i = 0; i < sectorCount; i++) {
      await this.Data.insert('branch_sectors', {
        branch_id: branchId,
        sector_index: i,
        delivery_partner_id: null,
      }, { transaction: tx });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get sectors for a branch (with delivery boy + customer count)
  // ═══════════════════════════════════════════════════════════════

  async getSectorsForBranch(branchId: string) {
    try {
      // Auto-seed missing sector rows from branch.sector_count
      const existingRows = await this.db.query(
        `SELECT COUNT(*) AS cnt FROM branch_sectors WHERE branch_id = $1`,
        [branchId],
      );
      const rowCount = parseInt(existingRows?.[0]?.cnt ?? '0', 10);

      if (rowCount === 0) {
        const branch = await this.db.query(
          `SELECT sector_count FROM branches WHERE branch_id = $1`,
          [branchId],
        );
        const sectorCount = branch?.[0]?.sector_count ?? 3;
        for (let i = 0; i < sectorCount; i++) {
          await this.db.query(
            `INSERT INTO branch_sectors (branch_id, sector_index, delivery_partner_id)
             VALUES ($1, $2, NULL)
             ON CONFLICT (branch_id, sector_index) DO NOTHING`,
            [branchId, i],
          );
        }
      }

      // Fetch sectors with safe customer count
      let result: any[] = [];
      try {
        result = await this.db.query(
          `SELECT
            bs.sector_index,
            bs.delivery_partner_id,
            dp.full_name AS delivery_partner_name,
            dp.phone AS delivery_partner_phone,
            COALESCE(c.customer_count, 0)::int AS customer_count
          FROM branch_sectors bs
          LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = bs.delivery_partner_id
          LEFT JOIN (
            SELECT branch_id, sector_index, COUNT(*)::int AS customer_count
            FROM customers
            WHERE branch_id = $1
            GROUP BY branch_id, sector_index
          ) c ON c.branch_id = bs.branch_id AND c.sector_index = bs.sector_index
          WHERE bs.branch_id = $1
          ORDER BY bs.sector_index`,
          [branchId],
        );
      } catch {
        result = await this.db.query(
          `SELECT
            bs.sector_index,
            bs.delivery_partner_id,
            dp.full_name AS delivery_partner_name,
            dp.phone AS delivery_partner_phone,
            0 AS customer_count
          FROM branch_sectors bs
          LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = bs.delivery_partner_id
          WHERE bs.branch_id = $1
          ORDER BY bs.sector_index`,
          [branchId],
        );
      }

      return {
        status: true,
        data: (result || []).map((r: any) => ({
          ...r,
          is_unassigned: !r.delivery_partner_id,
        })),
      };
    } catch (error) {
      this.developer.error('getSectorsForBranch error', { error });
      throw new InternalServerErrorException('Failed to fetch sectors');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Assign delivery boy to a sector
  // ═══════════════════════════════════════════════════════════════

  async assignDeliveryPartnerToSector(
    branchId: string,
    sectorIndex: number,
    deliveryPartnerId: string,
  ) {
    try {
      const boy = await this.db.query(
        `SELECT id, full_name FROM delivery_partners WHERE id = $1 AND branch_id = $2 AND is_active = true`,
        [deliveryPartnerId, branchId],
      );
      if (!boy?.length) {
        throw new BadRequestException('Delivery boy not found or not in this branch');
      }

      await this.db.query(
        `UPDATE branch_sectors SET delivery_partner_id = $1 WHERE branch_id = $2 AND sector_index = $3`,
        [deliveryPartnerId, branchId, sectorIndex],
      );

      const customerResult = await this.db.query(
        `UPDATE customers SET delivery_partner_id = $1
         WHERE branch_id = $2 AND sector_index = $3
         AND (override_delivery_partner_id IS NULL)`,
        [deliveryPartnerId, branchId, sectorIndex],
      );

      const customersUpdated = customerResult?.length || 0;

      return {
        status: true,
        message: `Sector ${sectorIndex} assigned to ${boy[0].full_name}. ${customersUpdated} customer(s) updated.`,
        data: { delivery_partner_name: boy[0].full_name, customers_updated: customersUpdated },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('assignDeliveryPartnerToSector error', { error });
      throw new InternalServerErrorException('Failed to assign delivery boy');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get customers in a sector (paginated)
  // ═══════════════════════════════════════════════════════════════

  async getCustomersInSector(branchId: string, sectorIndex: number, query: any) {
    try {
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = query.search || '';

      let sql = `
        SELECT
          c.id, c.full_name, c.phone, c.email,
          c.delivery_partner_id,
          c.override_delivery_partner_id,
          dp.full_name AS delivery_partner_name,
          odp.full_name AS override_boy_name
        FROM customers c
        LEFT JOIN delivery_partners dp ON dp.id = c.delivery_partner_id
        LEFT JOIN delivery_partners odp ON odp.id = c.override_delivery_partner_id
        WHERE c.branch_id = $1 AND c.sector_index = $2
      `;
      const params: any[] = [branchId, sectorIndex];

      if (search) {
        sql += ` AND (c.full_name ILIKE $3 OR c.phone ILIKE $3)`;
        params.push(`%${search}%`);
      }

      sql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const data = await this.db.query(sql, params);

      let countSql = `SELECT COUNT(*)::int AS total FROM customers WHERE branch_id = $1 AND sector_index = $2`;
      const countParams: any[] = [branchId, sectorIndex];
      if (search) {
        countSql += ` AND (full_name ILIKE $3 OR phone ILIKE $3)`;
        countParams.push(`%${search}%`);
      }
      const countResult = await this.db.query(countSql, countParams);

      return {
        status: true,
        data: data || [],
        total: countResult?.[0]?.total || 0,
        page,
        limit,
      };
    } catch (error) {
      this.developer.error('getCustomersInSector error', { error });
      throw new InternalServerErrorException('Failed to fetch customers');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Override customer delivery boy
  // ═══════════════════════════════════════════════════════════════

  async overrideCustomerDeliveryPartner(customerId: string, deliveryPartnerId: string) {
    try {
      const customer = await this.db.query(
        `SELECT id, branch_id FROM customers WHERE id = $1`,
        [customerId],
      );
      if (!customer?.length) throw new BadRequestException('Customer not found');

      const boy = await this.db.query(
        `SELECT id, full_name FROM delivery_partners WHERE id = $1 AND branch_id = $2 AND is_active = true`,
        [deliveryPartnerId, customer[0].branch_id],
      );
      if (!boy?.length) throw new BadRequestException('Delivery boy not found in same branch');

      await this.db.query(
        `UPDATE customers SET override_delivery_partner_id = $1, delivery_partner_id = $1 WHERE id = $2`,
        [deliveryPartnerId, customerId],
      );

      return {
        status: true,
        message: `Customer manually assigned to ${boy[0].full_name}. Override active.`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('overrideCustomerDeliveryPartner error', { error });
      throw new InternalServerErrorException('Failed to override');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Clear customer override
  // ═══════════════════════════════════════════════════════════════

  async clearCustomerOverride(customerId: string) {
    try {
      const customer = await this.db.query(
        `SELECT c.id, c.branch_id, c.sector_index, bs.delivery_partner_id
         FROM customers c
         LEFT JOIN branch_sectors bs ON bs.branch_id = c.branch_id AND bs.sector_index = c.sector_index
         WHERE c.id = $1`,
        [customerId],
      );
      if (!customer?.length) throw new BadRequestException('Customer not found');

      const sectorBoyId = customer[0].delivery_partner_id || null;

      await this.db.query(
        `UPDATE customers SET override_delivery_partner_id = NULL, delivery_partner_id = $1 WHERE id = $2`,
        [sectorBoyId, customerId],
      );

      return {
        status: true,
        message: 'Override cleared. Customer reverted to sector assignment.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('clearCustomerOverride error', { error });
      throw new InternalServerErrorException('Failed to clear override');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Change sector count (destructive remap using bearing math)
  // ═══════════════════════════════════════════════════════════════

  async changeSectorCount(branchId: string, newSectorCount: number) {
    try {
      const branch = await this.db.query(
        `SELECT branch_id, branch_name, lat, lng, delivery_radius_km FROM branches WHERE branch_id = $1`,
        [branchId],
      );
      if (!branch?.length) throw new BadRequestException('Branch not found');
      const b = branch[0];

      if (!b.lat || !b.lng) {
        throw new BadRequestException('Branch has no coordinates set');
      }

      const centerLat = parseFloat(b.lat);
      const centerLng = parseFloat(b.lng);

      return await this.Data.executeTransaction(async () => {
        // Delete old sectors
        await this.db.query(`DELETE FROM branch_sectors WHERE branch_id = $1`, [branchId]);

        // Clean up routes
        await this.db.query(`UPDATE customers SET route_id = NULL WHERE branch_id = $1`, [branchId]);
        await this.db.query(
          `DELETE FROM delivery_route_customers WHERE route_id IN (SELECT id FROM delivery_routes WHERE branch_id = $1)`,
          [branchId],
        );
        await this.db.query(`DELETE FROM delivery_routes WHERE branch_id = $1`, [branchId]);

        // Create new sectors
        await this.createSectors(branchId, newSectorCount);

        // Update branch sector_count
        await this.db.query(
          `UPDATE branches SET sector_count = $1, updated_at = NOW() WHERE branch_id = $2`,
          [newSectorCount, branchId],
        );

        // Remap customers using bearing math
        let customersRemapped = 0;
        const customers = await this.db.query(
          `SELECT id, address_lat, address_lng FROM customers WHERE branch_id = $1 AND address_lat IS NOT NULL AND address_lng IS NOT NULL`,
          [branchId],
        );

        if (customers?.length) {
          for (const cust of customers) {
            const newSectorIndex = this.computeSectorIndex(
              centerLat, centerLng,
              parseFloat(cust.address_lat), parseFloat(cust.address_lng),
              newSectorCount,
            );
            await this.db.query(
              `UPDATE customers SET sector_index = $1, delivery_partner_id = NULL WHERE id = $2 AND override_delivery_partner_id IS NULL`,
              [newSectorIndex, cust.id],
            );
            customersRemapped++;
          }
        }

        return {
          status: true,
          message: `Sector count changed to ${newSectorCount}. ${customersRemapped} customers remapped.`,
          data: { sector_count: newSectorCount, customers_remapped: customersRemapped },
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('changeSectorCount error', { error });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get delivery boys for a branch
  // ═══════════════════════════════════════════════════════════════

  async getDeliveryPartnersForBranch(branchId: string) {
    try {
      const result = await this.db.query(
        `SELECT id, full_name, phone FROM delivery_partners WHERE branch_id = $1 AND is_active = true ORDER BY full_name`,
        [branchId],
      );
      return { status: true, data: result || [] };
    } catch (error) {
      this.developer.error('getDeliveryPartnersForBranch error', { error });
      throw new InternalServerErrorException('Failed to fetch delivery boys');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Assign customer to sector on registration (bearing math, no H3)
  // ═══════════════════════════════════════════════════════════════

  async assignCustomerToSectorOnRegistration(
    customerId: number,
    branchId: string,
    lat: number | null,
    lng: number | null,
    apartmentName?: string | null,
  ): Promise<{ sector_index: number | null; delivery_partner_id: string | null }> {
    try {
      let sectorIndex: number | null = null;
      let deliveryPartnerId: string | null = null;

      if (lat && lng && lat !== 0 && lng !== 0) {
        const branch = await this.db.query(
          `SELECT lat, lng, sector_count FROM branches WHERE branch_id = $1`,
          [branchId],
        );
        if (branch?.length && branch[0].lat && branch[0].lng) {
          sectorIndex = this.computeSectorIndex(
            parseFloat(branch[0].lat), parseFloat(branch[0].lng),
            lat, lng,
            branch[0].sector_count || 3,
          );
        }
      }

      // Fallback: apartment name fuzzy match
      if (sectorIndex === null && apartmentName?.trim()) {
        const aptResult = await this.db.query(
          `SELECT c.sector_index
           FROM customers c
           WHERE c.branch_id = $1
             AND c.sector_index IS NOT NULL
             AND c.apartment_name ILIKE $2
           GROUP BY c.sector_index
           ORDER BY COUNT(*) DESC
           LIMIT 1`,
          [branchId, `%${apartmentName.trim()}%`],
        );
        sectorIndex = aptResult?.[0]?.sector_index ?? null;
      }

      // Lookup delivery boy for this sector
      if (sectorIndex !== null) {
        const sectorRow = await this.db.query(
          `SELECT delivery_partner_id FROM branch_sectors WHERE branch_id = $1 AND sector_index = $2`,
          [branchId, sectorIndex],
        );
        deliveryPartnerId = sectorRow?.[0]?.delivery_partner_id ?? null;
      }

      // Persist on customer record
      await this.db.query(
        `UPDATE customers SET sector_index = $1, delivery_partner_id = $2, address_lat = $3, address_lng = $4 WHERE id = $5`,
        [sectorIndex, deliveryPartnerId, lat, lng, customerId],
      );

      return { sector_index: sectorIndex, delivery_partner_id: deliveryPartnerId };
    } catch (error) {
      this.developer.error('assignCustomerToSectorOnRegistration error', { error });
      return { sector_index: null, delivery_partner_id: null };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Real-time delivery boy location ping (upsert)
  // ═══════════════════════════════════════════════════════════════

  async upsertDeliveryPartnerLocation(
    deliveryPartnerId: string,
    lat: number,
    lng: number,
    shiftType: 'morning' | 'evening' = 'morning',
  ) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deliveryPartnerId);
      let resolvedBoyId: string | null = null;

      if (isUuid) {
        const dbBoy = await this.db.query(
          `SELECT id FROM delivery_partners WHERE id = $1::uuid OR user_id = $2 OR delivery_partner_id = $2 LIMIT 1`,
          [deliveryPartnerId, deliveryPartnerId],
        );
        resolvedBoyId = dbBoy?.[0]?.id || null;
      } else {
        const dbBoy = await this.db.query(
          `SELECT id FROM delivery_partners WHERE user_id = $1 OR delivery_partner_id = $1 LIMIT 1`,
          [deliveryPartnerId],
        );
        resolvedBoyId = dbBoy?.[0]?.id || null;
      }

      if (!resolvedBoyId) return { status: false, message: 'Delivery boy profile not found' };

      await this.db.query(
        `INSERT INTO delivery_partner_locations (delivery_partner_id, lat, lng, recorded_at, shift_type)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (delivery_partner_id) DO UPDATE
           SET lat = EXCLUDED.lat,
               lng = EXCLUDED.lng,
               recorded_at = NOW(),
               shift_type = EXCLUDED.shift_type`,
        [resolvedBoyId, lat, lng, shiftType],
      );

      return { status: true };
    } catch (error) {
      this.developer.error('upsertDeliveryPartnerLocation error', { error });
      return { status: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get all active delivery boy locations for a branch
  // ═══════════════════════════════════════════════════════════════

  async getDeliveryPartnerLocations(branchId: string, shiftType?: 'morning' | 'evening') {
    try {
      let sql = `
        SELECT
          dpl.delivery_partner_id,
          dpl.lat,
          dpl.lng,
          dpl.recorded_at,
          dpl.shift_type,
          dp.full_name,
          dp.phone,
          (NOW() - dpl.recorded_at) > INTERVAL '5 minutes' AS is_stale
        FROM delivery_partner_locations dpl
        JOIN delivery_partners dp ON dp.id = dpl.delivery_partner_id
        WHERE dp.branch_id = $1
      `;
      const params: any[] = [branchId];

      if (shiftType) {
        sql += ` AND dpl.shift_type = $2`;
        params.push(shiftType);
      }

      sql += ` ORDER BY dp.full_name`;
      const result = await this.db.query(sql, params);

      return { status: true, data: result || [], total: result?.length || 0 };
    } catch (error) {
      this.developer.error('getDeliveryPartnerLocations error', { error });
      throw new InternalServerErrorException('Failed to fetch locations');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Warehouse summary — customers & routes per sector
  // ═══════════════════════════════════════════════════════════════

  async getWarehouseSummary(branchId: string, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      const result = await this.db.query(
        `SELECT
          bs.sector_index,
          dp.full_name AS delivery_partner_name,
          dp.phone AS delivery_partner_phone,
          COUNT(DISTINCT c.id)::int AS total_customers,
          COUNT(DISTINCT CASE WHEN c.route_id IS NOT NULL THEN c.id END)::int AS routed_customers,
          COUNT(DISTINCT CASE WHEN c.route_id IS NULL THEN c.id END)::int AS unrouted_customers,
          COUNT(DISTINCT r.id)::int AS route_count
        FROM branch_sectors bs
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = bs.delivery_partner_id
        LEFT JOIN customers c ON c.branch_id = bs.branch_id AND c.sector_index = bs.sector_index
        LEFT JOIN delivery_routes r ON r.branch_id = bs.branch_id AND r.sector_index = bs.sector_index AND r.is_active = true
        WHERE bs.branch_id = $1
        GROUP BY bs.sector_index, dp.full_name, dp.phone
        ORDER BY bs.sector_index`,
        [branchId],
      );

      const totals = result?.reduce(
        (acc: any, r: any) => ({
          total_customers: acc.total_customers + (r.total_customers || 0),
          routed_customers: acc.routed_customers + (r.routed_customers || 0),
          unrouted_customers: acc.unrouted_customers + (r.unrouted_customers || 0),
          route_count: acc.route_count + (r.route_count || 0),
        }),
        { total_customers: 0, routed_customers: 0, unrouted_customers: 0, route_count: 0 },
      );

      return {
        status: true,
        data: { date: targetDate, sectors: result || [], totals },
      };
    } catch (error) {
      this.developer.error('getWarehouseSummary error', { error });
      throw new InternalServerErrorException('Failed to fetch warehouse summary');
    }
  }
}
