import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  TableHelper,
  TableSet,
  ReqSet,
  JoinDef,
} from '../../../../../helpers/TableHelper';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

function extractFilters(query: any) {
  const columns: Record<string, string[]> = {};
  const dateRange: Record<string, any> = {};

  for (const [key, val] of Object.entries(query || {})) {
    if (key.startsWith('col_')) {
      columns[key.substring(4)] = Array.isArray(val)
        ? val.map(String)
        : [String(val)];
    } else if (key.startsWith('date_')) {
      const match = key.match(/^date_(.+)_(from|to)$/);
      if (match) {
        if (!dateRange[match[1]]) dateRange[match[1]] = {};
        dateRange[match[1]][match[2]] = val;
      }
    }
  }

  return { columns, dateRange };
}

@Injectable()
export class InventoryTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) {}

  async getInventoryTable(query: any) {
    try {
      const conditions: any[] = [
        {
          column: 'product_variants.deleted_at',
          operator: 'IS',
          value: null,
        },
        {
          column: 'products.deleted_at',
          operator: 'IS',
          value: null,
        },
      ];

      if (query.warehouse_id) {
        conditions.push({
          column: 'stock_balances.warehouse_id',
          operator: '=',
          value: query.warehouse_id,
        });
      }

      if (query.product_id) {
        conditions.push({
          column: 'product_variants.product_id',
          operator: '=',
          value: query.product_id,
        });
      }

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key: 'inventory_overview',
        table: 'stock_balances',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'products.name': 'ASC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['stock_balances.id', false],
          warehouse_name: ['warehouses.name AS warehouse_name', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          sku: ['product_variants.sku', true],
          available_quantity: ['stock_balances.available_quantity', true],
          reserved_quantity: ['stock_balances.reserved_quantity', true],
          dispatched_quantity: ['stock_balances.dispatched_quantity', true],
          damaged_quantity: ['stock_balances.damaged_quantity', true],
          low_stock_threshold: ['stock_balances.low_stock_threshold', true],
          unit_type: ['product_variants.unit_type', true],
          stock_status: ['stock_balances.available_quantity AS stock_status_val', true],
          updated_at: ['stock_balances.updated_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['stock_balances.product_variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'warehouses',
            on: [['stock_balances.warehouse_id', 'warehouses.warehouse_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'stock_status',
            callback: (row) => {
              const qty = Number(row.available_quantity || 0);
              const threshold = Number(row.low_stock_threshold || 10);
              if (qty <= 0) return '<span class="badge badge-danger">Out of Stock</span>';
              if (qty <= threshold) return '<span class="badge badge-warning">Low Stock</span>';
              return '<span class="badge badge-success">In Stock</span>';
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'updated_at',
            callback: (row) => this.formatDate(row.updated_at),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getInventoryTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve inventory table',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Stock Movements Table
  // ────────────────────────────────────────────────
  async getStockMovementsTable(query: any) {
    try {
      const conditions: any[] = [];

      if (query.movement_type) {
        conditions.push({
          column: 'stock_movements.movement_type',
          operator: '=',
          value: query.movement_type,
        });
      }

      if (query.warehouse_id) {
        conditions.push({
          column: 'stock_movements.warehouse_id',
          operator: '=',
          value: query.warehouse_id,
        });
      }

      if (query.variant_id) {
        conditions.push({
          column: 'stock_movements.product_variant_id',
          operator: '=',
          value: query.variant_id,
        });
      }

      if (query.direction) {
        conditions.push({
          column: 'stock_movements.direction',
          operator: '=',
          value: Number(query.direction),
        });
      }

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key: 'stock_movements',
        table: 'stock_movements',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'stock_movements.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const joins: JoinDef[] = [
        {
          type: 'left',
          table: 'product_variants',
          on: [['stock_movements.product_variant_id', 'product_variants.variant_id']],
        },
        {
          type: 'left',
          table: 'products',
          on: [['product_variants.product_id', 'products.product_id']],
        },
        {
          type: 'left',
          table: 'warehouses',
          on: [['stock_movements.warehouse_id', 'warehouses.warehouse_id']],
        },
      ];

      const set: TableSet = {
        columns: {
          id: ['stock_movements.id', false],
          movement_id: ['stock_movements.movement_id', true],
          warehouse_name: ['warehouses.name AS warehouse_name', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          movement_type: ['stock_movements.movement_type', true],
          direction: ['stock_movements.direction', true],
          quantity: ['stock_movements.quantity', true],
          quantity_before: ['stock_movements.quantity_before', true],
          quantity_after: ['stock_movements.quantity_after', true],
          reference_type: ['stock_movements.reference_type', true],
          reference_id: ['stock_movements.reference_id', true],
          notes: ['stock_movements.notes', true],
          created_at: ['stock_movements.created_at', true],
        },
        joins,
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'direction',
            callback: (row) => {
              const dir = Number(row.direction);
              if (dir === 1) {
                return '<span class="badge badge-success">IN</span>';
              }
              return '<span class="badge badge-danger">OUT</span>';
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'movement_type',
            callback: (row) => {
              const type = row.movement_type?.toLowerCase() || '';
              const colors: Record<string, string> = {
                purchase: 'badge-success',
                production: 'badge-success',
                stock_in: 'badge-success',
                stock_transfer: 'badge-info',
                dispatch: 'badge-warning',
                delivery_return: 'badge-primary',
                customer_return: 'badge-primary',
                stock_adjustment: 'badge-secondary',
                damage: 'badge-danger',
                expiry: 'badge-danger',
                opening_stock: 'badge-info',
                closing_stock: 'badge-info',
              };
              const badge = colors[type] || 'badge-secondary';
              return `<span class="badge ${badge}">${type.replace(/_/g, ' ').toUpperCase()}</span>`;
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'created_at',
            callback: (row) => this.formatDate(row.created_at),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getStockMovementsTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve stock movements table',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Low Stock Items Table (uses stock_balances threshold)
  // ────────────────────────────────────────────────
  async getLowStockItemsTable(query: any) {
    try {
      const conditions: any[] = [];

      if (query.warehouse_id) {
        conditions.push({
          column: 'stock_balances.warehouse_id',
          operator: '=',
          value: query.warehouse_id,
        });
      }

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key: 'low_stock_items',
        table: 'stock_balances',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'stock_balances.available_quantity': 'ASC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['stock_balances.id', false],
          warehouse_name: ['warehouses.name AS warehouse_name', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          sku: ['product_variants.sku', true],
          available_quantity: ['stock_balances.available_quantity', true],
          low_stock_threshold: ['stock_balances.low_stock_threshold', true],
          reserved_quantity: ['stock_balances.reserved_quantity', true],
          stock_status: ['stock_balances.available_quantity AS stock_status_val', true],
          updated_at: ['stock_balances.updated_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['stock_balances.product_variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'warehouses',
            on: [['stock_balances.warehouse_id', 'warehouses.warehouse_id']],
          },
        ],
        conditions: [
          ...conditions,
          {
            left: 'stock_balances.available_quantity',
            operator: '<=',
            rightColumn: 'stock_balances.low_stock_threshold',
          },
          // or
          // {
          //   raw: 'stock_balances.available_quantity <= stock_balances.low_stock_threshold',
          // },
        ],
        custom: [
          {
            type: 'compute',
            column: 'stock_status',
            callback: (row) => {
              const qty = Number(row.available_quantity || 0);
              if (qty <= 0) return '<span class="badge badge-danger">Out of Stock</span>';
              return '<span class="badge badge-warning">Low Stock</span>';
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'updated_at',
            callback: (row) => this.formatDate(row.updated_at),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getLowStockItemsTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve low stock items table',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Warehouse Stock Table (all stock_balances fields)
  // ────────────────────────────────────────────────
  async getWarehouseStockTable(query: any) {
    try {
      const conditions: any[] = [];
      
      if (query.warehouse_id) {
        conditions.push({
          column: 'stock_balances.warehouse_id',
          operator: '=',
          value: query.warehouse_id,
        });
      }

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key: 'warehouse_stock',
        table: 'stock_balances',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'products.name': 'ASC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['stock_balances.id', false],
          warehouse_name: ['warehouses.name AS warehouse_name', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          sku: ['product_variants.sku', true],
          available_quantity: ['stock_balances.available_quantity', true],
          reserved_quantity: ['stock_balances.reserved_quantity', true],
          dispatched_quantity: ['stock_balances.dispatched_quantity', true],
          damaged_quantity: ['stock_balances.damaged_quantity', true],
          low_stock_threshold: ['stock_balances.low_stock_threshold', true],
          unit_type: ['product_variants.unit_type', true],
          updated_at: ['stock_balances.updated_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['stock_balances.product_variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'warehouses',
            on: [['stock_balances.warehouse_id', 'warehouses.warehouse_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'available_quantity',
            callback: (row) => {
              const qty = Number(row.available_quantity || 0);
              const threshold = Number(row.low_stock_threshold || 10);
              if (qty <= 0) return `<span class="text-red-600 font-bold">${qty}</span>`;
              if (qty <= threshold) return `<span class="text-amber-600 font-bold">${qty}</span>`;
              return `<span class="text-green-600 font-bold">${qty}</span>`;
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'updated_at',
            callback: (row) => this.formatDate(row.updated_at),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getWarehouseStockTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve warehouse stock table',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Expiry Tracking Table
  // ────────────────────────────────────────────────
  async getExpiryTrackingTable(query: any) {
    try {
      const conditions: any[] = [
        {
          column: 'stock_movements.batch_id',
          operator: 'IS NOT',
          value: null,
        }
      ];

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key: 'expiry_tracking',
        table: 'stock_movements',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: { 'stock_movements.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['stock_movements.id', false],
          batch_id: ['stock_movements.batch_id', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          quantity: ['stock_movements.quantity', true],
          created_at: ['stock_movements.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['stock_movements.product_variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'created_at',
            callback: (row) => this.formatDate(row.created_at),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getExpiryTrackingTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve expiry tracking table',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Production Plans Table
  // ────────────────────────────────────────────────
  async getProductionPlansTable(query: any) {
    try {
      const conditions: any[] = [
        {
          column: 'production_plans.deleted_at',
          operator: 'IS',
          value: null,
        }
      ];

      if (query.status) {
        conditions.push({
          column: 'production_plans.production_status',
          operator: '=',
          value: query.status,
        });
      }

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key: 'production_plans',
        table: 'production_plans',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'production_plans.planned_date': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['production_plans.id', false],
          production_id: ['production_plans.production_id', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          planned_quantity: ['production_plans.planned_quantity', true],
          produced_quantity: ['production_plans.produced_quantity', true],
          planned_date: ['production_plans.planned_date', true],
          production_status: ['production_plans.production_status', true],
          priority: ['production_plans.priority', true],
        },
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['production_plans.variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'production_status',
            callback: (row) => {
              const status = row.production_status?.toLowerCase();
              if (status === 'completed') return '<span class="badge badge-success">COMPLETED</span>';
              if (status === 'in-progress' || status === 'in_progress') return '<span class="badge badge-info">IN PROGRESS</span>';
              if (status === 'planned') return '<span class="badge badge-warning">PLANNED</span>';
              return '<span class="badge badge-secondary">' + (status || 'UNKNOWN').toUpperCase() + '</span>';
            },
            renderHtml: true,
          }
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getProductionPlansTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve production plans table',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Private: Variant Stock Table (reusable)
  // ────────────────────────────────────────────────
  private async getVariantStockTable(
    query: any,
    key: string,
    baseConditions: any[],
  ) {
    try {
      const conditions = [...baseConditions];

      if (query.product_id) {
        conditions.push({
          column: 'product_variants.product_id',
          operator: '=',
          value: query.product_id,
        });
      }

      conditions.push({
        column: 'product_variants.deleted_at',
        operator: 'IS',
        value: null,
      });

      const filters = extractFilters(query);
      const reqSet: ReqSet = {
        key,
        table: 'product_variants',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'products.name': 'ASC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['product_variants.id', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          sku: ['product_variants.sku', true],
          current_stock: [
            'product_variants.manageable_qty AS current_stock',
            true,
          ],
          stock_status: ['product_variants.manageable_qty', true],
          unit_type: ['product_variants.unit_type', true],
          price: ['product_variants.price', true],
          updated_at: ['product_variants.updated_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'price',
            callback: (row) => (row.price ? `Rs. ${row.price}` : 'N/A'),
          },
          {
            type: 'compute',
            column: 'stock_status',
            callback: (row) => {
              const qty = Number(row.current_stock || 0);
              if (qty <= 0) return '<span class="badge badge-danger">Out of Stock</span>';
              if (qty <= 10) return '<span class="badge badge-warning">Low Stock</span>';
              return '<span class="badge badge-success">In Stock</span>';
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'updated_at',
            callback: (row) => this.formatDate(row.updated_at),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error(`${key} error`, { error });
      throw new InternalServerErrorException(
        'Failed to retrieve inventory table',
      );
    }
  }

  private formatDate(value: any) {
    if (!value) return '';

    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}
