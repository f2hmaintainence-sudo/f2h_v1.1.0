import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { StockMovementCoreService } from '../../inventory/services/stock-movement-core.service';

@Injectable()
export class WarehouseDispatchService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly stockCore: StockMovementCoreService,
  ) {}

  // ────────────────────────────────────────────────
  // Dispatch Plans
  // ────────────────────────────────────────────────
  async getDispatchPlans(query: any) {
    try {
      const { branch_id, warehouse_id, status, date, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = [];

      if (branch_id) { params.push(branch_id); where.push(`dp.target_branch_id = $${params.length}`); }
      if (warehouse_id) { params.push(warehouse_id); where.push(`dp.source_warehouse_id = $${params.length}`); }
      if (status) { params.push(status); where.push(`dp.status = $${params.length}`); }
      if (date) { params.push(date); where.push(`dp.dispatch_date = $${params.length}`); }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          dp.*,
          w.name AS warehouse_name,
          b.branch_name,
          (SELECT COUNT(*)::int FROM dispatch_plan_items dpi WHERE dpi.dispatch_plan_id = dp.dispatch_number) AS item_count
        FROM dispatch_plans dp
        LEFT JOIN warehouses w ON w.id = dp.source_warehouse_id
        LEFT JOIN branches b ON b.branch_id = dp.target_branch_id
        ${whereClause}
        ORDER BY dp.dispatch_date DESC, dp.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      const countSql = `SELECT COUNT(*)::int AS total FROM dispatch_plans dp ${whereClause}`;
      const countRows = await this.db.query(countSql, params.slice(0, -2));

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        message: 'Dispatch plans fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchPlans error', { error });
      throw new InternalServerErrorException('Failed to retrieve dispatch plans');
    }
  }

  async getDispatchPlanDetails(id: string) {
    try {
      const planSql = `
        SELECT dp.*, w.name AS warehouse_name, b.branch_name
        FROM dispatch_plans dp
        LEFT JOIN warehouses w ON w.id = dp.source_warehouse_id
        LEFT JOIN branches b ON b.branch_id = dp.target_branch_id
        WHERE dp.id = $1
      `;
      const planRows = await this.db.query(planSql, [id]);
      if (!planRows[0]) return { status: false, message: 'Plan not found' };

      const itemsSql = `
        SELECT
          dpi.*,
          pv.name AS variant_name, pv.sku,
          p.name AS product_name,
          COALESCE(sb.available_quantity, 0)::numeric AS warehouse_stock,
          COALESCE(sb.reserved_quantity, 0)::numeric AS reserved_stock
        FROM dispatch_plan_items dpi
        LEFT JOIN product_variants pv ON pv.variant_id = dpi.variant_id
        LEFT JOIN products p ON p.product_id = dpi.product_id
        LEFT JOIN stock_balances sb ON sb.product_variant_id = dpi.variant_id
          AND sb.warehouse_id = $2
        WHERE dpi.dispatch_plan_id = $1
        ORDER BY p.name ASC, pv.name ASC
      `;
      const items = await this.db.query(itemsSql, [
        planRows[0].dispatch_number,
        planRows[0].source_warehouse_id,
      ]);

      return {
        status: true,
        data: { plan: planRows[0], items },
        message: 'Dispatch plan details fetched',
      };
    } catch (error) {
      this.developer.error('getDispatchPlanDetails error', { error });
      throw new InternalServerErrorException('Failed to retrieve dispatch plan details');
    }
  }

  async createDispatchPlan(body: any, adminId: string) {
    try {
      const dispatchNumber = `DSP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const items = body.items || [];
      const totalQty = items.reduce((s: number, i: any) => s + (i.required_quantity || 0), 0);

      // Validate stock availability for each item
      if (body.source_warehouse_id) {
        for (const item of items) {
          const stockRows = await this.db.query(
            `SELECT COALESCE(available_quantity, 0)::numeric AS available
             FROM stock_balances
             WHERE warehouse_id = $1 AND product_variant_id = $2`,
            [body.source_warehouse_id, item.variant_id],
          );
          const available = Number(stockRows[0]?.available ?? 0);
          if (available < (item.required_quantity || 0)) {
            return {
              status: false,
              message: `Insufficient stock for variant ${item.variant_id}. Available: ${available}, Required: ${item.required_quantity}`,
            };
          }
        }
      }

      const planSql = `
        INSERT INTO dispatch_plans
          (dispatch_number, source_warehouse_id, target_branch_id, dispatch_date,
           status, total_items, total_quantity, vehicle_number, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const planRows = await this.db.query(planSql, [
        dispatchNumber, body.source_warehouse_id, body.target_branch_id,
        body.dispatch_date, 'draft', items.length, totalQty,
        body.vehicle_number, body.notes, adminId,
      ]);

      const planId = planRows[0]?.dispatch_number;
      if (!planId) throw new InternalServerErrorException('Failed to create plan');

      // Insert items
      for (const item of items) {
        await this.db.query(
          `INSERT INTO dispatch_plan_items
            (dispatch_plan_id, variant_id, product_id, required_quantity, unit, notes)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [planId, item.variant_id, item.product_id, item.required_quantity, item.unit || 'pcs', item.notes],
        );
      }

      return { status: true, data: planRows[0], message: 'Dispatch plan created' };
    } catch (error) {
      this.developer.error('createDispatchPlan error', { error });
      throw new InternalServerErrorException('Failed to create dispatch plan');
    }
  }

  async updateDispatchPlanStatus(id: string, newStatus: string, adminId: string) {
    try {
      const validStatuses = ['approved', 'picking', 'dispatched', 'in_transit', 'received', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      // Get plan details
      const planRows = await this.db.query(
        `SELECT dp.*, dp.dispatch_number FROM dispatch_plans dp WHERE dp.id = $1`,
        [id],
      );
      if (!planRows[0]) return { status: false, message: 'Plan not found' };

      const plan = planRows[0];
      const warehouseId = plan.source_warehouse_id;

      // Get plan items
      const itemRows = await this.db.query(
        `SELECT * FROM dispatch_plan_items WHERE dispatch_plan_id = $1`,
        [plan.dispatch_number],
      );

      // ── APPROVED: Reserve stock ──
      if (newStatus === 'approved' && warehouseId) {
        await this.db.transaction(async (client) => {
          for (const item of itemRows) {
            await this.stockCore.reserveStock(
              client,
              String(warehouseId),
              item.variant_id,
              Number(item.required_quantity),
            );
          }

          await client.query(
            `UPDATE dispatch_plans SET status = 'approved', updated_at = NOW() WHERE id = $1`,
            [id],
          );
        });

        return { status: true, message: 'Dispatch plan approved, stock reserved' };
      }

      // ── DISPATCHED: Confirm dispatch (reserved → dispatched) ──
      if (newStatus === 'dispatched' && warehouseId) {
        await this.db.transaction(async (client) => {
          for (const item of itemRows) {
            await this.stockCore.confirmDispatch(
              client,
              String(warehouseId),
              item.variant_id,
              Number(item.required_quantity),
              'dispatch_plan',
              plan.dispatch_number,
              adminId,
            );

            // Update dispatched_quantity on item
            await client.query(
              `UPDATE dispatch_plan_items
               SET dispatched_quantity = $2
               WHERE id = $1`,
              [item.id, item.required_quantity],
            );
          }

          await client.query(
            `UPDATE dispatch_plans
             SET status = 'dispatched', dispatched_by = $2, dispatched_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [id, adminId],
          );
        });

        return { status: true, message: 'Dispatch confirmed, stock deducted' };
      }

      // ── CANCELLED: Unreserve stock if was approved ──
      if (newStatus === 'cancelled' && warehouseId && plan.status === 'approved') {
        await this.db.transaction(async (client) => {
          for (const item of itemRows) {
            await this.stockCore.unreserveStock(
              client,
              String(warehouseId),
              item.variant_id,
              Number(item.required_quantity),
            );
          }

          await client.query(
            `UPDATE dispatch_plans SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [id],
          );
        });

        return { status: true, message: 'Dispatch plan cancelled, stock unreserved' };
      }

      // ── Other status transitions ──
      const updateFields: string[] = ['status = $2', 'updated_at = NOW()'];
      const params: any[] = [id, newStatus];

      if (newStatus === 'received') {
        updateFields.push('received_by = $3', 'received_at = NOW()');
        params.push(adminId);
      } else {
        params.push(adminId);
      }

      await this.db.query(
        `UPDATE dispatch_plans SET ${updateFields.join(', ')} WHERE id = $1`,
        params,
      );

      return { status: true, message: `Dispatch plan status updated to ${newStatus}` };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('updateDispatchPlanStatus error', { error });
      throw new InternalServerErrorException('Failed to update dispatch plan status');
    }
  }

  // ────────────────────────────────────────────────
  // Compute Dispatch Requirements
  // ────────────────────────────────────────────────
  async computeDispatchRequirements(branchId: string, date?: string) {
    try {
      const targetDate = date || new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const sql = `
        SELECT
          oi.variant_id,
          pv.name AS variant_name, pv.sku,
          p.name AS product_name,
          SUM(oi.quantity)::int AS required_quantity,
          COALESCE(
            (SELECT sb.available_quantity FROM stock_balances sb
             JOIN warehouses w ON w.warehouse_id = sb.warehouse_id
             WHERE sb.product_variant_id = oi.variant_id
             LIMIT 1),
            0
          )::int AS current_stock,
          GREATEST(
            SUM(oi.quantity) - COALESCE(
              (SELECT sb.available_quantity FROM stock_balances sb
               JOIN warehouses w ON w.warehouse_id = sb.warehouse_id
               WHERE sb.product_variant_id = oi.variant_id
               LIMIT 1),
              0
            ),
            0
          )::int AS dispatch_needed
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        WHERE o.scheduled_date = $2
          AND o.branch_id = $1
          AND o.status NOT IN ('cancelled', 'failed')
        GROUP BY oi.variant_id, pv.name, pv.sku, p.name
        ORDER BY dispatch_needed DESC
      `;

      const rows = await this.db.query(sql, [branchId, targetDate]);

      return {
        status: true,
        data: rows,
        date: targetDate,
        branch_id: branchId,
        message: 'Dispatch requirements computed',
      };
    } catch (error) {
      this.developer.error('computeDispatchRequirements error', { error });
      throw new InternalServerErrorException('Failed to compute dispatch requirements');
    }
  }
}
