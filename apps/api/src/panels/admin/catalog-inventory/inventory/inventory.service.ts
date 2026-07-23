import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { InventoryTableService } from './services/table.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly tableService: InventoryTableService,
  ) {}

  async getInventoryStats(query?: any) {
    try {
      const warehouseId = query?.warehouse_id;
      const params: any[] = [];
      let whereClause = '';
      if (warehouseId) {
        params.push(warehouseId);
        whereClause = 'WHERE sb.warehouse_id = $1';
      }

      const sql = `
        SELECT
          COUNT(DISTINCT sb.product_variant_id)::int AS total_variants,
          COUNT(DISTINCT CASE WHEN sb.available_quantity <= 0 THEN sb.product_variant_id END)::int AS out_of_stock,
          COUNT(DISTINCT CASE WHEN sb.available_quantity > 0 AND sb.available_quantity <= sb.low_stock_threshold THEN sb.product_variant_id END)::int AS low_stock,
          COUNT(DISTINCT CASE WHEN sb.available_quantity > sb.low_stock_threshold THEN sb.product_variant_id END)::int AS in_stock,
          COALESCE(SUM(CASE WHEN sb.available_quantity > 0 THEN sb.available_quantity * COALESCE(pv.price, 0) ELSE 0 END), 0)::numeric AS total_stock_value,
          COALESCE(SUM(sb.available_quantity), 0)::numeric AS total_available,
          COALESCE(SUM(sb.reserved_quantity), 0)::numeric AS total_reserved,
          COALESCE(SUM(sb.dispatched_quantity), 0)::numeric AS total_dispatched
        FROM stock_balances sb
        LEFT JOIN product_variants pv ON pv.variant_id = sb.product_variant_id
        ${whereClause}
      `;

      const rows = await this.db.query(sql, params);
      const stats = rows[0] || {
        total_variants: 0,
        out_of_stock: 0,
        low_stock: 0,
        in_stock: 0,
        total_stock_value: 0,
        total_available: 0,
        total_reserved: 0,
        total_dispatched: 0,
      };

      return { status: true, data: stats };
    } catch (error) {
      this.developer.error('getInventoryStats error', { error });
      throw new InternalServerErrorException('Failed to retrieve inventory stats');
    }
  }

  async getInventoryTable(query: any) {
    return this.tableService.getInventoryTable(query);
  }

  async getStockMovementsTable(query: any) {
    return this.tableService.getStockMovementsTable(query);
  }

  async getLowStockItemsTable(query: any) {
    return this.tableService.getLowStockItemsTable(query);
  }

  async getWarehouseStockTable(query: any) {
    return this.tableService.getWarehouseStockTable(query);
  }

  async getExpiryTrackingTable(query: any) {
    return this.tableService.getExpiryTrackingTable(query);
  }

  async getProductionPlansTable(query: any) {
    return this.tableService.getProductionPlansTable(query);
  }
}
