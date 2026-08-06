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
        `SELECT * FROM delivery_runs WHERE id = $1`,
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
        await client.query(
          `UPDATE dispatch_balances 
           SET dispatched_qty = 0,
               balance_qty = - delivered_qty - returned_qty - damaged_qty,
               updated_at = NOW()
           WHERE delivery_partner_id = $1 AND run_date = $2 AND delivery_slot = $3`,
          [run.delivery_partner_id, run.run_date, run.delivery_slot],
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

          // 3a. Record to dispatch_balances
          await client.query(
            `INSERT INTO dispatch_balances (
              delivery_partner_id, product_variant_id, run_date, delivery_slot,
              dispatched_qty, balance_qty, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $5, NOW(), NOW())
            ON CONFLICT (delivery_partner_id, product_variant_id, run_date, delivery_slot) DO UPDATE SET
              dispatched_qty = EXCLUDED.dispatched_qty,
              balance_qty = EXCLUDED.dispatched_qty - dispatch_balances.delivered_qty - dispatch_balances.returned_qty - dispatch_balances.damaged_qty,
              updated_at = NOW()`,
            [
              run.delivery_partner_id,
              item.product_variant_id,
              run.run_date,
              run.delivery_slot,
              loadedQty
            ]
          );

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
        `SELECT * FROM delivery_runs WHERE id = $1`,
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

          // 2a. Update dispatch_balances
          await client.query(
            `UPDATE dispatch_balances SET
              delivered_qty = $5,
              returned_qty = $6,
              damaged_qty = $7,
              balance_qty = dispatched_qty - $5 - $6 - $7,
              updated_at = NOW()
            WHERE delivery_partner_id = $1
              AND product_variant_id = $2
              AND run_date = $3
              AND delivery_slot = $4`,
            [
              run.delivery_partner_id,
              item.product_variant_id,
              run.run_date,
              run.delivery_slot,
              item.delivered_qty,
              item.returned_qty,
              item.damaged_qty
            ]
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
      let rows = await this.db.query(sql, [runId]);
      if (rows.length === 0) {
        const fallbackSql = `
          SELECT
            drq.id,
            drq.run_id AS delivery_run_id,
            drq.product_variant_id,
            drq.required_quantity AS planned_qty,
            0::numeric AS loaded_qty,
            0::numeric AS delivered_qty,
            0::numeric AS returned_qty,
            0::numeric AS damaged_qty,
            0::numeric AS extra_sold_qty,
            drq.unit,
            NULL AS remarks,
            drq.created_at,
            drq.updated_at,
            pv.name AS variant_name, pv.sku,
            pv.unit_value,
            pv.unit_type,
            p.name AS product_name,
            NULL AS warehouse_name,
            0::numeric AS warehouse_stock
          FROM dispatch_requirements drq
          LEFT JOIN product_variants pv ON pv.variant_id = drq.product_variant_id
          LEFT JOIN products p ON p.product_id = pv.product_id
          JOIN delivery_runs dr ON dr.run_id = drq.run_id
          WHERE dr.id::varchar = $1 OR dr.run_id = $1
          ORDER BY p.name, pv.name
        `;
        rows = await this.db.query(fallbackSql, [runId]);
      }

      return { status: true, data: rows, message: 'Run dispatch items fetched' };
    } catch (error) {
      this.developer.error('getRunDispatchItems error', { error });
      throw new InternalServerErrorException('Failed to retrieve run dispatch items');
    }
  }

  async getRequirementDates() {
    try {
      const sql = `
        SELECT DISTINCT run_date::varchar
        FROM dispatch_requirements
        ORDER BY run_date::varchar DESC
        LIMIT 30
      `;
      const rows = await this.db.query(sql);
      const dates = rows.map(r => r.run_date);
      return { status: true, data: dates, message: 'Requirement dates fetched' };
    } catch (error) {
      this.developer.error('getRequirementDates error', { error });
      throw new InternalServerErrorException('Failed to fetch requirement dates');
    }
  }

  async getAvailableVariants() {
    try {
      const sql = `
        SELECT
          pv.variant_id as product_variant_id,
          p.name as product_name,
          pv.name as variant_name,
          pv.unit_value,
          pv.unit_type
        FROM product_variants pv
        JOIN products p ON p.product_id = pv.product_id
        WHERE pv.status = 'active'
          AND pv.deleted_at IS NULL
          AND p.deleted_at IS NULL
        ORDER BY p.name, pv.name
      `;
      const rows = await this.db.query(sql);
      return { status: true, data: rows, message: 'Available variants fetched' };
    } catch (error) {
      this.developer.error('getAvailableVariants error', { error });
      throw new InternalServerErrorException('Failed to fetch available variants');
    }
  }
}

