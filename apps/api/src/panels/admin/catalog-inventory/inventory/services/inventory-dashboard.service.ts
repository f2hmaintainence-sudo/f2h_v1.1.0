import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

function todayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

@Injectable()
export class InventoryDashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ────────────────────────────────────────────────
  // Full Dashboard Data
  // ────────────────────────────────────────────────
  async getDashboardData(warehouseId?: string) {
    try {
      const today = todayIST();

      const [
        warehouseSummary,
        branchSummary,
        lowStockAlerts,
        transferStatus,
        productionReqs,
        recentMovements,
      ] = await Promise.all([
        this.getWarehouseStockSummary(),
        this.getBranchStockSummary(),
        this.getLowStockAlerts(warehouseId),
        this.getTransferStatusSummary(),
        this.getProductionRequirements(today),
        this.getRecentStockMovements(warehouseId),
      ]);

      return {
        status: true,
        data: {
          warehouse_summary: warehouseSummary,
          branch_summary: branchSummary,
          low_stock_alerts: lowStockAlerts,
          transfer_status: transferStatus,
          production_requirements: productionReqs,
          recent_movements: recentMovements,
        },
      };
    } catch (error) {
      this.developer.error('getDashboardData error', { error });
      throw new InternalServerErrorException('Failed to retrieve dashboard data');
    }
  }

  // ────────────────────────────────────────────────
  // Warehouse-wise Stock Summary
  // ────────────────────────────────────────────────
  async getWarehouseStockSummary() {
    try {
      const sql = `
        SELECT
          w.warehouse_id, w.name AS warehouse_name, w.code,
          COUNT(DISTINCT sb.product_variant_id)::int AS total_variants,
          COALESCE(SUM(sb.available_quantity), 0)::numeric AS total_available,
          COALESCE(SUM(sb.reserved_quantity), 0)::numeric AS total_reserved,
          COALESCE(SUM(sb.dispatched_quantity), 0)::numeric AS total_dispatched,
          COALESCE(SUM(sb.damaged_quantity), 0)::numeric AS total_damaged,
          COUNT(CASE WHEN sb.available_quantity <= 0 THEN 1 END)::int AS out_of_stock_count,
          COUNT(CASE WHEN sb.available_quantity > 0 AND sb.available_quantity <= sb.low_stock_threshold THEN 1 END)::int AS low_stock_count,
          COALESCE(SUM(sb.available_quantity * pv.price), 0)::numeric AS stock_value
        FROM warehouses w
        LEFT JOIN stock_balances sb ON sb.warehouse_id = w.warehouse_id
        LEFT JOIN product_variants pv ON pv.variant_id = sb.product_variant_id
        WHERE w.is_active = true AND w.deleted_at IS NULL
        GROUP BY w.warehouse_id, w.name, w.code
        ORDER BY w.name
      `;
      return await this.db.query(sql);
    } catch (error) {
      this.developer.error('getWarehouseStockSummary error', { error });
      return [];
    }
  }

  // ────────────────────────────────────────────────
  // Branch-wise Stock Summary
  // ────────────────────────────────────────────────
  async getBranchStockSummary() {
    try {
      const today = todayIST();
      const sql = `
        SELECT
          b.branch_id, b.branch_name,
          COALESCE(orders.total_ordered, 0)::int AS orders_today
        FROM branches b
        LEFT JOIN (
          SELECT branch_id, COUNT(*)::int AS total_ordered
          FROM orders WHERE scheduled_date = $1 AND status NOT IN ('cancelled', 'failed')
          GROUP BY branch_id
        ) orders ON orders.branch_id = b.branch_id
        WHERE b.is_active = true AND b.deleted_at IS NULL
        ORDER BY b.branch_name
      `;
      return await this.db.query(sql, [today]);
    } catch (error) {
      this.developer.error('getBranchStockSummary error', { error });
      return [];
    }
  }

  // ────────────────────────────────────────────────
  // Low Stock Alerts
  // ────────────────────────────────────────────────
  async getLowStockAlerts(warehouseId?: string) {
    try {
      const params: any[] = [];
      const warehouseFilter = warehouseId
        ? `AND sb.warehouse_id = $${params.push(warehouseId)}`
        : '';

      const sql = `
        SELECT
          sb.warehouse_id, w.name AS warehouse_name,
          sb.product_variant_id, pv.name AS variant_name,
          p.name AS product_name,
          sb.available_quantity,
          sb.low_stock_threshold,
          sb.is_out_of_stock
        FROM stock_balances sb
        JOIN product_variants pv ON pv.variant_id = sb.product_variant_id
        JOIN products p ON p.product_id = pv.product_id
        JOIN warehouses w ON w.warehouse_id = sb.warehouse_id
        WHERE sb.available_quantity <= sb.low_stock_threshold
        ${warehouseFilter}
        ORDER BY sb.available_quantity ASC
        LIMIT 50
      `;
      return await this.db.query(sql, params);
    } catch (error) {
      this.developer.error('getLowStockAlerts error', { error });
      return [];
    }
  }

  // ────────────────────────────────────────────────
  // Transfer Status Summary
  // ────────────────────────────────────────────────
  async getTransferStatusSummary() {
    try {
      const sql = `
        SELECT
          transfer_status AS status,
          COUNT(*)::int AS count,
          COALESCE(SUM(quantity), 0)::numeric AS total_qty
        FROM stock_transfers
        WHERE deleted_at IS NULL
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY transfer_status
        ORDER BY
          CASE transfer_status
            WHEN 'pending' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'dispatched' THEN 3
            WHEN 'partially_received' THEN 4
            WHEN 'completed' THEN 5
            WHEN 'cancelled' THEN 6
          END
      `;
      return await this.db.query(sql);
    } catch (error) {
      this.developer.error('getTransferStatusSummary error', { error });
      return [];
    }
  }

  // ────────────────────────────────────────────────
  // Production Requirements
  // ────────────────────────────────────────────────
  async getProductionRequirements(date?: string) {
    try {
      const targetDate = date || todayIST();
      const sql = `
        SELECT
          ob.batch_id, ob.branch_id, ob.production_date, ob.slot,
          ob.status, ob.total_quantity,
          ob.prepared_quantity,
          b.branch_name
        FROM order_batches ob
        LEFT JOIN branches b ON b.branch_id = ob.branch_id
        WHERE ob.production_date = $1
        ORDER BY ob.branch_id, ob.slot
      `;
      return await this.db.query(sql, [targetDate]);
    } catch (error) {
      this.developer.error('getProductionRequirements error', { error });
      return [];
    }
  }

  // ────────────────────────────────────────────────
  // Delivery Dispatch Summary
  // ────────────────────────────────────────────────
  async getDeliveryDispatchSummary(date?: string) {
    try {
      const targetDate = date || todayIST();
      const sql = `
        SELECT
          ddi.warehouse_id, w.name AS warehouse_name,
          COUNT(DISTINCT ddi.delivery_run_id)::int AS runs_dispatched,
          COUNT(DISTINCT ddi.product_variant_id)::int AS unique_products,
          COALESCE(SUM(ddi.planned_qty), 0)::numeric AS total_planned,
          COALESCE(SUM(ddi.loaded_qty), 0)::numeric AS total_loaded,
          COALESCE(SUM(ddi.delivered_qty), 0)::numeric AS total_delivered,
          COALESCE(SUM(ddi.returned_qty), 0)::numeric AS total_returned,
          COALESCE(SUM(ddi.damaged_qty), 0)::numeric AS total_damaged
        FROM delivery_dispatch_items ddi
        JOIN delivery_runs dr ON dr.run_id::varchar = ddi.delivery_run_id
        LEFT JOIN warehouses w ON w.warehouse_id = ddi.warehouse_id
        WHERE dr.run_date = $1
        GROUP BY ddi.warehouse_id, w.name
        ORDER BY w.name
      `;
      return await this.db.query(sql, [targetDate]);
    } catch (error) {
      this.developer.error('getDeliveryDispatchSummary error', { error });
      return [];
    }
  }

  // ────────────────────────────────────────────────
  // Recent Stock Movements
  // ────────────────────────────────────────────────
  async getRecentStockMovements(warehouseId?: string) {
    try {
      const params: any[] = [];
      const warehouseFilter = warehouseId
        ? `AND sm.warehouse_id = $${params.push(warehouseId)}`
        : '';

      const sql = `
        SELECT
          sm.movement_id, sm.movement_type, sm.direction,
          sm.quantity, sm.quantity_before, sm.quantity_after,
          sm.reference_type, sm.reference_id,
          sm.created_at,
          w.name AS warehouse_name,
          pv.name AS variant_name,
          p.name AS product_name
        FROM stock_movements sm
        LEFT JOIN warehouses w ON w.warehouse_id = sm.warehouse_id
        LEFT JOIN product_variants pv ON pv.variant_id = sm.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        WHERE 1=1
        ${warehouseFilter}
        ORDER BY sm.created_at DESC
        LIMIT 20
      `;
      return await this.db.query(sql, params);
    } catch (error) {
      this.developer.error('getRecentStockMovements error', { error });
      return [];
    }
  }


  // ────────────────────────────────────────────────
  // Daily Inventory Reconciliation
  // ────────────────────────────────────────────────
  async getDailyReconciliation(date?: string, warehouseId?: string) {
    try {
      const targetDate = date || todayIST();
      const params: any[] = [targetDate];
      let warehouseFilter = '';

      if (warehouseId) {
        params.push(warehouseId);
        warehouseFilter = `AND sb.warehouse_id = $${params.length}`;
      }

      const sql = `
        SELECT
          sb.warehouse_id, w.name AS warehouse_name,
          sb.product_variant_id, pv.name AS variant_name,
          p.name AS product_name,
          sb.available_quantity AS current_stock,
          sb.reserved_quantity,
          sb.dispatched_quantity,
          sb.damaged_quantity,
          COALESCE(movements_in.total_in, 0)::numeric AS total_in_today,
          COALESCE(movements_out.total_out, 0)::numeric AS total_out_today,
          (sb.available_quantity
           - COALESCE(movements_in.total_in, 0)
           + COALESCE(movements_out.total_out, 0)
          )::numeric AS computed_opening_stock
        FROM stock_balances sb
        JOIN product_variants pv ON pv.variant_id = sb.product_variant_id
        JOIN products p ON p.product_id = pv.product_id
        JOIN warehouses w ON w.warehouse_id = sb.warehouse_id
        LEFT JOIN (
          SELECT warehouse_id, product_variant_id,
            SUM(quantity)::numeric AS total_in
          FROM stock_movements
          WHERE direction = 1 AND DATE(created_at) = $1 AND deleted_at IS NULL
          GROUP BY warehouse_id, product_variant_id
        ) movements_in ON movements_in.warehouse_id = sb.warehouse_id
          AND movements_in.product_variant_id = sb.product_variant_id
        LEFT JOIN (
          SELECT warehouse_id, product_variant_id,
            SUM(quantity)::numeric AS total_out
          FROM stock_movements
          WHERE direction = -1 AND DATE(created_at) = $1 AND deleted_at IS NULL
          GROUP BY warehouse_id, product_variant_id
        ) movements_out ON movements_out.warehouse_id = sb.warehouse_id
          AND movements_out.product_variant_id = sb.product_variant_id
        WHERE 1=1 ${warehouseFilter}
        ORDER BY w.name, p.name, pv.name
      `;

      const rows = await this.db.query(sql, params);

      return {
        status: true,
        data: rows,
        date: targetDate,
        message: 'Reconciliation data fetched',
      };
    } catch (error) {
      this.developer.error('getDailyReconciliation error', { error });
      throw new InternalServerErrorException('Failed to retrieve reconciliation data');
    }
  }
}
