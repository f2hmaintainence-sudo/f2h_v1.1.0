import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import {
  geoCluster,
  nearestNeighborTSP,
  distributeRoutesAcrossBoys,
  haversineDistance,
  totalRouteDistance,
  CustomerStop,
} from '../utils/route-optimizer.util';

@Injectable()
export class RouteService {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // Create a new delivery route inside a sector
  // ═══════════════════════════════════════════════════════════════

  async createRoute(body: {
    branch_id: string;
    sector_index: number;
    route_name: string;
    shift_type?: 'morning' | 'evening';
    delivery_partner_id?: string;
    max_stops?: number;
  }) {
    try {
      if (!body.branch_id) throw new BadRequestException('branch_id is required');
      if (body.sector_index === undefined) throw new BadRequestException('sector_index is required');
      if (!body.route_name?.trim()) throw new BadRequestException('route_name is required');

      const branch = await this.db.query(
        `SELECT branch_id, branch_name FROM branches WHERE branch_id = $1`,
        [body.branch_id],
      );
      if (!branch?.length) throw new BadRequestException('Branch not found');

      const sector = await this.db.query(
        `SELECT sector_index FROM branch_sectors WHERE branch_id = $1 AND sector_index = $2`,
        [body.branch_id, body.sector_index],
      );
      if (!sector?.length) throw new BadRequestException(`Sector ${body.sector_index} not found in this branch`);

      if (body.delivery_partner_id) {
        const boy = await this.db.query(
          `SELECT id, full_name FROM delivery_partners WHERE id = $1 AND branch_id = $2 AND is_active = true`,
          [body.delivery_partner_id, body.branch_id],
        );
        if (!boy?.length) throw new BadRequestException('Delivery boy not found or not in this branch');
      }

      const sortResult = await this.db.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM delivery_routes WHERE branch_id = $1 AND sector_index = $2`,
        [body.branch_id, body.sector_index],
      );

      const result = await this.db.query(
        `INSERT INTO delivery_routes (branch_id, sector_index, route_name, shift_type, delivery_partner_id, max_stops, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, route_name, shift_type, delivery_partner_id, sort_order`,
        [
          body.branch_id,
          body.sector_index,
          body.route_name.trim(),
          body.shift_type || 'morning',
          body.delivery_partner_id || null,
          body.max_stops || 80,
          sortResult?.[0]?.next_order || 0,
        ],
      );

      return {
        status: true,
        message: `Route "${body.route_name.trim()}" created in Sector ${body.sector_index}`,
        data: result?.[0],
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('createRoute error', { error });
      throw new InternalServerErrorException('Failed to create route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get all routes for a branch (grouped by sector)
  // ═══════════════════════════════════════════════════════════════

  async getRoutesForBranch(branchId: string) {
    try {
      const result = await this.db.query(
        `SELECT
          r.id,
          r.sector_index,
          r.route_name,
          r.shift_type,
          r.delivery_partner_id,
          r.max_stops,
          r.sort_order,
          r.is_active,
          db.full_name AS delivery_partner_name,
          db.phone AS delivery_partner_phone,
          COALESCE(rc.customer_count, 0)::int AS customer_count
        FROM delivery_routes r
        LEFT JOIN delivery_partners db ON db.id = r.delivery_partner_id
        LEFT JOIN (
          SELECT route_id, COUNT(*)::int AS customer_count
          FROM delivery_route_customers
          WHERE is_active = true
          GROUP BY route_id
        ) rc ON rc.route_id = r.id
        WHERE r.branch_id = $1 AND r.is_active = true
        ORDER BY r.sector_index, r.sort_order`,
        [branchId],
      );

      return { status: true, data: result || [] };
    } catch (error) {
      this.developer.error('getRoutesForBranch error', { error });
      throw new InternalServerErrorException('Failed to fetch routes');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get routes for a specific sector
  // ═══════════════════════════════════════════════════════════════

  async getRoutesForSector(branchId: string, sectorIndex: number) {
    try {
      const result = await this.db.query(
        `SELECT
          r.id,
          r.sector_index,
          r.route_name,
          r.shift_type,
          r.delivery_partner_id,
          r.max_stops,
          r.sort_order,
          r.is_active,
          db.full_name AS delivery_partner_name,
          db.phone AS delivery_partner_phone,
          COALESCE(rc.customer_count, 0)::int AS customer_count
        FROM delivery_routes r
        LEFT JOIN delivery_partners db ON db.id = r.delivery_partner_id
        LEFT JOIN (
          SELECT route_id, COUNT(*)::int AS customer_count
          FROM delivery_route_customers
          WHERE is_active = true
          GROUP BY route_id
        ) rc ON rc.route_id = r.id
        WHERE r.branch_id = $1 AND r.sector_index = $2 AND r.is_active = true
        ORDER BY r.sort_order`,
        [branchId, sectorIndex],
      );

      return { status: true, data: result || [] };
    } catch (error) {
      this.developer.error('getRoutesForSector error', { error });
      throw new InternalServerErrorException('Failed to fetch sector routes');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Assign a delivery boy to a route
  // ═══════════════════════════════════════════════════════════════

  async assignBoyToRoute(routeId: string, deliveryPartnerId: string) {
    try {
      const route = await this.db.query(
        `SELECT id, branch_id, route_name FROM delivery_routes WHERE id = $1 AND is_active = true`,
        [routeId],
      );
      if (!route?.length) throw new BadRequestException('Route not found');

      const boy = await this.db.query(
        `SELECT id, full_name FROM delivery_partners WHERE id = $1 AND branch_id = $2 AND is_active = true`,
        [deliveryPartnerId, route[0].branch_id],
      );
      if (!boy?.length) throw new BadRequestException('Delivery boy not found in this branch');

      await this.db.query(
        `UPDATE delivery_routes SET delivery_partner_id = $1, updated_at = NOW() WHERE id = $2`,
        [deliveryPartnerId, routeId],
      );

      await this.db.query(
        `UPDATE customers SET delivery_partner_id = $1
         WHERE id IN (SELECT customer_id FROM delivery_route_customers WHERE route_id = $2 AND is_active = true)
         AND (override_delivery_partner_id IS NULL)`,
        [deliveryPartnerId, routeId],
      );

      return {
        status: true,
        message: `Route "${route[0].route_name}" assigned to ${boy[0].full_name}`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('assignBoyToRoute error', { error });
      throw new InternalServerErrorException('Failed to assign boy to route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Add a customer to a route
  // ═══════════════════════════════════════════════════════════════

  async assignCustomerToRoute(routeId: string, customerId: string, sequenceNumber?: number) {
    try {
      const route = await this.db.query(
        `SELECT id, branch_id, delivery_partner_id, route_name FROM delivery_routes WHERE id = $1 AND is_active = true`,
        [routeId],
      );
      if (!route?.length) throw new BadRequestException('Route not found');

      const customer = await this.db.query(
        `SELECT id, full_name, branch_id FROM customers WHERE id = $1`,
        [customerId],
      );
      if (!customer?.length) throw new BadRequestException('Customer not found');
      if (customer[0].branch_id !== route[0].branch_id) {
        throw new BadRequestException('Customer does not belong to this branch');
      }

      const existing = await this.db.query(
        `SELECT drc.id, r.route_name FROM delivery_route_customers drc
         JOIN delivery_routes r ON r.id = drc.route_id
         WHERE drc.customer_id = $1 AND drc.is_active = true`,
        [customerId],
      );
      if (existing?.length) {
        throw new BadRequestException(`Customer is already in route "${existing[0].route_name}". Remove them first.`);
      }

      if (sequenceNumber === undefined) {
        const seqResult = await this.db.query(
          `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq FROM delivery_route_customers WHERE route_id = $1`,
          [routeId],
        );
        sequenceNumber = seqResult?.[0]?.next_seq || 1;
      }

      await this.db.query(
        `INSERT INTO delivery_route_customers (route_id, customer_id, sequence_number)
         VALUES ($1, $2, $3)`,
        [routeId, customerId, sequenceNumber],
      );

      const updateFields: string[] = ['route_id = $1'];
      const updateParams: any[] = [routeId];
      if (route[0].delivery_partner_id) {
        updateFields.push('delivery_partner_id = $' + (updateParams.length + 1));
        updateParams.push(route[0].delivery_partner_id);
      }
      updateParams.push(customerId);
      await this.db.query(
        `UPDATE customers SET ${updateFields.join(', ')} WHERE id = $${updateParams.length} AND (override_delivery_partner_id IS NULL)`,
        updateParams,
      );

      return {
        status: true,
        message: `${customer[0].full_name} added to route "${route[0].route_name}" at position ${sequenceNumber}`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('assignCustomerToRoute error', { error });
      throw new InternalServerErrorException('Failed to assign customer to route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Remove a customer from a route
  // ═══════════════════════════════════════════════════════════════

  async removeCustomerFromRoute(routeId: string, customerId: string) {
    try {
      await this.db.query(
        `DELETE FROM delivery_route_customers WHERE route_id = $1 AND customer_id = $2`,
        [routeId, customerId],
      );

      const customer = await this.db.query(
        `SELECT c.id, c.branch_id, c.sector_index, bs.delivery_partner_id AS sector_boy_id
         FROM customers c
         LEFT JOIN branch_sectors bs ON bs.branch_id = c.branch_id AND bs.sector_index = c.sector_index
         WHERE c.id = $1`,
        [customerId],
      );

      const sectorBoyId = customer?.[0]?.sector_boy_id || null;
      await this.db.query(
        `UPDATE customers SET route_id = NULL, delivery_partner_id = $1 WHERE id = $2 AND (override_delivery_partner_id IS NULL)`,
        [sectorBoyId, customerId],
      );

      return {
        status: true,
        message: 'Customer removed from route and reverted to sector assignment.',
      };
    } catch (error) {
      this.developer.error('removeCustomerFromRoute error', { error });
      throw new InternalServerErrorException('Failed to remove customer from route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 1C — Reorder customers within a route (bulk UPDATE)
  // Replaces N individual SQL UPDATEs with one unnest query
  // ═══════════════════════════════════════════════════════════════

  async reorderRouteCustomers(routeId: string, orderedCustomerIds: string[]) {
    try {
      if (!orderedCustomerIds?.length) throw new BadRequestException('orderedCustomerIds is required');

      // Single bulk UPDATE using unnest — avoids N round-trips
      await this.db.query(
        `UPDATE delivery_route_customers AS drc
         SET sequence_number = data.seq
         FROM (
           SELECT unnest($1::uuid[]) AS cid,
                  generate_subscripts($1::uuid[], 1) AS seq
         ) AS data
         WHERE drc.route_id = $2 AND drc.customer_id = data.cid`,
        [orderedCustomerIds, routeId],
      );

      return {
        status: true,
        message: `${orderedCustomerIds.length} customers reordered successfully`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('reorderRouteCustomers error', { error });
      throw new InternalServerErrorException('Failed to reorder customers');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Delete a route (soft-delete: marks is_active = false)
  // ═══════════════════════════════════════════════════════════════

  async deleteRoute(routeId: string) {
    try {
      const route = await this.db.query(
        `SELECT id, branch_id, route_name, sector_index FROM delivery_routes WHERE id = $1`,
        [routeId],
      );
      if (!route?.length) throw new BadRequestException('Route not found');

      const sectorBoy = await this.db.query(
        `SELECT delivery_partner_id FROM branch_sectors WHERE branch_id = $1 AND sector_index = $2`,
        [route[0].branch_id, route[0].sector_index],
      );
      const sectorBoyId = sectorBoy?.[0]?.delivery_partner_id || null;

      // Revert customers to sector pool
      await this.db.query(
        `UPDATE customers SET route_id = NULL, delivery_partner_id = $1
         WHERE id IN (SELECT customer_id FROM delivery_route_customers WHERE route_id = $2)
         AND (override_delivery_partner_id IS NULL)`,
        [sectorBoyId, routeId],
      );

      // Deactivate route_customers entries
      await this.db.query(
        `UPDATE delivery_route_customers SET is_active = false WHERE route_id = $1`,
        [routeId],
      );

      // Soft-delete route (keeps audit trail)
      await this.db.query(
        `UPDATE delivery_routes SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [routeId],
      );

      return {
        status: true,
        message: `Route "${route[0].route_name}" deleted. Customers reverted to sector pool.`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('deleteRoute error', { error });
      throw new InternalServerErrorException('Failed to delete route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 1E — Get unrouted customers (paginated)
  // ═══════════════════════════════════════════════════════════════

  async getUnroutedCustomers(
    branchId: string,
    sectorIndex: number,
    page = 1,
    limit = 50,
  ) {
    try {
      const offset = (page - 1) * limit;

      const [countResult, result] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*)::int AS total
           FROM customers
           WHERE branch_id = $1 AND sector_index = $2 AND route_id IS NULL`,
          [branchId, sectorIndex],
        ),
        this.db.query(
          `SELECT
            c.id, c.full_name, c.phone, c.email, c.apartment_name,
            c.address_lat, c.address_lng, c.area, c.delivery_notes,
            c.delivery_partner_id,
            db.full_name AS delivery_partner_name
          FROM customers c
          LEFT JOIN delivery_partners db ON db.id = c.delivery_partner_id
          WHERE c.branch_id = $1
            AND c.sector_index = $2
            AND c.route_id IS NULL
          ORDER BY c.apartment_name NULLS LAST, c.full_name
          LIMIT $3 OFFSET $4`,
          [branchId, sectorIndex, limit, offset],
        ),
      ]);

      const total = countResult?.[0]?.total || 0;
      return {
        status: true,
        data: result || [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.developer.error('getUnroutedCustomers error', { error });
      throw new InternalServerErrorException('Failed to fetch unrouted customers');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 2 — GPS-first Auto-Group with Geo-Clustering
  // Completely replaces the old apartment-only grouping
  // ═══════════════════════════════════════════════════════════════

  async autoGroupCustomers(
    branchId: string,
    sectorIndex: number,
    options: {
      force?: boolean;
      maxStops?: number;
      clusterRadiusM?: number;
      shiftType?: 'morning' | 'evening';
    } = {},
  ) {
    try {
      const { force = false, maxStops = 40, clusterRadiusM = 300, shiftType = 'morning' } = options;

      // ── Phase 1D: Idempotency check ──
      const existingRoutes = await this.db.query(
        `SELECT COUNT(*)::int AS count FROM delivery_routes
         WHERE branch_id = $1 AND sector_index = $2 AND is_active = true`,
        [branchId, sectorIndex],
      );
      if (existingRoutes?.[0]?.count > 0 && !force) {
        return {
          status: false,
          message: `Sector ${sectorIndex} already has ${existingRoutes[0].count} routes. Use ?force=true to clear and re-run.`,
          routes_created: 0,
          warning: 'existing_routes',
        };
      }

      // If force=true, clear existing routes first
      if (force) {
        await this._clearSectorRoutes(branchId, sectorIndex);
      }

      // 1. Fetch branch/warehouse location
      const branch = await this.db.query(
        `SELECT lat, lng FROM branches WHERE branch_id = $1`,
        [branchId],
      );
      const warehouseLat = branch?.[0]?.lat || 0;
      const warehouseLng = branch?.[0]?.lng || 0;

      // ── Load ALL unrouted customers in sector ──
      const allCustomers = await this.db.query(
        `SELECT
          c.id, c.full_name, c.apartment_name, c.area,
          c.address_lat, c.address_lng
         FROM customers c
         WHERE c.branch_id = $1 AND c.sector_index = $2 AND c.route_id IS NULL`,
        [branchId, sectorIndex],
      );

      if (!allCustomers?.length) {
        return {
          status: true,
          message: 'No unrouted customers found in this sector.',
          routes_created: 0,
          pool_b_count: 0,
        };
      }

      // ── Phase 1F: Split into Pool A (has GPS) and Pool B (no GPS) ──
      const poolA: CustomerStop[] = [];
      const poolB_apt: Map<string, CustomerStop[]> = new Map(); // has apartment_name
      const poolB_neither: CustomerStop[] = [];                 // no GPS, no apt

      for (const c of allCustomers) {
        const hasGps =
          c.address_lat != null && c.address_lng != null &&
          c.address_lat !== 0 && c.address_lng !== 0;

        if (hasGps) {
          poolA.push(c as CustomerStop);
        } else if (c.apartment_name?.trim()) {
          const k = c.apartment_name.trim();
          if (!poolB_apt.has(k)) poolB_apt.set(k, []);
          poolB_apt.get(k)!.push(c as CustomerStop);
        } else {
          poolB_neither.push(c as CustomerStop);
        }
      }

      // ── Get delivery boys assigned to this sector (for strip distribution) ──
      const sectorBoys = await this.db.query(
        `SELECT delivery_partner_id FROM branch_sectors
         WHERE branch_id = $1 AND sector_index = $2 AND delivery_partner_id IS NOT NULL`,
        [branchId, sectorIndex],
      );
      const boyIds: string[] = (sectorBoys || []).map((r: any) => r.delivery_partner_id);

      let routesCreated = 0;
      let sortOrder = 0;

      // ═══════════════════════════════════════════════════════════
      // POOL A — GPS-first Geo-Clustering
      // ═══════════════════════════════════════════════════════════
      if (poolA.length > 0) {
        const clusters = geoCluster(poolA, clusterRadiusM, maxStops);

        // Distribute clusters across delivery boys (contiguous strips)
        let boyAssignment: Map<string, typeof clusters> = new Map();
        if (boyIds.length > 0) {
          boyAssignment = distributeRoutesAcrossBoys(clusters, boyIds);
        }

        // Flatten to list of (cluster, boyId)
        const clusterList: { cluster: (typeof clusters)[0]; boyId: string | null }[] = [];
        if (boyIds.length > 0) {
          for (const [boyId, boyClusters] of boyAssignment.entries()) {
            for (const cluster of boyClusters) {
              clusterList.push({ cluster, boyId });
            }
          }
        } else {
          for (const cluster of clusters) {
            clusterList.push({ cluster, boyId: null });
          }
        }

        for (const { cluster, boyId } of clusterList) {
          const routeName = `${cluster.suggestedName} ${shiftType === 'morning' ? 'Morning' : 'Evening'}`;

          // Create route
          const routeResult = await this.db.query(
            `INSERT INTO delivery_routes
               (branch_id, sector_index, route_name, shift_type, delivery_partner_id, max_stops, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [branchId, sectorIndex, routeName, shiftType, boyId, maxStops, sortOrder++],
          );
          const routeId = routeResult?.[0]?.id;
          if (!routeId) continue;

          // Apply TSP ordering to customers in this cluster
          const stops = cluster.customers.map((c) => ({
            lat: c.address_lat,
            lng: c.address_lng,
          }));
          const orderedIndices = nearestNeighborTSP(stops, warehouseLat, warehouseLng);
          const orderedCustomers = orderedIndices.map((i) => cluster.customers[i]);

          // Bulk insert customers into route
          await this._bulkInsertRouteCustomers(routeId, orderedCustomers.map((c) => c.id), branchId, boyId);
          routesCreated++;
        }
      }

      // ═══════════════════════════════════════════════════════════
      // POOL B — Apartment-name fallback (no GPS)
      // ═══════════════════════════════════════════════════════════
      for (const [aptName, customers] of poolB_apt.entries()) {
        const routeName = `${aptName} ${shiftType === 'morning' ? 'Morning' : 'Evening'}`;
        const routeResult = await this.db.query(
          `INSERT INTO delivery_routes
             (branch_id, sector_index, route_name, shift_type, max_stops, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [branchId, sectorIndex, routeName, shiftType, maxStops, sortOrder++],
        );
        const routeId = routeResult?.[0]?.id;
        if (!routeId) continue;
        await this._bulkInsertRouteCustomers(routeId, customers.map((c) => c.id), branchId, null);
        routesCreated++;
      }

      // ═══════════════════════════════════════════════════════════
      // POOL B — Neither GPS nor Apartment → Manual Assignment route
      // ═══════════════════════════════════════════════════════════
      let poolBNeitherCount = 0;
      if (poolB_neither.length > 0) {
        poolBNeitherCount = poolB_neither.length;
        const routeResult = await this.db.query(
          `INSERT INTO delivery_routes
             (branch_id, sector_index, route_name, shift_type, max_stops, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [branchId, sectorIndex, 'Manual Assignment Required', shiftType, maxStops, sortOrder++],
        );
        const routeId = routeResult?.[0]?.id;
        if (routeId) {
          await this._bulkInsertRouteCustomers(routeId, poolB_neither.map((c) => c.id), branchId, null);
          routesCreated++;
        }
      }

      const totalCustomers = allCustomers.length;
      const poolACount = poolA.length;
      const poolBCount = totalCustomers - poolACount;

      return {
        status: true,
        message: `Auto-grouped: ${routesCreated} route(s) created from ${totalCustomers} customers.`,
        routes_created: routesCreated,
        pool_a_count: poolACount,
        pool_b_count: poolBCount,
        manual_assignment_count: poolBNeitherCount,
        warning: poolBNeitherCount > 0
          ? `${poolBNeitherCount} customers placed in "Manual Assignment Required" route — they have no GPS or apartment name.`
          : null,
      };
    } catch (error) {
      this.developer.error('autoGroupCustomers error', { error });
      throw new InternalServerErrorException('Failed to auto-group customers');
    }
  }

  // ── Internal: bulk-insert customers into a route & update customer.route_id ──
  // Note: customer_id in delivery_route_customers is bigint (matches customers.id)
  private async _bulkInsertRouteCustomers(
    routeId: string,
    customerIds: (string | number)[],
    branchId: string,
    deliveryPartnerId: string | null,
  ): Promise<void> {
    if (!customerIds.length) return;

    // Build VALUES for bulk insert
    const values: any[] = [routeId];
    const valueParts: string[] = [];
    let paramIdx = 2;
    for (let i = 0; i < customerIds.length; i++) {
      valueParts.push(`($1, $${paramIdx}, $${paramIdx + 1})`);
      values.push(customerIds[i], i + 1);
      paramIdx += 2;
    }
    await this.db.query(
      `INSERT INTO delivery_route_customers (route_id, customer_id, sequence_number)
       VALUES ${valueParts.join(', ')}
       ON CONFLICT (route_id, customer_id) DO NOTHING`,
      values,
    );

    // Update customers.route_id in one query (bigint IDs)
    await this.db.query(
      `UPDATE customers SET route_id = $1
       WHERE id = ANY($2::bigint[]) AND branch_id = $3`,
      [routeId, customerIds, branchId],
    );
  }

  // ── Internal: clear all routes for a sector (used by force=true) ──
  private async _clearSectorRoutes(branchId: string, sectorIndex: number): Promise<void> {
    // Revert customers to unrouted state
    await this.db.query(
      `UPDATE customers SET route_id = NULL
       WHERE branch_id = $1 AND sector_index = $2`,
      [branchId, sectorIndex],
    );
    // Deactivate route_customers
    await this.db.query(
      `UPDATE delivery_route_customers SET is_active = false
       WHERE route_id IN (
         SELECT id FROM delivery_routes
         WHERE branch_id = $1 AND sector_index = $2 AND is_active = true
       )`,
      [branchId, sectorIndex],
    );
    // Soft-delete routes
    await this.db.query(
      `UPDATE delivery_routes SET is_active = false, updated_at = NOW()
       WHERE branch_id = $1 AND sector_index = $2 AND is_active = true`,
      [branchId, sectorIndex],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 3 — Optimize route sequence using TSP nearest-neighbor
  // ═══════════════════════════════════════════════════════════════

  async optimizeRouteSequence(routeId: string) {
    try {
      const route = await this.db.query(
        `SELECT r.id, r.route_name, r.branch_id,
                b.lat AS warehouse_lat,
                b.lng AS warehouse_lng
         FROM delivery_routes r
         JOIN branches b ON b.branch_id = r.branch_id
         WHERE r.id = $1 AND r.is_active = true`,
        [routeId],
      );
      if (!route?.length) throw new BadRequestException('Route not found');

      const warehouseLat = route[0].warehouse_lat || 0;
      const warehouseLng = route[0].warehouse_lng || 0;

      const customers = await this.db.query(
        `SELECT drc.customer_id AS id, c.address_lat, c.address_lng
         FROM delivery_route_customers drc
         JOIN customers c ON c.id = drc.customer_id
         WHERE drc.route_id = $1 AND drc.is_active = true`,
        [routeId],
      );

      if (!customers?.length) {
        return { status: true, message: 'No customers in route to optimize.', distance_saved_m: 0 };
      }

      // Filter to customers with GPS
      const withGps = customers.filter(
        (c: any) => c.address_lat && c.address_lng && c.address_lat !== 0,
      );

      if (withGps.length < 2) {
        return { status: true, message: 'Not enough customers with GPS to optimize.', distance_saved_m: 0 };
      }

      const stops = withGps.map((c: any) => ({ lat: c.address_lat, lng: c.address_lng }));

      // Calculate before distance
      const distanceBefore = totalRouteDistance(stops, warehouseLat, warehouseLng);

      // Apply TSP
      const orderedIndices = nearestNeighborTSP(stops, warehouseLat, warehouseLng);
      const orderedStops = orderedIndices.map((i) => stops[i]);
      const distanceAfter = totalRouteDistance(orderedStops, warehouseLat, warehouseLng);

      // Bulk UPDATE sequence_numbers (customer_id is bigint in DB)
      const orderedIds = orderedIndices.map((i) => withGps[i].id);
      await this.db.query(
        `UPDATE delivery_route_customers AS drc
         SET sequence_number = data.seq
         FROM (
           SELECT unnest($1::bigint[]) AS cid,
                  generate_subscripts($1::bigint[], 1) AS seq
         ) AS data
         WHERE drc.route_id = $2 AND drc.customer_id = data.cid`,
        [orderedIds, routeId],
      );

      const savedMetres = Math.round(distanceBefore - distanceAfter);
      return {
        status: true,
        message: `Route optimized: ${orderedIds.length} stops reordered.`,
        distance_before_m: Math.round(distanceBefore),
        distance_after_m: Math.round(distanceAfter),
        distance_saved_m: savedMetres,
        distance_saved_km: +(savedMetres / 1000).toFixed(2),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('optimizeRouteSequence error', { error });
      throw new InternalServerErrorException('Failed to optimize route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 4 — Driver App Order View (replaces getRunSheet)
  // Shows today's orders with subscription quantities per stop
  // ═══════════════════════════════════════════════════════════════

  async getDriverOrderView(routeId: string, date?: string) {
    try {
      const route = await this.db.query(
        `SELECT r.id, r.route_name, r.shift_type, r.branch_id, r.sector_index,
                db.full_name AS delivery_partner_name, db.phone AS delivery_partner_phone
         FROM delivery_routes r
         LEFT JOIN delivery_partners db ON db.id = r.delivery_partner_id
         WHERE r.id = $1`,
        [routeId],
      );
      if (!route?.length) throw new BadRequestException('Route not found');

      const targetDate = date || new Date().toISOString().split('T')[0];

      // Driver order view: sequence from delivery_route_customers,
      // subscription quantities from subscriptions + subscription_items
      // proof/status from delivery_proof_logs
      const stops = await this.db.query(
        `SELECT
          drc.sequence_number,
          drc.notes AS route_notes,
          c.id AS customer_id,
          c.customer_id AS customer_code,
          COALESCE(c.full_name, c.first_name || ' ' || COALESCE(c.last_name,'')) AS full_name,
          c.phone,
          c.address_lat,
          c.address_lng,
          c.apartment_name,
          c.delivery_notes,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'product_name', COALESCE(p.name, pv.name, 'Product'),
                'morning_qty',  COALESCE(sws.m_quantity, 0),
                'evening_qty',  COALESCE(sws.e_quantity, 0),
                'unit_price',   si.unit_price
              ) ORDER BY si.id
            ) FILTER (WHERE si.id IS NOT NULL AND sub.status = 'active'),
            '[]'
          ) AS items_today,
          dpl.delivery_status,
          dpl.proof_photo_url
        FROM delivery_route_customers drc
        JOIN customers c ON c.id = drc.customer_id
        LEFT JOIN subscriptions sub
          ON sub.customer_id = c.customer_id
          AND sub.status = 'active'
          AND (sub.start_date <= $2 AND (sub.end_date IS NULL OR sub.end_date >= $2))
        LEFT JOIN subscription_items si ON si.subscription_id = sub.subscription_id AND si.status = 'active'
        LEFT JOIN subscription_weekly_schedule sws
          ON sws.subscription_item_id = si.id
          AND sws.day_of_week = EXTRACT(DOW FROM CAST($2 AS DATE))
        LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN delivery_proof_logs dpl
          ON dpl.customer_id = c.customer_id
          AND dpl.delivery_date = $2
          AND dpl.route_id = $1
        WHERE drc.route_id = $1 AND drc.is_active = true
        GROUP BY
          drc.sequence_number, drc.notes, c.id, c.customer_id, c.full_name,
          c.first_name, c.last_name, c.phone,
          c.address_lat, c.address_lng, c.apartment_name, c.delivery_notes,
          dpl.delivery_status, dpl.proof_photo_url
        ORDER BY drc.sequence_number`,
        [routeId, targetDate],
      );

      return {
        status: true,
        data: {
          route: route[0],
          date: targetDate,
          stops: stops || [],
          total_stops: stops?.length || 0,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getDriverOrderView error', { error });
      throw new InternalServerErrorException('Failed to generate driver order view');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 4 — Temporary daily route reassignment (sick day)
  // Creates/updates a route_daily_overrides row for today
  // ═══════════════════════════════════════════════════════════════

  async temporaryReassignRoute(
    routeId: string,
    newBoyId: string,
    date: string,
    reason?: string,
    adminId?: string,
  ) {
    try {
      const route = await this.db.query(
        `SELECT id, route_name, branch_id FROM delivery_routes WHERE id = $1 AND is_active = true`,
        [routeId],
      );
      if (!route?.length) throw new BadRequestException('Route not found');

      const boy = await this.db.query(
        `SELECT id, full_name FROM delivery_partners WHERE id = $1 AND branch_id = $2 AND is_active = true`,
        [newBoyId, route[0].branch_id],
      );
      if (!boy?.length) throw new BadRequestException('Delivery boy not found in this branch');

      await this.db.query(
        `INSERT INTO route_daily_overrides
           (route_id, override_date, assigned_delivery_partner_id, reason, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (route_id, override_date) DO UPDATE
           SET assigned_delivery_partner_id = EXCLUDED.assigned_delivery_partner_id,
               reason = EXCLUDED.reason,
               created_by = EXCLUDED.created_by,
               created_at = NOW()`,
        [routeId, date, newBoyId, reason || null, adminId || null],
      );

      return {
        status: true,
        message: `Route "${route[0].route_name}" temporarily assigned to ${boy[0].full_name} for ${date}. Permanent assignment unchanged.`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('temporaryReassignRoute error', { error });
      throw new InternalServerErrorException('Failed to temporarily reassign route');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get customers in a specific route (ordered)
  // ═══════════════════════════════════════════════════════════════

  async getRouteCustomers(routeId: string) {
    try {
      const result = await this.db.query(
        `SELECT
          drc.sequence_number,
          drc.notes,
          c.id AS customer_id,
          c.full_name,
          c.phone,
          c.apartment_name,
          c.delivery_notes,
          c.address_lat,
          c.address_lng
        FROM delivery_route_customers drc
        JOIN customers c ON c.id = drc.customer_id
        WHERE drc.route_id = $1 AND drc.is_active = true
        ORDER BY drc.sequence_number`,
        [routeId],
      );

      return { status: true, data: result || [] };
    } catch (error) {
      this.developer.error('getRouteCustomers error', { error });
      throw new InternalServerErrorException('Failed to fetch route customers');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup routes when sector count changes
  // ═══════════════════════════════════════════════════════════════

  async cleanupRoutesForBranch(branchId: string) {
    try {
      await this.db.query(
        `UPDATE customers SET route_id = NULL WHERE branch_id = $1`,
        [branchId],
      );
      await this.db.query(
        `UPDATE delivery_route_customers SET is_active = false
         WHERE route_id IN (SELECT id FROM delivery_routes WHERE branch_id = $1)`,
        [branchId],
      );
      const deleted = await this.db.query(
        `UPDATE delivery_routes SET is_active = false, updated_at = NOW()
         WHERE branch_id = $1 AND is_active = true
         RETURNING id`,
        [branchId],
      );

      return deleted?.length || 0;
    } catch (error) {
      this.developer.error('cleanupRoutesForBranch error', { error });
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // getMyRoute — Driver app startup: find today's route for this boy
  //
  // Priority:
  //   1. route_daily_overrides (sick-day reassignment for today)
  //   2. delivery_routes.delivery_partner_id (permanent assignment)
  //
  // shift_type defaults to time-based: before 12 PM → morning
  // ═══════════════════════════════════════════════════════════════

  async getMyRoute(
    deliveryPartnerId: string,
    date?: string,
    shiftType?: 'morning' | 'evening',
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
        return {
          status: true,
          data: null,
          message: `No route assigned. Delivery boy profile not found for identifier: ${deliveryPartnerId}.`,
        };
      }

      const targetDate = date || new Date().toISOString().split('T')[0];

      // Auto-detect shift from current IST time if not specified
      const resolvedShift = shiftType || (() => {
        const now = new Date();
        const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() >= 30 ? 0 : 0);
        // IST = UTC + 5:30
        const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
        const istDate = new Date(istMs);
        return istDate.getHours() < 12 ? 'morning' : 'evening';
      })() as 'morning' | 'evening';

      // ── Step 1: Check daily overrides first ─────────────────────
      const override = await this.db.query(
        `SELECT rdo.route_id, dr.route_name, dr.shift_type, dr.branch_id,
                COUNT(DISTINCT drc.customer_id)::int AS total_stops
         FROM route_daily_overrides rdo
         JOIN delivery_routes dr ON dr.id = rdo.route_id
         LEFT JOIN delivery_route_customers drc ON drc.route_id = dr.id AND drc.is_active = true
         WHERE rdo.assigned_delivery_partner_id = $1
           AND rdo.override_date = $2
           AND dr.shift_type = $3
           AND dr.is_active = true
         GROUP BY rdo.route_id, dr.route_name, dr.shift_type, dr.branch_id
         LIMIT 1`,
        [resolvedBoyId, targetDate, resolvedShift],
      );

      if (override?.[0]) {
        return {
          status: true,
          data: {
            ...override[0],
            is_override: true,
            date: targetDate,
            shift_type: resolvedShift,
          },
        };
      }

      // ── Step 2: Fall back to permanent assignment ────────────────
      const permanent = await this.db.query(
        `SELECT dr.id AS route_id, dr.route_name, dr.shift_type, dr.branch_id,
                COUNT(DISTINCT drc.customer_id)::int AS total_stops
         FROM delivery_routes dr
         LEFT JOIN delivery_route_customers drc ON drc.route_id = dr.id AND drc.is_active = true
         WHERE dr.delivery_partner_id = $1
           AND dr.shift_type = $2
           AND dr.is_active = true
         GROUP BY dr.id, dr.route_name, dr.shift_type, dr.branch_id
         LIMIT 1`,
        [resolvedBoyId, resolvedShift],
      );

      if (!permanent?.[0]) {
        // Fallback: Check if they have an override or assignment in the other shift (e.g. morning vs evening)
        const otherShift = resolvedShift === 'morning' ? 'evening' : 'morning';

        // Check override in other shift
        const otherOverride = await this.db.query(
          `SELECT rdo.route_id, dr.route_name, dr.shift_type, dr.branch_id,
                  COUNT(DISTINCT drc.customer_id)::int AS total_stops
           FROM route_daily_overrides rdo
           JOIN delivery_routes dr ON dr.id = rdo.route_id
           LEFT JOIN delivery_route_customers drc ON drc.route_id = dr.id AND drc.is_active = true
           WHERE rdo.assigned_delivery_partner_id = $1
             AND rdo.override_date = $2
             AND dr.shift_type = $3
             AND dr.is_active = true
           GROUP BY rdo.route_id, dr.route_name, dr.shift_type, dr.branch_id
           LIMIT 1`,
          [resolvedBoyId, targetDate, otherShift],
        );

        if (otherOverride?.[0]) {
          return {
            status: true,
            data: {
              ...otherOverride[0],
              is_override: true,
              date: targetDate,
              shift_type: otherShift,
            },
          };
        }

        // Check permanent assignment in other shift
        const otherPermanent = await this.db.query(
          `SELECT dr.id AS route_id, dr.route_name, dr.shift_type, dr.branch_id,
                  COUNT(DISTINCT drc.customer_id)::int AS total_stops
           FROM delivery_routes dr
           LEFT JOIN delivery_route_customers drc ON drc.route_id = dr.id AND drc.is_active = true
           WHERE dr.delivery_partner_id = $1
             AND dr.shift_type = $2
             AND dr.is_active = true
           GROUP BY dr.id, dr.route_name, dr.shift_type, dr.branch_id
           LIMIT 1`,
          [resolvedBoyId, otherShift],
        );

        if (otherPermanent?.[0]) {
          return {
            status: true,
            data: {
              ...otherPermanent[0],
              is_override: false,
              date: targetDate,
              shift_type: otherShift,
            },
          };
        }

        return {
          status: true,
          data: null,
          message: `No route assigned for ${targetDate}. Contact your supervisor.`,
        };
      }

      return {
        status: true,
        data: {
          ...permanent[0],
          is_override: false,
          date: targetDate,
          shift_type: resolvedShift,
        },
      };
    } catch (error) {
      this.developer.error('getMyRoute error', { error });
      throw new InternalServerErrorException('Failed to fetch route');
    }
  }
}

