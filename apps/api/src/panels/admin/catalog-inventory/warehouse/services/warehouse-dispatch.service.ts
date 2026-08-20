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
