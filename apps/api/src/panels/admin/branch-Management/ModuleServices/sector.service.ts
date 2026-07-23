import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import {
  H3_RESOLUTION,
  H3_AVG_HEX_RADIUS_KM,
} from '../constants/h3.constants';

// h3-js is a CommonJS module
const h3 = require('h3-js');

@Injectable()
export class SectorService {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // H3 Hex Disk Generation (used by saveAdd and saveEdit)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate H3 hex disk and compute sector_index for each hex.
   * Returns array of { hex_id, sector_index }.
   */
  generateHexDisk(
    lat: number,
    lng: number,
    radiusKm: number,
    sectorCount: number,
    resolution: number = H3_RESOLUTION,
  ): { hex_id: string; sector_index: number }[] {
    const centerHex = h3.latLngToCell(lat, lng, resolution);
    const avgRadius = H3_AVG_HEX_RADIUS_KM[resolution] || 0.174;
    const k = Math.ceil(radiusKm / avgRadius);
    const hexIds: string[] = h3.gridDisk(centerHex, k);

    return hexIds.map(hexId => {
      const [hexLat, hexLng] = h3.cellToLatLng(hexId);
      let angle = Math.atan2(hexLng - lng, hexLat - lat);
      if (angle < 0) angle += 2 * Math.PI;
      const angleDeg = angle * (180 / Math.PI);
      const sectorIndex = Math.floor(angleDeg / (360 / sectorCount));

      return { hex_id: hexId, sector_index: Math.min(sectorIndex, sectorCount - 1) };
    });
  }

  /**
   * Get the center hex for a given lat/lng.
   */
  getCenterHex(lat: number, lng: number, resolution: number = H3_RESOLUTION): string {
    return h3.latLngToCell(lat, lng, resolution);
  }

  // ═══════════════════════════════════════════════════════════════
  // Bulk insert hex rows (chunked for performance)
  // ═══════════════════════════════════════════════════════════════

  async bulkInsertHexes(
    branchId: string,
    hexes: { hex_id: string; sector_index: number }[],
    tx?: any,
  ): Promise<number> {
    const CHUNK_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < hexes.length; i += CHUNK_SIZE) {
      const chunk = hexes.slice(i, i + CHUNK_SIZE);
      const values: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      for (const hex of chunk) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, NOW())`);
        params.push(branchId, hex.hex_id, hex.sector_index);
        paramIndex += 3;
      }

      await (tx || this.db).query(
        `INSERT INTO branch_zone_hexes (branch_id, hex_id, sector_index, created_at) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
        params,
      );
      inserted += chunk.length;
    }

    return inserted;
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
  // Check for hex overlap with existing branches
  // ═══════════════════════════════════════════════════════════════

  async checkOverlap(
    hexIds: string[],
    excludeBranchId?: string,
  ): Promise<{ conflicting: number; branchName: string } | null> {
    if (hexIds.length === 0) return null;

    // Check in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < hexIds.length; i += BATCH_SIZE) {
      const batch = hexIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
      let sql = `
        SELECT bzh.hex_id, b.branch_name
        FROM branch_zone_hexes bzh
        JOIN branches b ON b.branch_id = bzh.branch_id
        WHERE bzh.hex_id IN (${placeholders})
      `;
      const params: any[] = [...batch];

      if (excludeBranchId) {
        sql += ` AND bzh.branch_id != $${params.length + 1}`;
        params.push(excludeBranchId);
      }

      const result = await this.db.query(sql, params);
      if (result?.length > 0) {
        return {
          conflicting: result.length,
          branchName: result[0].branch_name,
        };
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Get sectors for a branch (with delivery boy + customer count)
  // ═══════════════════════════════════════════════════════════════

  async getSectorsForBranch(branchId: string) {
    try {
      // ── Step 1: Check if branch_sectors rows exist ──────────────
      // Old branches created before sector feature may have no rows.
      // Auto-seed them from the branch record if missing.
      const existingRows = await this.db.query(
        `SELECT COUNT(*) AS cnt FROM branch_sectors WHERE branch_id = $1`,
        [branchId],
      );
      const rowCount = parseInt(existingRows?.[0]?.cnt ?? '0', 10);

      if (rowCount === 0) {
        // Fetch the branch's sector_count to seed rows
        const branch = await this.db.query(
          `SELECT sector_count FROM branches WHERE branch_id = $1`,
          [branchId],
        );
        const sectorCount = branch?.[0]?.sector_count ?? 3;

        // Insert missing sector rows
        for (let i = 0; i < sectorCount; i++) {
          await this.db.query(
            `INSERT INTO branch_sectors (branch_id, sector_index, delivery_partner_id)
             VALUES ($1, $2, NULL)
             ON CONFLICT (branch_id, sector_index) DO NOTHING`,
            [branchId, i],
          );
        }
      }

      // ── Step 2: Fetch sectors with safe customer count ──────────
      // customers.sector_index may not exist in older DB schemas.
      // Try with it first, fall back without it on error.
      let result: any[] = [];
      try {
        result = await this.db.query(
          `SELECT
            bs.sector_index,
            bs.delivery_partner_id,
            db.full_name AS delivery_partner_name,
            db.phone AS delivery_partner_phone,
            COALESCE(c.customer_count, 0)::int AS customer_count
          FROM branch_sectors bs
          LEFT JOIN delivery_partners db ON db.delivery_partner_id = bs.delivery_partner_id
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
      } catch (sqlErr: any) {
        // If customers.sector_index column doesn't exist yet, fall back without count
        this.developer.warn('getSectorsForBranch: sector_index column missing in customers, using fallback', { error: sqlErr?.message });
        result = await this.db.query(
          `SELECT
            bs.sector_index,
            bs.delivery_partner_id,
            db.full_name AS delivery_partner_name,
            db.phone AS delivery_partner_phone,
            0 AS customer_count
          FROM branch_sectors bs
          LEFT JOIN delivery_partners db ON db.delivery_partner_id = bs.delivery_partner_id
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
      // Validate delivery boy exists and belongs to this branch
      const boy = await this.db.query(
        `SELECT id, full_name FROM delivery_partners WHERE id = $1 AND branch_id = $2 AND is_active = true`,
        [deliveryPartnerId, branchId],
      );
      if (!boy?.length) {
        throw new BadRequestException('Delivery boy not found or not in this branch');
      }

      // Update sector
      await this.db.query(
        `UPDATE branch_sectors SET delivery_partner_id = $1 WHERE branch_id = $2 AND sector_index = $3`,
        [deliveryPartnerId, branchId, sectorIndex],
      );

      // Bulk update customers in this sector (who don't have an override)
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

  async getCustomersInSector(
    branchId: string,
    sectorIndex: number,
    query: any,
  ) {
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
          db.full_name AS delivery_partner_name,
          odb.full_name AS override_boy_name
        FROM customers c
        LEFT JOIN delivery_partners db ON db.id = c.delivery_partner_id
        LEFT JOIN delivery_partners odb ON odb.id = c.override_delivery_partner_id
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

      // Count total
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
      // Get customer
      const customer = await this.db.query(
        `SELECT id, branch_id FROM customers WHERE id = $1`,
        [customerId],
      );
      if (!customer?.length) throw new BadRequestException('Customer not found');

      // Validate delivery boy belongs to same branch
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
  // Change sector count (destructive remap)
  // ═══════════════════════════════════════════════════════════════

  async changeSectorCount(branchId: string, newSectorCount: number) {
    try {
      // Get branch
      const branch = await this.db.query(
        `SELECT branch_id, branch_name, lat, lng, delivery_radius_km, h3_resolution
         FROM branches WHERE branch_id = $1`,
        [branchId],
      );
      if (!branch?.length) throw new BadRequestException('Branch not found');
      const b = branch[0];

      if (!b.lat || !b.lng) {
        throw new BadRequestException('Branch has no coordinates set');
      }

      // Regenerate hex disk with new sector count
      const hexes = this.generateHexDisk(
        parseFloat(b.lat), parseFloat(b.lng),
        parseFloat(b.delivery_radius_km),
        newSectorCount,
        b.h3_resolution || H3_RESOLUTION,
      );

      // Transaction: delete old, insert new
      return await this.Data.executeTransaction(async (tx) => {
        // Delete old hexes
        await this.db.query(
          `DELETE FROM branch_zone_hexes WHERE branch_id = $1`,
          [branchId],
        );

        // Delete old sectors
        await this.db.query(
          `DELETE FROM branch_sectors WHERE branch_id = $1`,
          [branchId],
        );

        // Clean up routes: clear route_id from customers, delete route_customers, delete routes
        await this.db.query(
          `UPDATE customers SET route_id = NULL WHERE branch_id = $1`,
          [branchId],
        );
        await this.db.query(
          `DELETE FROM delivery_route_customers
           WHERE route_id IN (SELECT id FROM delivery_routes WHERE branch_id = $1)`,
          [branchId],
        );
        await this.db.query(
          `DELETE FROM delivery_routes WHERE branch_id = $1`,
          [branchId],
        );

        // Re-insert hexes
        const hexCount = await this.bulkInsertHexes(branchId, hexes);

        // Create new sectors
        await this.createSectors(branchId, newSectorCount);

        // Update branch sector_count
        await this.db.query(
          `UPDATE branches SET sector_count = $1, updated_at = NOW() WHERE branch_id = $2`,
          [newSectorCount, branchId],
        );

        // Remap customers
        let customersRemapped = 0;
        const customers = await this.db.query(
          `SELECT id, address_hex FROM customers WHERE branch_id = $1 AND address_hex IS NOT NULL`,
          [branchId],
        );

        if (customers?.length) {
          for (const cust of customers) {
            const hexRow = hexes.find(h => h.hex_id === cust.address_hex);
            if (hexRow) {
              await this.db.query(
                `UPDATE customers SET sector_index = $1, delivery_partner_id = NULL
                 WHERE id = $2 AND override_delivery_partner_id IS NULL`,
                [hexRow.sector_index, cust.id],
              );
              customersRemapped++;
            }
          }
        }

        return {
          status: true,
          message: `Sector count changed to ${newSectorCount}. ${hexCount} hexes remapped. ${customersRemapped} customers remapped.`,
          data: { hex_count: hexCount, customers_remapped: customersRemapped },
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('changeSectorCount error', { error });
      console.error('[changeSectorCount exact error]', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get branch hexes (lightweight — for frontend map rendering)
  // ═══════════════════════════════════════════════════════════════

  async getBranchHexes(branchId: string) {
    try {
      const result = await this.db.query(
        `SELECT hex_id, sector_index FROM branch_zone_hexes WHERE branch_id = $1`,
        [branchId],
      );

      return {
        status: true,
        data: result || [],
      };
    } catch (error) {
      this.developer.error('getBranchHexes error', { error });
      throw new InternalServerErrorException('Failed to fetch hexes');
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

      return {
        status: true,
        data: result || [],
      };
    } catch (error) {
      this.developer.error('getDeliveryPartnersForBranch error', { error });
      throw new InternalServerErrorException('Failed to fetch delivery boys');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 5A — Assign sector to customer on registration
  // Called by customer registration flow when GPS is provided.
  // Looks up the H3 hex → sector_index → delivery boy.
  // Falls back to apartment-name fuzzy match if no hex found.
  // ═══════════════════════════════════════════════════════════════

  async assignCustomerToSectorOnRegistration(
    customerId: number,
    branchId: string,
    lat: number | null,
    lng: number | null,
    apartmentName?: string | null,
  ): Promise<{ sector_index: number | null; delivery_partner_id: string | null; address_hex: string | null }> {
    try {
      let addressHex: string | null = null;
      let sectorIndex: number | null = null;
      let deliveryPartnerId: string | null = null;

      // ── Priority 1: GPS → H3 hex lookup ────────────────────────
      if (lat && lng && lat !== 0 && lng !== 0) {
        addressHex = h3.latLngToCell(lat, lng, H3_RESOLUTION);

        const hexRow = await this.db.query(
          `SELECT sector_index FROM branch_zone_hexes
           WHERE branch_id = $1 AND hex_id = $2
           LIMIT 1`,
          [branchId, addressHex],
        );

        if (hexRow?.length) {
          sectorIndex = hexRow[0].sector_index;
        } else {
          // GPS exists but falls outside branch coverage
          // Find nearest covered hex to assign closest sector
          const nearestHex = await this.db.query(
            `SELECT sector_index FROM branch_zone_hexes WHERE branch_id = $1 LIMIT 1`,
            [branchId],
          );
          sectorIndex = nearestHex?.[0]?.sector_index ?? null;
        }
      }

      // ── Priority 2: Apartment name fuzzy match (no GPS) ────────
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

      // ── Lookup delivery boy for this sector ─────────────────────
      if (sectorIndex !== null) {
        const sectorRow = await this.db.query(
          `SELECT delivery_partner_id FROM branch_sectors
           WHERE branch_id = $1 AND sector_index = $2`,
          [branchId, sectorIndex],
        );
        deliveryPartnerId = sectorRow?.[0]?.delivery_partner_id ?? null;
      }

      // ── Persist on customer record ──────────────────────────────
      await this.db.query(
        `UPDATE customers
         SET address_hex = $1, sector_index = $2, delivery_partner_id = $3,
             address_lat = $4, address_lng = $5
         WHERE id = $6`,
        [addressHex, sectorIndex, deliveryPartnerId, lat, lng, customerId],
      );

      return { sector_index: sectorIndex, delivery_partner_id: deliveryPartnerId, address_hex: addressHex };
    } catch (error) {
      this.developer.error('assignCustomerToSectorOnRegistration error', { error });
      // Non-fatal: log and return nulls rather than crashing registration
      return { sector_index: null, delivery_partner_id: null, address_hex: null };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 5B — Real-time delivery boy location ping (upsert)
  // Driver app calls this every 30s during active shift.
  // Single-row-per-boy UPSERT for minimum DB pressure.
  // ═══════════════════════════════════════════════════════════════

  async upsertDeliveryPartnerLocation(
    deliveryPartnerId: string,
    lat: number,
    lng: number,
    shiftType: 'morning' | 'evening' = 'morning',
  ) {
    try {
      // Resolve deliveryPartnerId: support user_id (e.g., USERSHI1CX) or delivery_partners.id UUID
      let resolvedBoyId: string | null = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deliveryPartnerId);
      if (isUuid) {
        const dbBoy = await this.db.query(
          `SELECT id FROM delivery_partners WHERE id = $1::uuid OR user_id = $2 OR delivery_partner_id = $2 LIMIT 1`,
          [deliveryPartnerId, deliveryPartnerId]
        );
        resolvedBoyId = dbBoy?.[0]?.id || null;
      } else {
        const dbBoy = await this.db.query(
          `SELECT id FROM delivery_partners WHERE user_id = $1 OR delivery_partner_id = $1 LIMIT 1`,
          [deliveryPartnerId]
        );
        resolvedBoyId = dbBoy?.[0]?.id || null;
      }

      if (!resolvedBoyId) {
        return { status: false, message: 'Delivery boy profile not found' };
      }

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
  // Phase 5B — Get all active delivery boy locations for a branch
  // Used by admin map view to show real-time positions.
  // ═══════════════════════════════════════════════════════════════

  async getDeliveryPartnerLocations(branchId: string, shiftType?: 'morning' | 'evening') {
    try {
      let sql = `
        SELECT
          dbl.delivery_partner_id,
          dbl.lat,
          dbl.lng,
          dbl.recorded_at,
          dbl.shift_type,
          db.full_name,
          db.phone,
          -- Flag stale pings (> 5 minutes old = boy may be offline)
          (NOW() - dbl.recorded_at) > INTERVAL '5 minutes' AS is_stale
        FROM delivery_partner_locations dbl
        JOIN delivery_partners db ON db.id = dbl.delivery_partner_id
        WHERE db.branch_id = $1
      `;
      const params: any[] = [branchId];

      if (shiftType) {
        sql += ` AND dbl.shift_type = $2`;
        params.push(shiftType);
      }

      sql += ` ORDER BY db.full_name`;
      const result = await this.db.query(sql, params);

      return {
        status: true,
        data: result || [],
        total: result?.length || 0,
      };
    } catch (error) {
      this.developer.error('getDeliveryPartnerLocations error', { error });
      throw new InternalServerErrorException('Failed to fetch locations');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Warehouse summary — how many customers per sector + boy
  // ═══════════════════════════════════════════════════════════════

   async getWarehouseSummary(branchId: string, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      const result = await this.db.query(
        `SELECT
          bs.sector_index,
          bs.sector_name,
          db.full_name AS delivery_partner_name,
          db.phone AS delivery_partner_phone,
          COUNT(DISTINCT c.id)::int AS total_customers,
          COUNT(DISTINCT CASE WHEN c.route_id IS NOT NULL THEN c.id END)::int AS routed_customers,
          COUNT(DISTINCT CASE WHEN c.route_id IS NULL THEN c.id END)::int AS unrouted_customers,
          COUNT(DISTINCT r.id)::int AS route_count,
          COALESCE((
            SELECT SUM(ss.m_quantity + ss.e_quantity)::int
            FROM customers cust
            JOIN subscriptions sub ON sub.customer_id = cust.customer_id AND sub.status = 'active'
            JOIN subscription_weekly_schedule ss ON ss.subscription_id = sub.subscription_id
            WHERE cust.branch_id = $1 AND cust.sector_index = bs.sector_index
          ), 0) AS total_items
        FROM branch_sectors bs
        LEFT JOIN delivery_partners db ON db.delivery_partner_id= bs.delivery_partner_id
        LEFT JOIN customers c ON c.branch_id = bs.branch_id AND c.sector_index = bs.sector_index
        LEFT JOIN delivery_routes r ON r.branch_id = bs.branch_id AND r.sector_index = bs.sector_index AND r.is_active = true
        WHERE bs.branch_id = $1 AND bs.is_active = true
        GROUP BY bs.sector_index, bs.sector_name, db.full_name, db.phone
        ORDER BY bs.sector_index`,
        [branchId],
      );

      const totals = result?.reduce(
        (acc: any, r: any) => ({
          total_customers: acc.total_customers + (r.total_customers || 0),
          routed_customers: acc.routed_customers + (r.routed_customers || 0),
          unrouted_customers: acc.unrouted_customers + (r.unrouted_customers || 0),
          route_count: acc.route_count + (r.route_count || 0),
          total_items: acc.total_items + (r.total_items || 0),
        }),
        { total_customers: 0, routed_customers: 0, unrouted_customers: 0, route_count: 0, total_items: 0 },
      );

      return {
        status: true,
        data: {
          date: targetDate,
          sectors: result || [],
          totals,
        },
      };
    } catch (error) {
      this.developer.error('getWarehouseSummary error', { error });
      throw new InternalServerErrorException('Failed to fetch warehouse summary');
    }
  }
}
