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
