import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { StockMovementCoreService } from '../catalog-inventory/inventory/services/stock-movement-core.service';

function todayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

@Injectable()
export class DeliveryDispatchService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly stockCore: StockMovementCoreService,
  ) {}

  // ────────────────────────────────────────────────
  // Dispatch stock to delivery boy for a run
  // Creates delivery_dispatch_items + stock OUT movements
  // ────────────────────────────────────────────────
  async dispatchToDeliveryPartner(
    runId: string,
    items: Array<{
      warehouse_id: string;
      product_variant_id: string;
      planned_qty: number;
      loaded_qty: number;
      unit?: string;
    }>,
    adminId: string,
  ) {
    try {
      // Verify run exists
      const runRows = await this.db.query(
        `SELECT * FROM delivery_runs WHERE id::varchar = $1 OR run_id = $1`,
        [runId],
      );
      if (!runRows[0]) {
        throw new BadRequestException('Delivery run not found');
      }

      const run = runRows[0];

      // Generate dispatch_id
      const dispatchId = `DDSP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      return await this.db.transaction(async (client) => {
        const results: any[] = [];

        // Cleanup any existing dispatch items and reset dispatch balances for this run to start fresh
        await client.query(
          `DELETE FROM delivery_dispatch_items WHERE delivery_run_id = $1`,
          [run.run_id],
        );

        for (const item of items) {
          const loadedQty = item.loaded_qty || item.planned_qty;

          // 1. Validate warehouse stock
          const stock = await this.stockCore.getLockedStockBalance(
            client,
            item.warehouse_id,
            item.product_variant_id,
          );

          if (stock.available_quantity < loadedQty) {
            throw new BadRequestException(
              `Insufficient stock for variant ${item.product_variant_id} in warehouse ${item.warehouse_id}. Available: ${stock.available_quantity}, Requested: ${loadedQty}`,
            );
          }

          // 2. Create delivery_dispatch_items record
          const insertResult = await client.query(
            `INSERT INTO delivery_dispatch_items
              (dispatch_id, warehouse_id, delivery_run_id, product_variant_id,
               planned_qty, loaded_qty, unit, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (delivery_run_id, product_variant_id) DO UPDATE SET
              loaded_qty = EXCLUDED.loaded_qty,
              planned_qty = EXCLUDED.planned_qty,
              updated_at = NOW()
            RETURNING *`,
            [
              dispatchId, item.warehouse_id, run.run_id, item.product_variant_id,
              item.planned_qty, loadedQty, item.unit || 'pcs',
            ],
          );

          // 3. Create stock OUT movement
          await this.stockCore.recordStockMovement(client, {
            warehouse_id: item.warehouse_id,
            product_variant_id: item.product_variant_id,
            movement_type: 'dispatch',
            direction: -1,
            quantity: loadedQty,
            reference_type: 'delivery_run',
            reference_id: runId,
            notes: `Dispatch to delivery boy for run ${run.run_id || runId}`,
            created_by: adminId,
          });

          results.push(insertResult.rows[0]);
        }

        // 4. Update run status to 'in_progress' (dispatched corresponds to 'in_progress' in constraint)
        await client.query(
          `UPDATE delivery_runs
           SET status = 'in_progress', updated_at = NOW()
           WHERE id = $1 AND status IN ('pending', 'assigned')`,
          [runId],
        );

        return {
          status: true,
          data: { dispatch_id: dispatchId, items: results, run_id: runId },
          message: `${items.length} items dispatched for delivery run`,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('dispatchToDeliveryPartner error', { error });
      throw new InternalServerErrorException('Failed to dispatch to delivery boy');
    }
  }

  // ────────────────────────────────────────────────
  // Process delivery return (returned + damaged)
  // ────────────────────────────────────────────────
  async processDeliveryReturn(
    runId: string,
    items: Array<{
      product_variant_id: string;
      delivered_qty: number;
      returned_qty: number;
      damaged_qty: number;
      extra_sold_qty?: number;
      remarks?: string;
    }>,
    adminId: string,
  ) {
    try {
      // Verify run exists
      const runRows = await this.db.query(
        `SELECT * FROM delivery_runs WHERE id::varchar = $1 OR run_id = $1`,
        [runId],
      );
      if (!runRows[0]) {
        throw new BadRequestException('Delivery run not found');
      }
      const run = runRows[0];

      return await this.db.transaction(async (client) => {
        const results: any[] = [];

        for (const item of items) {
          // 1. Get the dispatch item record
          const dispatchItemResult = await client.query(
            `SELECT * FROM delivery_dispatch_items
             WHERE (delivery_run_id = $1 OR delivery_run_id = $2) AND product_variant_id = $3
             FOR UPDATE`,
            [run.run_id, String(run.id), item.product_variant_id],
          );

          if (!dispatchItemResult.rows[0]) {
            this.developer.error('Dispatch item not found', {
              runId, product_variant_id: item.product_variant_id,
            });
            continue;
          }

          const dispatchItem = dispatchItemResult.rows[0];
          const warehouseId = dispatchItem.warehouse_id;

          // 2. Update delivery_dispatch_items
          await client.query(
            `UPDATE delivery_dispatch_items
             SET delivered_qty = $3,
                 returned_qty = $4,
                 damaged_qty = $5,
                 extra_sold_qty = $6,
                 remarks = $7,
                 updated_at = NOW()
             WHERE (delivery_run_id = $1 OR delivery_run_id = $2) AND product_variant_id = $8`,
            [
              run.run_id, String(run.id),
              item.delivered_qty, item.returned_qty, item.damaged_qty,
              item.extra_sold_qty || 0, item.remarks || null,
              item.product_variant_id,
            ],
          );


          // 3. Create stock IN movement for returned items
          if (item.returned_qty > 0) {
            await this.stockCore.recordReturn(
              client, warehouseId, item.product_variant_id,
              item.returned_qty, 'delivery_run', runId, adminId,
            );
          }

          // 4. Create damage record for damaged items
          if (item.damaged_qty > 0) {
            await this.stockCore.recordDamage(
              client, warehouseId, item.product_variant_id,
              item.damaged_qty, 'delivery_run', runId, adminId,
            );
          }

          results.push({
            product_variant_id: item.product_variant_id,
            delivered: item.delivered_qty,
            returned: item.returned_qty,
            damaged: item.damaged_qty,
          });
        }

        // 5. Update run status to 'completed'
        await client.query(
          `UPDATE delivery_runs
           SET status = 'completed', updated_at = NOW()
           WHERE id = $1`,
          [runId],
        );

        return {
          status: true,
          data: { run_id: runId, items: results },
          message: 'Delivery return processed successfully',
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('processDeliveryReturn error', { error });
      throw new InternalServerErrorException('Failed to process delivery return');
    }
  }

  // ────────────────────────────────────────────────
  // Get Dispatch Summary
  // ────────────────────────────────────────────────
  async getDispatchSummary(query: any) {
    try {
      const { date, warehouse_id, page = 1, limit = 50 } = query;
      const targetDate = date || todayIST();
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [targetDate];
      const where: string[] = ['dr.run_date = $1'];

      if (warehouse_id) {
        params.push(warehouse_id);
        where.push(`ddi.warehouse_id = $${params.length}`);
      }

      const sql = `
        SELECT
          ddi.*,
          dr.run_id, dr.delivery_slot, dr.status AS run_status,
          db.full_name AS delivery_partner_name,
          pv.name AS variant_name, pv.sku,
          p.name AS product_name,
          w.name AS warehouse_name
        FROM delivery_dispatch_items ddi
        JOIN delivery_runs dr ON (dr.run_id::varchar = ddi.delivery_run_id OR dr.id::varchar = ddi.delivery_run_id)
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = dr.delivery_partner_id
        LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN warehouses w ON w.warehouse_id = ddi.warehouse_id
        WHERE ${where.join(' AND ')}
        ORDER BY dr.delivery_slot, db.full_name, p.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      // Totals
      const totalsSql = `
SELECT
    COUNT(DISTINCT ddi.delivery_run_id)::int AS total_runs,
    COUNT(DISTINCT ddi.product_variant_id)::int AS unique_products,
    COALESCE(SUM(ddi.planned_qty),0) AS total_planned,
    COALESCE(SUM(ddi.loaded_qty),0) AS total_loaded,
    COALESCE(SUM(ddi.delivered_qty),0) AS total_delivered,
    COALESCE(SUM(ddi.returned_qty),0) AS total_returned,
    COALESCE(SUM(ddi.damaged_qty),0) AS total_damaged
FROM delivery_dispatch_items ddi
JOIN delivery_runs dr
    ON (dr.run_id::varchar = ddi.delivery_run_id OR dr.id::varchar = ddi.delivery_run_id)
WHERE ${where.join(' AND ')}
`;

      let totals: any = {};
      try {
        const totalsRows = await this.db.query(totalsSql, params.slice(0, warehouse_id ? 2 : 1));
        totals = totalsRows[0] || {};
      } catch { /* non-critical */ }

      return {
        status: true,
        data: rows,
        totals,
        message: 'Dispatch summary fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchSummary error', { error });
      throw new InternalServerErrorException('Failed to retrieve dispatch summary');
    }
  }

  // ────────────────────────────────────────────────
  // Get dispatch items for a specific run
  // ────────────────────────────────────────────────
  async getRunDispatchItems(runId: string) {
    try {
      const sql = `
        SELECT
          ddi.*,
          pv.name AS variant_name, pv.sku,
          pv.unit_value,
          pv.unit_type,
          p.name AS product_name,
          w.name AS warehouse_name,
          COALESCE(sb.available_quantity, 0)::numeric AS warehouse_stock
        FROM delivery_dispatch_items ddi
        LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN warehouses w ON w.warehouse_id = ddi.warehouse_id
        LEFT JOIN stock_balances sb ON sb.product_variant_id = ddi.product_variant_id
          AND sb.warehouse_id = ddi.warehouse_id
        JOIN delivery_runs dr ON (dr.run_id::varchar = ddi.delivery_run_id OR dr.id::varchar = ddi.delivery_run_id)
        WHERE dr.id::varchar = $1 OR dr.run_id = $1
        ORDER BY p.name, pv.name
      `;
      const rows = await this.db.query(sql, [runId]);

      return { status: true, data: rows, message: 'Run dispatch items fetched' };
    } catch (error) {
      this.developer.error('getRunDispatchItems error', { error });
      throw new InternalServerErrorException('Failed to retrieve run dispatch items');
    }
  }

  /**
   * Variants that can actually be issued from a warehouse.
   *
   * Only rows with stock on hand are returned, and each carries the quantity
   * available, so the handover screen cannot offer something the shelf does not
   * have. Scope is resolved in this order: an explicit warehouse, the warehouse
   * attached to a run, or the warehouse serving a branch.
   */
  async getAvailableVariants(query: any = {}) {
    try {
      const warehouseId = await this.resolveWarehouseId(query);

      const params: any[] = [];
      const scope: string[] = ['sb.deleted_at IS NULL'];
      if (warehouseId) {
        params.push(warehouseId);
        scope.push(`sb.warehouse_id = $${params.length}`);
      }

      const sql = `
        SELECT
          pv.variant_id       AS product_variant_id,
          p.name              AS product_name,
          pv.name             AS variant_name,
          pv.unit_value,
          pv.unit_type,
          stock.available_quantity::numeric AS available_quantity,
          stock.warehouse_id
        FROM product_variants pv
        JOIN products p ON p.product_id = pv.product_id
        JOIN (
          SELECT
            sb.product_variant_id,
            SUM(sb.available_quantity)::numeric AS available_quantity,
            MIN(sb.warehouse_id)                AS warehouse_id
          FROM stock_balances sb
          WHERE ${scope.join(' AND ')}
          GROUP BY sb.product_variant_id
          HAVING SUM(sb.available_quantity) > 0
        ) stock ON stock.product_variant_id = pv.variant_id
        WHERE pv.status = 'active'
          AND pv.deleted_at IS NULL
          AND p.deleted_at IS NULL
        ORDER BY p.name, pv.name
      `;
      const rows = await this.db.query(sql, params);
      return {
        status: true,
        data: rows,
        warehouse_id: warehouseId,
        message: 'Available variants fetched',
      };
    } catch (error) {
      this.developer.error('getAvailableVariants error', { error });
      throw new InternalServerErrorException('Failed to fetch available variants');
    }
  }

  /**
   * Resolves which warehouse a stock question is being asked about.
   * Returns null when nothing identifies one, in which case stock is counted
   * across every warehouse.
   */
  private async resolveWarehouseId(query: {
    warehouse_id?: string;
    run_id?: string;
    branch_id?: string;
  }): Promise<string | null> {
    if (query.warehouse_id) return query.warehouse_id;

    if (query.run_id) {
      const rows = await this.db.query(
        `SELECT COALESCE(dr.warehouse_id, w.warehouse_id) AS warehouse_id
         FROM delivery_runs dr
         LEFT JOIN warehouses w
           ON w.branch_id = dr.branch_id AND w.is_active = true AND w.deleted_at IS NULL
         WHERE dr.run_id = $1 OR dr.id::varchar = $1
         LIMIT 1`,
        [String(query.run_id)],
      );
      if (rows?.[0]?.warehouse_id) return rows[0].warehouse_id;
    }

    if (query.branch_id) {
      const rows = await this.db.query(
        `SELECT warehouse_id FROM warehouses
         WHERE branch_id = $1 AND is_active = true AND deleted_at IS NULL
         ORDER BY created_at ASC
         LIMIT 1`,
        [query.branch_id],
      );
      if (rows?.[0]?.warehouse_id) return rows[0].warehouse_id;
    }

    return null;
  }

  // ────────────────────────────────────────────────
  // Get Dispatch Requirements grouped by warehouse + slot
  // Computes today's product requirements from order_items
  // ────────────────────────────────────────────────
  async getDispatchRequirements(query: any) {
    try {
      const { date, warehouse_id, delivery_slot } = query;
      const targetDate = date || todayIST();
      const params: any[] = [targetDate];
      const where: string[] = ['o.scheduled_date = $1', "o.status NOT IN ('cancelled','failed','rejected')"];

      if (warehouse_id) {
        params.push(warehouse_id);
        where.push(`w.warehouse_id = $${params.length}`);
      }
      if (delivery_slot) {
        params.push(delivery_slot);
        where.push(`o.delivery_slot = $${params.length}`);
      }

      // Join orders → order_items → branches → warehouses
      // warehouse comes from the branch's assigned warehouse
      const sql = `
        SELECT
          COALESCE(w.warehouse_id, b.branch_id) AS warehouse_id,
          COALESCE(w.name, b.branch_name, 'Unknown Warehouse') AS warehouse_name,
          o.delivery_slot,
          oi.variant_id AS product_variant_id,
          p.name AS product_name,
          pv.name AS variant_name,
          SUM(oi.quantity)::int AS required_qty,
          COUNT(DISTINCT o.order_id)::int AS total_orders,
          COALESCE(
            (SELECT sb.available_quantity
             FROM stock_balances sb
             WHERE sb.product_variant_id = oi.variant_id
               AND sb.warehouse_id = COALESCE(w.warehouse_id, b.branch_id)
             LIMIT 1),
            0
          )::numeric AS warehouse_stock
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        LEFT JOIN branches b ON b.branch_id = o.branch_id
        LEFT JOIN warehouses w ON w.branch_id = b.branch_id AND w.deleted_at IS NULL
        LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        WHERE ${where.join(' AND ')}
        GROUP BY
          -- w.warehouse_id and b.branch_id are grouped in their own right so the
          -- correlated stock lookup above can reference them.
          w.warehouse_id,
          b.branch_id,
          w.name,
          b.branch_name,
          o.delivery_slot,
          oi.variant_id,
          p.name,
          pv.name
        ORDER BY
          warehouse_name,
          o.delivery_slot,
          p.name,
          pv.name
      `;

      const rows = await this.db.query(sql, params);

      // Group by warehouse → slot → items
      const grouped: Record<string, {
        warehouse_id: string;
        warehouse_name: string;
        slots: Record<string, {
          delivery_slot: string;
          items: any[];
          total_orders: number;
          total_qty: number;
        }>;
      }> = {};

      for (const row of (rows || [])) {
        const wid = row.warehouse_id ?? 'unknown';
        const slot = row.delivery_slot ?? 'morning';
        if (!grouped[wid]) {
          grouped[wid] = {
            warehouse_id: wid,
            warehouse_name: row.warehouse_name,
            slots: {},
          };
        }
        if (!grouped[wid].slots[slot]) {
          grouped[wid].slots[slot] = {
            delivery_slot: slot,
            items: [],
            total_orders: 0,
            total_qty: 0,
          };
        }
        grouped[wid].slots[slot].items.push({
          product_variant_id: row.product_variant_id,
          product_name: row.product_name,
          variant_name: row.variant_name,
          required_qty: Number(row.required_qty),
          total_orders: Number(row.total_orders),
          warehouse_stock: Number(row.warehouse_stock),
          shortfall: Math.max(0, Number(row.required_qty) - Number(row.warehouse_stock)),
        });
        grouped[wid].slots[slot].total_orders += Number(row.total_orders);
        grouped[wid].slots[slot].total_qty += Number(row.required_qty);
      }

      const result = Object.values(grouped).map((wh) => ({
        ...wh,
        slots: Object.values(wh.slots),
      }));

      return {
        status: true,
        data: result,
        date: targetDate,
        message: 'Dispatch requirements fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchRequirements error', { error });
      throw new InternalServerErrorException('Failed to fetch dispatch requirements');
    }
  }

  // ────────────────────────────────────────────────
  // Get Delivery Runs ready for return processing
  // (in_progress/completed with unresolved returns)
  // ────────────────────────────────────────────────
  async getDispatchReturns(query: any) {
    try {
      const { date, warehouse_id, delivery_slot } = query;
      const targetDate = date || todayIST();
      const params: any[] = [targetDate];
      const where: string[] = ["dr.run_date = $1", "dr.status IN ('in_progress','completed')"];

      if (warehouse_id) {
        params.push(warehouse_id);
        // Runs rarely carry a warehouse of their own — match the one serving
        // the branch as well, or the filter silently returns nothing.
        where.push(`COALESCE(dr.warehouse_id, w.warehouse_id) = $${params.length}`);
      }
      if (delivery_slot) {
        params.push(delivery_slot);
        where.push(`dr.delivery_slot = $${params.length}`);
      }

      const sql = `
        SELECT
          dr.id,
          dr.run_id,
          dr.run_number,
          dr.delivery_slot,
          dr.run_date,
          dr.status AS run_status,
          COALESCE(dr.warehouse_id, w.warehouse_id) AS warehouse_id,
          COALESCE(w.name, b.branch_name) AS warehouse_name,
          dp.full_name AS delivery_partner_name,
          dp.delivery_partner_id,
          COUNT(ddi.id)::int AS total_items,
          COALESCE(SUM(ddi.loaded_qty), 0) AS total_loaded,
          COALESCE(SUM(ddi.delivered_qty), 0) AS total_delivered,
          COALESCE(SUM(ddi.returned_qty), 0) AS total_returned,
          COALESCE(SUM(ddi.loaded_qty - COALESCE(ddi.delivered_qty,0) - COALESCE(ddi.returned_qty,0) - COALESCE(ddi.damaged_qty,0)), 0) AS pending_return_qty
        FROM delivery_runs dr
        LEFT JOIN branches b ON b.branch_id = dr.branch_id
        LEFT JOIN warehouses w ON (
          w.warehouse_id = dr.warehouse_id
          OR (dr.warehouse_id IS NULL AND w.branch_id = dr.branch_id AND w.is_active = true)
        ) AND w.deleted_at IS NULL
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = dr.delivery_partner_id
        LEFT JOIN delivery_dispatch_items ddi ON (
          ddi.delivery_run_id = dr.run_id::varchar
          OR ddi.delivery_run_id = dr.id::varchar
        ) AND ddi.deleted_at IS NULL
        WHERE ${where.join(' AND ')}
          AND dr.deleted_at IS NULL
        GROUP BY
          dr.id, dr.run_id, dr.run_number, dr.delivery_slot, dr.run_date, dr.status,
          dr.warehouse_id, w.warehouse_id, w.name, b.branch_name,
          dp.full_name, dp.delivery_partner_id
        HAVING COUNT(ddi.id) > 0
        ORDER BY dr.delivery_slot, dr.run_date DESC
      `;

      const rows = await this.db.query(sql, params);
      return {
        status: true,
        data: rows || [],
        date: targetDate,
        message: 'Dispatch returns fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchReturns error', { error });
      throw new InternalServerErrorException('Failed to fetch dispatch returns');
    }
  }

  // ────────────────────────────────────────────────
  // Get return preview for a specific run
  // ────────────────────────────────────────────────
  async getRunReturnPreview(runId: string) {
    try {
      const sql = `
        SELECT
          ddi.id,
          ddi.dispatch_id,
          ddi.product_variant_id,
          ddi.warehouse_id,
          w.name AS warehouse_name,
          pv.name AS variant_name,
          p.name AS product_name,
          ddi.loaded_qty,
          COALESCE(ddi.delivered_qty, 0) AS delivered_qty,
          COALESCE(ddi.returned_qty, 0) AS returned_qty,
          COALESCE(ddi.damaged_qty, 0) AS damaged_qty,
          GREATEST(
            ddi.loaded_qty
              - COALESCE(ddi.delivered_qty, 0)
              - COALESCE(ddi.returned_qty, 0)
              - COALESCE(ddi.damaged_qty, 0),
            0
          ) AS returnable_qty
        FROM delivery_dispatch_items ddi
        LEFT JOIN warehouses w ON w.warehouse_id = ddi.warehouse_id
        LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        JOIN delivery_runs dr ON (
          dr.run_id::varchar = ddi.delivery_run_id
          OR dr.id::varchar = ddi.delivery_run_id
        )
        WHERE dr.id::varchar = $1 OR dr.run_id = $1
        ORDER BY p.name, pv.name
      `;

      const runSql = `
        SELECT dr.*,
               COALESCE(dr.warehouse_id, w.warehouse_id) AS resolved_warehouse_id,
               COALESCE(w.name, b.branch_name) AS warehouse_name,
               dp.full_name AS delivery_partner_name
        FROM delivery_runs dr
        LEFT JOIN branches b ON b.branch_id = dr.branch_id
        LEFT JOIN warehouses w ON (
          w.warehouse_id = dr.warehouse_id
          OR (dr.warehouse_id IS NULL AND w.branch_id = dr.branch_id AND w.is_active = true)
        ) AND w.deleted_at IS NULL
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = dr.delivery_partner_id
        WHERE dr.id::varchar = $1 OR dr.run_id = $1
        LIMIT 1
      `;

      const [items, runRows] = await Promise.all([
        this.db.query(sql, [runId]),
        this.db.query(runSql, [runId]),
      ]);

      const run = runRows?.[0] ?? null;

      return {
        status: true,
        data: {
          run,
          items: (items || []).map((i: any) => ({
            ...i,
            loaded_qty: Number(i.loaded_qty),
            delivered_qty: Number(i.delivered_qty),
            returned_qty: Number(i.returned_qty),
            damaged_qty: Number(i.damaged_qty),
            returnable_qty: Number(i.returnable_qty),
          })),
        },
        message: 'Return preview fetched',
      };
    } catch (error) {
      this.developer.error('getRunReturnPreview error', { error });
      throw new InternalServerErrorException('Failed to fetch return preview');
    }
  }

  // ────────────────────────────────────────────────
  // Historical dispatch items with filters
  // ────────────────────────────────────────────────
  async getDispatchHistoryItems(query: any) {
    try {
      const { date_from, date_to, warehouse_id, delivery_slot, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = ['ddi.deleted_at IS NULL'];

      if (date_from) { params.push(date_from); where.push(`dr.run_date >= $${params.length}`); }
      if (date_to) { params.push(date_to); where.push(`dr.run_date <= $${params.length}`); }
      if (warehouse_id) { params.push(warehouse_id); where.push(`ddi.warehouse_id = $${params.length}`); }
      if (delivery_slot) { params.push(delivery_slot); where.push(`dr.delivery_slot = $${params.length}`); }

      const sql = `
        SELECT
          ddi.id,
          ddi.dispatch_id,
          ddi.delivery_run_id,
          dr.run_id,
          dr.run_number,
          dr.run_date,
          dr.delivery_slot,
          dr.status AS run_status,
          ddi.warehouse_id,
          w.name AS warehouse_name,
          ddi.product_variant_id,
          p.name AS product_name,
          pv.name AS variant_name,
          ddi.planned_qty,
          ddi.loaded_qty,
          COALESCE(ddi.delivered_qty, 0) AS delivered_qty,
          COALESCE(ddi.returned_qty, 0) AS returned_qty,
          COALESCE(ddi.damaged_qty, 0) AS damaged_qty,
          dp.full_name AS delivery_partner_name,
          ddi.created_at
        FROM delivery_dispatch_items ddi
        JOIN delivery_runs dr ON (
          dr.run_id::varchar = ddi.delivery_run_id
          OR dr.id::varchar = ddi.delivery_run_id
        )
        LEFT JOIN warehouses w ON w.warehouse_id = ddi.warehouse_id
        LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = dr.delivery_partner_id
        WHERE ${where.join(' AND ')}
        ORDER BY dr.run_date DESC, dr.delivery_slot, p.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM delivery_dispatch_items ddi
        JOIN delivery_runs dr ON (
          dr.run_id::varchar = ddi.delivery_run_id
          OR dr.id::varchar = ddi.delivery_run_id
        )
        WHERE ${where.join(' AND ')}
      `;

      const [rows, countRows] = await Promise.all([
        this.db.query(sql, params),
        this.db.query(countSql, params.slice(0, -2)),
      ]);

      return {
        status: true,
        data: rows || [],
        total: Number(countRows?.[0]?.total ?? 0),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        message: 'Dispatch history items fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchHistoryItems error', { error });
      throw new InternalServerErrorException('Failed to fetch dispatch history items');
    }
  }

  // ────────────────────────────────────────────────
  // Historical dispatch grouped by delivery partner
  // ────────────────────────────────────────────────
  async getDispatchHistoryPartners(query: any) {
    try {
      const { date_from, date_to, warehouse_id, delivery_slot, partner_id, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = ['ddi.deleted_at IS NULL'];

      if (date_from) { params.push(date_from); where.push(`dr.run_date >= $${params.length}`); }
      if (date_to) { params.push(date_to); where.push(`dr.run_date <= $${params.length}`); }
      if (warehouse_id) { params.push(warehouse_id); where.push(`ddi.warehouse_id = $${params.length}`); }
      if (delivery_slot) { params.push(delivery_slot); where.push(`dr.delivery_slot = $${params.length}`); }
      if (partner_id) { params.push(partner_id); where.push(`dr.delivery_partner_id = $${params.length}`); }

      const sql = `
        SELECT
          dr.delivery_partner_id,
          dp.full_name AS delivery_partner_name,
          dp.phone AS delivery_partner_phone,
          ddi.dispatch_id,
          dr.run_id,
          dr.run_number,
          dr.run_date,
          dr.delivery_slot,
          dr.status AS run_status,
          ddi.warehouse_id,
          w.name AS warehouse_name,
          COUNT(ddi.id)::int AS items_count,
          COALESCE(SUM(ddi.loaded_qty), 0) AS total_qty,
          COALESCE(SUM(ddi.delivered_qty), 0) AS delivered_qty,
          COALESCE(SUM(ddi.returned_qty), 0) AS returned_qty,
          ddi.dispatch_id AS dispatch_status_ref
        FROM delivery_dispatch_items ddi
        JOIN delivery_runs dr ON (
          dr.run_id::varchar = ddi.delivery_run_id
          OR dr.id::varchar = ddi.delivery_run_id
        )
        LEFT JOIN warehouses w ON w.warehouse_id = ddi.warehouse_id
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = dr.delivery_partner_id
        WHERE ${where.join(' AND ')}
        GROUP BY
          dr.delivery_partner_id, dp.full_name, dp.phone,
          ddi.dispatch_id, dr.run_id, dr.run_number,
          dr.run_date, dr.delivery_slot, dr.status,
          ddi.warehouse_id, w.name
        ORDER BY dr.run_date DESC, dp.full_name, dr.delivery_slot
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const countSql = `
        SELECT COUNT(DISTINCT ddi.dispatch_id)::int AS total
        FROM delivery_dispatch_items ddi
        JOIN delivery_runs dr ON (
          dr.run_id::varchar = ddi.delivery_run_id
          OR dr.id::varchar = ddi.delivery_run_id
        )
        WHERE ${where.join(' AND ')}
      `;

      const [rows, countRows] = await Promise.all([
        this.db.query(sql, params),
        this.db.query(countSql, params.slice(0, -2)),
      ]);

      return {
        status: true,
        data: rows || [],
        total: Number(countRows?.[0]?.total ?? 0),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        message: 'Dispatch history by partner fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchHistoryPartners error', { error });
      throw new InternalServerErrorException('Failed to fetch partner dispatch history');
    }
  }
}

