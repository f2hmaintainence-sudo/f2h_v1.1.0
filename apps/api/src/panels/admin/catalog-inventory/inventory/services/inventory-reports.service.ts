import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { StockMovementCoreService } from './stock-movement-core.service';

function todayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

@Injectable()
export class InventoryReportsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly stockCore: StockMovementCoreService,
  ) { }

  // ────────────────────────────────────────────────
  // Consumption Forecast
  // ────────────────────────────────────────────────
  async getConsumptionForecast(query: any) {
    try {
      const { branch_id, days = 7, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [parseInt(days, 10)];
      const where: string[] = [];

      if (branch_id) {
        params.push(branch_id);
        where.push(`cf.branch_id = $${params.length}`);
      }

      where.push(`cf.forecast_date >= CURRENT_DATE`);
      where.push(`cf.forecast_date <= CURRENT_DATE + ($1 || ' days')::interval`);

      const sql = `
        SELECT
          cf.id, cf.variant_id, cf.branch_id, cf.forecast_date,
          cf.predicted_quantity, cf.subscription_qty, cf.onetime_qty,
          cf.buffer_qty, cf.confidence_pct, cf.actual_quantity,
          pv.name AS variant_name, pv.sku,
          p.name AS product_name,
          b.branch_name,
          COALESCE(sb.available_quantity, 0)::int AS current_stock,
          GREATEST(cf.predicted_quantity - COALESCE(sb.available_quantity, 0), 0)::int AS shortfall
        FROM consumption_forecasts cf
        LEFT JOIN product_variants pv ON pv.variant_id = cf.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN branches b ON b.branch_id = cf.branch_id
        LEFT JOIN stock_balances sb ON sb.product_variant_id = cf.variant_id
        WHERE ${where.join(' AND ')}
        ORDER BY cf.forecast_date ASC, cf.predicted_quantity DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      return { status: true, data: rows, message: 'Consumption forecast fetched' };
    } catch (error) {
      this.developer.error('getConsumptionForecast error', { error });
      throw new InternalServerErrorException('Failed to retrieve consumption forecast');
    }
  }

  // ────────────────────────────────────────────────
  // Compute / Refresh Consumption Forecast
  // ────────────────────────────────────────────────
  async computeForecast(branchId?: string, days: number = 7) {
    try {
      const variantsSql = `
        SELECT DISTINCT
          pv.variant_id,
          pv.product_id,
          o.branch_id,
          COALESCE(
            ROUND(COUNT(oi.id)::numeric * AVG(oi.quantity)::numeric / 30, 0),
            0
          )::int AS avg_daily,
          COALESCE(
            -- Daily rate = weekly scheduled quantity / 7; subscription_items no
            -- longer carries a quantity of its own.
            (SELECT ROUND(SUM(ws.m_quantity + ws.e_quantity)::numeric / 7, 0)
             FROM subscription_items si
             JOIN subscriptions s ON s.subscription_id = si.subscription_id
             JOIN subscription_weekly_schedule ws
               ON ws.subscription_item_id = si.subscription_item_id AND ws.deleted_at IS NULL
             WHERE si.product_variant_id = pv.variant_id
               AND si.deleted_at IS NULL
               AND si.status = 'active'
               AND s.status = 'active'
               ${branchId ? 'AND s.branch_id = $2' : ''}),
            0
          )::int AS subscription_daily
        FROM product_variants pv
        JOIN order_items oi ON oi.variant_id = pv.variant_id
        JOIN orders o ON o.order_id = oi.order_id
          AND o.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
          AND o.status = 'delivered'
          ${branchId ? 'AND o.branch_id = $2' : ''}
        WHERE pv.deleted_at IS NULL
        GROUP BY pv.variant_id, pv.product_id, o.branch_id
      `;

      const vParams: any[] = branchId ? [30, branchId] : [30];
      let variants;
      try {
        variants = await this.db.query(variantsSql, vParams);
      } catch {
        variants = [];
      }

      let inserted = 0;
      for (const v of variants) {
        const bufferQty = Math.ceil((v.avg_daily + v.subscription_daily) * 0.15);
        const predictedQty = v.avg_daily + v.subscription_daily + bufferQty;

        for (let d = 0; d < days; d++) {
          try {
            await this.db.query(
              `INSERT INTO consumption_forecasts
                (variant_id, branch_id, forecast_date, predicted_quantity,
                 subscription_qty, onetime_qty, buffer_qty, confidence_pct)
              VALUES ($1, $2, CURRENT_DATE + $3, $4, $5, $6, $7, $8)
              ON CONFLICT (variant_id, branch_id, forecast_date) DO UPDATE SET
                predicted_quantity = EXCLUDED.predicted_quantity,
                subscription_qty = EXCLUDED.subscription_qty,
                onetime_qty = EXCLUDED.onetime_qty,
                buffer_qty = EXCLUDED.buffer_qty,
                confidence_pct = EXCLUDED.confidence_pct,
                computed_at = NOW()`,
              [
                v.variant_id, v.branch_id, d,
                predictedQty, v.subscription_daily, v.avg_daily,
                bufferQty, Math.min(95, 60 + (d === 0 ? 30 : 30 - d * 3)),
              ],
            );
            inserted++;
          } catch {
            // Skip constraint errors
          }
        }
      }

      return {
        status: true,
        data: { variants_processed: variants.length, forecasts_upserted: inserted },
        message: `Forecast computed for ${variants.length} variants`,
      };
    } catch (error) {
      this.developer.error('computeForecast error', { error });
      throw new InternalServerErrorException('Failed to compute forecast');
    }
  }

  // ────────────────────────────────────────────────
  // Stock Adjustments History
  // ────────────────────────────────────────────────
  async getStockAdjustments(query: any) {
    try {
      const { warehouse_id, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = ["sm.movement_type = 'stock_adjustment'"];

      if (warehouse_id) {
        params.push(warehouse_id);
        where.push(`sm.warehouse_id = $${params.length}`);
      }

      where.push('sm.deleted_at IS NULL');

      const sql = `
        SELECT
          sm.*,
          pv.name AS variant_name, pv.sku,
          p.name AS product_name,
          w.name AS warehouse_name
        FROM stock_movements sm
        LEFT JOIN product_variants pv ON pv.variant_id = sm.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN warehouses w ON w.warehouse_id = sm.warehouse_id
        WHERE ${where.join(' AND ')}
        ORDER BY sm.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);
      return { status: true, data: rows, message: 'Stock adjustments fetched' };
    } catch (error) {
      this.developer.error('getStockAdjustments error', { error });
      throw new InternalServerErrorException('Failed to retrieve stock adjustments');
    }
  }

  // ────────────────────────────────────────────────
  // Inventory Report Export
  // ────────────────────────────────────────────────
  async getInventoryReport(query: any) {
    try {
      const { warehouse_id, category_id, stock_status } = query;
      const params: any[] = [];
      const where: string[] = ['pv.deleted_at IS NULL'];

      if (warehouse_id) {
        params.push(warehouse_id);
        where.push(`sb.warehouse_id = $${params.length}`);
      }
      if (category_id) {
        params.push(category_id);
        where.push(`p.category_id = $${params.length}`);
      }

      let stockFilter = '';
      if (stock_status === 'low') stockFilter = 'AND COALESCE(sb.available_quantity, 0) <= sb.low_stock_threshold AND COALESCE(sb.available_quantity, 0) > 0';
      else if (stock_status === 'out') stockFilter = 'AND COALESCE(sb.available_quantity, 0) <= 0';
      else if (stock_status === 'in') stockFilter = 'AND COALESCE(sb.available_quantity, 0) > sb.low_stock_threshold';

      const sql = `
        SELECT
          pv.variant_id, pv.name AS variant_name, pv.sku,
          pv.price,
          p.name AS product_name,
          c.name AS category_name,
          COALESCE(sb.available_quantity, 0)::numeric AS current_stock,
          COALESCE(sb.reserved_quantity, 0)::numeric AS reserved_stock,
          COALESCE(sb.dispatched_quantity, 0)::numeric AS dispatched_stock,
          COALESCE(sb.available_quantity * pv.price, 0)::numeric AS stock_value,
          w.name AS warehouse_name,
          sb.low_stock_threshold AS reorder_level,
          CASE
            WHEN COALESCE(sb.available_quantity, 0) <= 0 THEN 'out_of_stock'
            WHEN COALESCE(sb.available_quantity, 0) <= sb.low_stock_threshold THEN 'low_stock'
            ELSE 'in_stock'
          END AS stock_status
        FROM product_variants pv
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN categories c ON c.id::varchar = p.category_id
        LEFT JOIN stock_balances sb ON sb.product_variant_id = pv.variant_id
        LEFT JOIN warehouses w ON w.warehouse_id = sb.warehouse_id
        WHERE ${where.join(' AND ')} ${stockFilter}
        ORDER BY p.name ASC, pv.name ASC
      `;

      const rows = await this.db.query(sql, params);

      const totals = rows.reduce((acc: any, r: any) => {
        acc.total_items++;
        acc.total_stock += Number(r.current_stock || 0);
        acc.total_value += Number(r.stock_value || 0);
        if (r.stock_status === 'out_of_stock') acc.out_of_stock++;
        else if (r.stock_status === 'low_stock') acc.low_stock++;
        return acc;
      }, { total_items: 0, total_stock: 0, total_value: 0, out_of_stock: 0, low_stock: 0 });

      return {
        status: true,
        data: rows,
        totals,
        message: 'Inventory report fetched',
      };
    } catch (error) {
      this.developer.error('getInventoryReport error', { error });
      throw new InternalServerErrorException('Failed to retrieve inventory report');
    }
  }

  // ────────────────────────────────────────────────
  // Purchase Entries
  // ────────────────────────────────────────────────
  async getPurchaseEntries(query: any) {
    try {
      const { warehouse_id, vendor_id, status, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = [];

      if (warehouse_id) { params.push(warehouse_id); where.push(`pe.warehouse_id = $${params.length}`); }
      if (vendor_id) { params.push(vendor_id); where.push(`pe.vendor_id = $${params.length}`); }
      if (status) { params.push(status); where.push(`pe.status = $${params.length}`); }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          pe.*,
          pv.name AS variant_name, pv.sku,
          p.name AS product_name,
          w.name AS warehouse_name
        FROM purchase_entries pe
        LEFT JOIN product_variants pv ON pv.variant_id = pe.variant_id
        LEFT JOIN products p ON p.product_id = pe.product_id
        LEFT JOIN warehouses w ON w.id = pe.warehouse_id
        ${whereClause}
        ORDER BY pe.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);
      return { status: true, data: rows, message: 'Purchase entries fetched' };
    } catch (error) {
      this.developer.error('getPurchaseEntries error', { error });
      throw new InternalServerErrorException('Failed to retrieve purchase entries');
    }
  }

  async createPurchaseEntry(body: any, adminId: string) {
    try {
      const purchaseNumber = `PUR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const totalCost = (body.quantity || 0) * (body.unit_cost || 0);

      return await this.db.transaction(async (client) => {
        // Insert purchase entry
        const sql = `
          INSERT INTO purchase_entries
            (purchase_number, vendor_id, warehouse_id, variant_id, product_id,
             quantity, unit_cost, total_cost, batch_number, manufacturing_date,
             expiry_date, received_by, status, quality_notes, invoice_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `;
        const result = await client.query(sql, [
          purchaseNumber, body.vendor_id, body.warehouse_id, body.variant_id,
          body.product_id, body.quantity, body.unit_cost, totalCost,
          body.batch_number, body.manufacturing_date, body.expiry_date,
          adminId, body.status || 'received', body.quality_notes, body.invoice_number,
        ]);

        const entry = result.rows[0];

        // Create proper stock movement (IN) if not rejected
        if (body.status !== 'rejected' && body.warehouse_id) {
          await this.stockCore.recordStockMovement(client, {
            warehouse_id: String(body.warehouse_id),
            product_variant_id: body.variant_id,
            movement_type: 'purchase',
            direction: 1,
            quantity: Number(body.quantity),
            batch_id: body.batch_number,
            unit_cost: Number(body.unit_cost || 0),
            reference_type: 'purchase',
            reference_id: purchaseNumber,
            notes: `Purchase ${purchaseNumber}`,
            created_by: adminId,
          });
        }

        return { status: true, data: entry, message: 'Purchase entry created with stock updated' };
      });
    } catch (error) {
      this.developer.error('createPurchaseEntry error', { error });
      throw new InternalServerErrorException('Failed to create purchase entry');
    }
  }
}
