import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import * as crypto from 'crypto';

function todayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function tomorrowIST(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function parseOrderIds(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
      return [];
    } catch {
      return [];
    }
  }
  if (typeof val === 'object') {
    try {
      const parsed = JSON.parse(JSON.stringify(val));
      if (Array.isArray(parsed)) return parsed.map(String);
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

function convertToBaseUnit(orderedQty: number, unitValue: number, unitType: string): { value: number; unit: string } {
  const type = (unitType || 'pcs').toLowerCase();
  const val = Number(unitValue || 1);
  const qty = Number(orderedQty || 0);

  if (type === 'gm' || type === 'gram' || type === 'grams') {
    return { value: (val * qty) / 1000, unit: 'kg' };
  }
  if (type === 'kg' || type === 'kilogram' || type === 'kilograms') {
    return { value: val * qty, unit: 'kg' };
  }
  if (type === 'ml' || type === 'milliliter' || type === 'milliliters') {
    return { value: (val * qty) / 1000, unit: 'ltr' };
  }
  if (type === 'ltr' || type === 'liter' || type === 'liters') {
    return { value: val * qty, unit: 'ltr' };
  }
  if (type === 'piece' || type === 'pieces' || type === 'pcs') {
    return { value: val * qty, unit: 'pcs' };
  }
  if (type === 'packet' || type === 'packets') {
    return { value: val * qty, unit: 'packet' };
  }
  // pcs / packet / etc.
  return { value: qty, unit: 'pcs' };
}

@Injectable()
export class BatchProductionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ────────────────────────────────────────────────
  // Generate Order Batches from confirmed orders
  // Groups by: Branch + Production Date + Slot + Product
  // Only for products with batch_product = true
  // ────────────────────────────────────────────────
  async generateOrderBatches(date?: string, branchId?: string, slot?: string) {
    try {

      const resolvedDate = date === 'tomorrow' ? tomorrowIST() : (date === 'today' ? todayIST() : (date || todayIST()));
      const params: any[] = [resolvedDate];
      let branchFilter = '';
      let slotFilter = '';

      if (branchId) {
        params.push(branchId);
        branchFilter = `AND o.branch_id = $${params.length}`;
      }

      if (slot) {
        params.push(slot);
        slotFilter = `AND o.delivery_slot = $${params.length}`;
      }

      // 1. Fetch existing batches for the resolvedDate to prevent duplicate order generation
      const existingBatchesRows = await this.db.query(
        `SELECT batch_id, branch_id, slot, product_id, order_ids, total_quantity, total_orders, unit
         FROM order_batches
         WHERE production_date = $1`,
        [resolvedDate],
      );

      // Key by branch_id | slot | product_id
      const existingBatchesMap = new Map<string, any>();
      for (const b of existingBatchesRows) {
        const key = `${b.branch_id}|${b.slot}|${b.product_id}`;
        existingBatchesMap.set(key, b);
      }

      // 2. Query demand: confirmed/placed orders with batch products (only where p.batch_product = true)
      // Retrieve individual items to calculate conversions and filter duplicate orders/items
      const demandSql = `
        SELECT
          o.order_id,
          o.branch_id,
          o.delivery_slot AS slot,
          oi.id AS order_item_id,
          oi.quantity AS ordered_qty,
          pv.unit_value,
          pv.unit_type,
          p.product_id,
          p.name AS product_name
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        JOIN product_variants pv ON pv.variant_id = oi.variant_id
        JOIN products p ON p.product_id = pv.product_id
        WHERE o.scheduled_date = $1
          AND o.status IN ('confirmed', 'placed')
          AND p.batch_product = true
          ${branchFilter}
          ${slotFilter}
        ORDER BY o.branch_id, o.delivery_slot, p.product_id, o.order_id
      `;

      const demandRows = await this.db.query(demandSql, params);

      if (demandRows.length === 0) {
        return {
          status: true,
          data: { batches_created: 0, batches_updated: 0 },
          message: 'No batch product demand found for this date/slot',
        };
      }

      // Group demand items by branch_id | slot | product_id
      const groupedDemand = new Map<string, any[]>();
      for (const row of demandRows) {
        const key = `${row.branch_id}|${row.slot}|${row.product_id}`;
        if (!groupedDemand.has(key)) {
          groupedDemand.set(key, []);
        }
        groupedDemand.get(key)!.push(row);
      }

      let batchesCreated = 0;
      let batchesUpdated = 0;

      for (const [key, items] of groupedDemand.entries()) {
        const [branch_id, rowSlot, product_id] = key.split('|');
        const existingBatch = existingBatchesMap.get(key);

        const existingOrderIds = new Set<string>(
          existingBatch ? parseOrderIds(existingBatch.order_ids) : []
        );

        // Filter and calculate totals only for new orders/items
        const uniqueNewOrderIds = new Set<string>();
        let addedQuantity = 0;
        let baseUnit = 'pcs';

        for (const item of items) {
          // If order_id is already included in this batch, ignore it (avoid duplicate logic)
          if (existingOrderIds.has(item.order_id)) {
            continue;
          }
          const converted = convertToBaseUnit(item.ordered_qty, item.unit_value, item.unit_type);
          addedQuantity += converted.value;
          baseUnit = converted.unit;
          uniqueNewOrderIds.add(item.order_id);
        }

        // If no new order items to generate/add, skip
        if (uniqueNewOrderIds.size === 0) {
          continue;
        }

        const mergedOrderIds = [...Array.from(existingOrderIds), ...Array.from(uniqueNewOrderIds)];

        if (existingBatch) {
          // Update existing batch: increment total_orders and total_quantity only for newly added orders
          // Never touch prepared_quantity, status or notes
          await this.db.query(
            `UPDATE order_batches
             SET
               total_quantity = total_quantity + $2,
               total_orders = COALESCE(total_orders, 0) + $3,
               order_ids = $4,
               unit = $5,
               updated_at = NOW()
             WHERE batch_id = $1`,
            [
              existingBatch.batch_id,
              addedQuantity,
              uniqueNewOrderIds.size,
              JSON.stringify(mergedOrderIds),
              baseUnit
            ],
          );
          batchesUpdated++;
        } else {
          // Generate deterministic 30-char batch_id
          const hashInput = `${branch_id}|${resolvedDate}|${rowSlot}|${product_id}`;
          const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 24);
          const batchId = `BATCH-${hash}`;

          // Create new batch: initial status = 'pending'
          await this.db.query(
            `INSERT INTO order_batches
              (batch_id, branch_id, production_date, slot, product_id,
               status, total_quantity, total_orders, order_ids, unit,
               created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, 'system', NOW(), NOW())`,
            [
              batchId,
              branch_id,
              resolvedDate,
              rowSlot,
              product_id,
              addedQuantity,
              uniqueNewOrderIds.size,
              JSON.stringify(mergedOrderIds),
              baseUnit
            ],
          );
          batchesCreated++;
        }
      }

      return {
        status: true,
        data: { batches_created: batchesCreated, batches_updated: batchesUpdated },
        message: `Generated ${batchesCreated} new batches, updated ${batchesUpdated} existing`,
      };
    } catch (error) {
      this.developer.error('generateOrderBatches error', { error });
      throw new InternalServerErrorException('Failed to generate order batches');
    }
  }

  // ────────────────────────────────────────────────
  // Dashboard Summary
  // ────────────────────────────────────────────────
  async getDashboardSummary(date?: string) {
    try {
      const today = todayIST();
      const tomorrow = tomorrowIST();

      const sql = `
        SELECT
          COUNT(*) FILTER (WHERE production_date = $1)::int AS today,
          COUNT(*) FILTER (WHERE production_date = $2)::int AS tomorrow,
          COUNT(*) FILTER (WHERE production_date < $1 AND status != 'prepared')::int AS past_due,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
          COUNT(*) FILTER (WHERE status = 'prepared')::int AS prepared
        FROM order_batches
      `;
      const rows = await this.db.query(sql, [today, tomorrow]);

      return {
        status: true,
        data: rows[0] || { today: 0, tomorrow: 0, past_due: 0, pending: 0, processing: 0, prepared: 0 },
      };
    } catch (error) {
      this.developer.error('getDashboardSummary error', { error });
      throw new InternalServerErrorException('Failed to fetch dashboard summary');
    }
  }

  // ────────────────────────────────────────────────
  // Get Order Batches Table
  // ────────────────────────────────────────────────
  async getOrderBatchesTable(query: any) {
    try {
      const { branch_id, date, date_filter, status, slot, search, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = [];
      const today = todayIST();
      const tomorrow = tomorrowIST();

      if (branch_id) { params.push(branch_id); where.push(`ob.branch_id = $${params.length}`); }
      if (status) { params.push(status); where.push(`ob.status = $${params.length}`); }
      if (slot) { params.push(slot); where.push(`ob.slot = $${params.length}`); }

      // Date filter: 'today', 'tomorrow', 'past', or custom date
      if (date_filter === 'today') {
        params.push(today); where.push(`ob.production_date = $${params.length}`);
      } else if (date_filter === 'tomorrow') {
        params.push(tomorrow); where.push(`ob.production_date = $${params.length}`);
      } else if (date_filter === 'past') {
        params.push(today); where.push(`ob.production_date < $${params.length}`);
      } else if (date) {
        params.push(date); where.push(`ob.production_date = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        where.push(`p.name ILIKE $${params.length}`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          ob.batch_id,
          ob.branch_id,
          ob.production_date,
          ob.slot,
          ob.product_id,
          ob.status,
          ob.total_quantity,
          ob.prepared_quantity,
          (ob.total_quantity - ob.prepared_quantity)::numeric AS remaining_quantity,
          ob.total_orders,
          ob.order_ids,
          ob.notes,
          ob.created_at,
          ob.updated_at,
          p.name AS product_name,
          b.branch_name
        FROM order_batches ob
        LEFT JOIN products p ON p.product_id = ob.product_id
        LEFT JOIN branches b ON b.branch_id = ob.branch_id
        ${whereClause}
        ORDER BY
          CASE ob.status
            WHEN 'pending' THEN 1
            WHEN 'processing' THEN 2
            WHEN 'prepared' THEN 3
          END ASC,
          ob.production_date DESC, ob.branch_id, ob.slot, p.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM order_batches ob
        LEFT JOIN products p ON p.product_id = ob.product_id
        ${whereClause}
      `;
      const countRows = await this.db.query(countSql, params.slice(0, -2));

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        message: 'Order batches fetched',
      };
    } catch (error) {
      this.developer.error('getOrderBatchesTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve order batches');
    }
  }

  // ────────────────────────────────────────────────
  // Update Batch Status
  // ────────────────────────────────────────────────
  async updateBatchStatus(batchId: string, status: string, adminId: string) {
    try {
      const validStatuses = ['pending', 'processing', 'prepared'];
      if (!validStatuses.includes(status)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      const updateFields: string[] = ['status = $2', 'updated_by = $3', 'updated_at = NOW()'];
      const params: any[] = [batchId, status, adminId];

      // When marked as prepared, auto-set prepared_quantity = total_quantity
      if (status === 'prepared') {
        updateFields.push('prepared_quantity = total_quantity');
      }

      await this.db.query(
        `UPDATE order_batches SET ${updateFields.join(', ')} WHERE batch_id = $1`,
        params,
      );

      return { status: true, message: `Batch status updated to ${status}` };
    } catch (error) {
      this.developer.error('updateBatchStatus error', { error });
      throw new InternalServerErrorException('Failed to update batch status');
    }
  }

  // ────────────────────────────────────────────────
  // Update Batch Quantity & Notes
  // ────────────────────────────────────────────────
  async updateBatchQuantity(batchId: string, body: any, adminId: string) {
    try {
      const { prepared_quantity, notes } = body;
      const updateFields: string[] = ['updated_by = $2', 'updated_at = NOW()'];
      const params: any[] = [batchId, adminId];

      if (prepared_quantity !== undefined) {
        params.push(prepared_quantity);
        updateFields.push(`prepared_quantity = $${params.length}`);
      }
      if (notes !== undefined) {
        params.push(notes);
        updateFields.push(`notes = $${params.length}`);
      }

      await this.db.query(
        `UPDATE order_batches SET ${updateFields.join(', ')} WHERE batch_id = $1`,
        params,
      );

      // Auto-advance to prepared if quantity met
      if (prepared_quantity !== undefined) {
        await this.db.query(
          `UPDATE order_batches
           SET status = 'prepared', updated_at = NOW()
           WHERE batch_id = $1 AND prepared_quantity >= total_quantity AND status != 'prepared'`,
          [batchId],
        );
      }

      return { status: true, message: 'Batch quantity updated' };
    } catch (error) {
      this.developer.error('updateBatchQuantity error', { error });
      throw new InternalServerErrorException('Failed to update batch quantity');
    }
  }

  // ────────────────────────────────────────────────
  // Create Manual Batch
  // ────────────────────────────────────────────────
  async createManualBatch(body: any, adminId: string) {
    try {
      const { branch_id, product_id, production_date, slot, total_quantity, notes } = body;

      if (!branch_id || !product_id || !production_date || !total_quantity) {
        return { status: false, message: 'branch_id, product_id, production_date and total_quantity are required' };
      }

      const slotLabel = (slot || 'all').substring(0, 3).toUpperCase();
      const branchPrefix = branch_id.substring(0, 8);
      const productPrefix = product_id.substring(0, 10);
      const batchId = `MAN-${branchPrefix}-${production_date.replace(/-/g, '')}-${slotLabel}-${productPrefix}`;

      await this.db.query(
        `INSERT INTO order_batches
          (batch_id, branch_id, production_date, slot, product_id,
           status, total_quantity, notes, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, NOW(), NOW())
        ON CONFLICT (batch_id) DO UPDATE SET
          total_quantity = order_batches.total_quantity + EXCLUDED.total_quantity,
          notes = COALESCE(EXCLUDED.notes, order_batches.notes),
          updated_at = NOW()`,
        [batchId, branch_id, production_date, slot || 'morning', product_id, total_quantity, notes || null, adminId],
      );

      return {
        status: true,
        data: { batch_id: batchId },
        message: 'Manual batch created successfully',
      };
    } catch (error) {
      this.developer.error('createManualBatch error', { error });
      throw new InternalServerErrorException('Failed to create manual batch');
    }
  }

  // ────────────────────────────────────────────────
  // Get batch products list (for manual batch dropdown)
  // ────────────────────────────────────────────────
  async getBatchProducts() {
    try {
      const rows = await this.db.query(
        `SELECT product_id, name FROM products WHERE batch_product = true AND is_active = true ORDER BY name`,
        [],
      );
      return { status: true, data: rows };
    } catch (error) {
      this.developer.error('getBatchProducts error', { error });
      throw new InternalServerErrorException('Failed to fetch batch products');
    }
  }
}
