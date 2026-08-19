import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  TableHelper,
  TableSet,
  ReqSet,
} from '../../../../../helpers/TableHelper';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

function formatActivePill(val: any): string {
  const isTrue = val === true || val === 1 || val === '1' || val === 'true' || val === 'active';
  if (isTrue) {
    return `<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="3"/></svg>Active</span>`;
  }
  return `<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #ffedd5; color: #c2410c; border: 1px solid #fdba74; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;"><circle cx="12" cy="12" r="8" fill="#ea580c"/></svg>Inactive</span>`;
}

@Injectable()
export class WarehouseTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) { }

  async getWarehouseTable(query: any) {
    try {
      const conditions: any[] = [
        {
          column: 'warehouses.deleted_at',
          operator: 'IS',
          value: null,
        },
      ];

      if (query.is_active !== undefined) {
        conditions.push({
          column: 'warehouses.is_active',
          operator: '=',
          value: query.is_active === 'true',
        });
      }

      if (query.warehouse_type) {
        conditions.push({
          column: 'warehouses.warehouse_type',
          operator: '=',
          value: query.warehouse_type,
        });
      }

      const reqSet: ReqSet = {
        key: 'warehouses',
        table: 'warehouses',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'warehouses.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['warehouses.id', true],
          warehouse_id: ['warehouses.warehouse_id', true],
          name: ['warehouses.name', true],
          code: ['warehouses.code', true],
          branch_id: ['warehouses.branch_id', true],
          branch_name: ['b.branch_name', true],
          warehouse_type: ['warehouses.warehouse_type', true],
          city: ['warehouses.city', true],
          state: ['warehouses.state', true],
          manager_name: ['warehouses.manager_name', true],
          manager_phone: ['warehouses.manager_phone', true],
          capacity: ['warehouses.capacity', true],
          capacity_unit: ['warehouses.capacity_unit', true],
          temperature_type: ['warehouses.temperature_type', true],
          is_active: ['warehouses.is_active', true],
          created_at: ['warehouses.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'branches b',
            on: [['warehouses.branch_id', 'b.branch_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'warehouse_type',
            callback: (row) => {
              const types: Record<string, string> = {
                cold_storage: 'Cold Storage',
                dry_storage: 'Dry Storage',
                temperature_controlled: 'Temp. Controlled',
                refrigerated: 'Refrigerated',
                general: 'General',
              };
              return types[row.warehouse_type] || row.warehouse_type;
            },
          },
          {
            type: 'compute',
            column: 'is_active',
            renderHtml: true,
            callback: (row) => formatActivePill(row.is_active),
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getWarehouseTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve warehouse table',
      );
    }
  }

  async getStockTable(query: any) {
    try {

      // =====================================================
      // CONDITIONS
      // =====================================================
      const conditions: any[] = [];
      if (query.warehouse_id) {
        conditions.push({
          column: 'stock_balances.warehouse_id',
          operator: '=',
          value: query.warehouse_id,
        });
      }
      const reqSet: ReqSet = {
        key: 'stock_balances',
        table: 'stock_balances',
        actions: '',
        act: 'id',
        filters: {
          search: query.search || '',
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'stock_balances.updated_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.per_page || query.limit) || 10,
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

          stock_status: ['stock_balances.is_out_of_stock', true],

          updated_at: ['stock_balances.updated_at', true],
        },

        joins: [
          {
            type: 'left',
            table: 'warehouses',
            on: [['stock_balances.warehouse_id', 'warehouses.warehouse_id']],
          },
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
        ],

        conditions,

        custom: [
          {
            type: 'compute',
            column: 'stock_status',
            renderHtml: true,
            callback: (row) => {
              const qty = Number(row.available_quantity || 0);
              const threshold = Number(row.low_stock_threshold || 0);

              if (qty <= 0) {
                return '<span class="badge badge-danger">Out of Stock</span>';
              }

              if (qty <= threshold) {
                return '<span class="badge badge-warning">Low Stock</span>';
              }

              return '<span class="badge badge-success">In Stock</span>';
            },
          },

          {
            type: 'compute',
            column: 'available_quantity',
            callback: (row) =>
              Number(row.available_quantity || 0).toFixed(2),
          },

          {
            type: 'compute',
            column: 'reserved_quantity',
            callback: (row) =>
              Number(row.reserved_quantity || 0).toFixed(2),
          },

          {
            type: 'compute',
            column: 'dispatched_quantity',
            callback: (row) =>
              Number(row.dispatched_quantity || 0).toFixed(2),
          },

          {
            type: 'compute',
            column: 'damaged_quantity',
            callback: (row) =>
              Number(row.damaged_quantity || 0).toFixed(2),
          },

          {
            type: 'compute',
            column: 'updated_at',
            callback: (row) => {
              if (!row.updated_at) return '';

              return new Date(row.updated_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
            },
          },
        ],

        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);

    } catch (error) {
      this.developer.error('getTransferTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve transfer table');
    }
  }


  async getTransferTable(query: any) {
    try {

      // =====================================================
      // CONDITIONS
      // =====================================================

      const conditions: any[] = [
        {
          column: 'stock_transfers.deleted_at',
          operator: 'IS',
          value: null,
        },
      ];

      if (query.transfer_status) {
        conditions.push({
          column: 'stock_transfers.transfer_status',
          operator: '=',
          value: query.transfer_status,
        });
      }

      if (query.from_warehouse_id) {
        conditions.push({
          column: 'stock_transfers.from_warehouse_id',
          operator: '=',
          value: query.from_warehouse_id,
        });
      }

      if (query.to_warehouse_id) {
        conditions.push({
          column: 'stock_transfers.to_warehouse_id',
          operator: '=',
          value: query.to_warehouse_id,
        });
      }

      if (query.warehouse_id) {
        conditions.push({
          nested: [
            {
              column: 'stock_transfers.from_warehouse_id',
              operator: '=',
              value: query.warehouse_id,
              boolean: 'OR',
            },
            {
              column: 'stock_transfers.to_warehouse_id',
              operator: '=',
              value: query.warehouse_id,
              boolean: 'OR',
            },
          ],
          boolean: 'AND',
        });
      }

      if (query.product_id) {
        conditions.push({
          column: 'stock_transfers.product_id',
          operator: '=',
          value: query.product_id,
        });
      }

      // =====================================================
      // REQUEST SETUP
      // =====================================================

      const reqSet: ReqSet = {
        key: 'stock_transfers',
        table: 'stock_transfers',
        actions: '',
        act: 'id',
        filters: {
          search: query.search || '',
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'stock_transfers.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.per_page) || 10,
          },
        },
      };

      // =====================================================
      // TABLE CONFIGURATION
      // =====================================================

      const set: TableSet = {
        columns: {
          id:                  ['stock_transfers.id', true],
          transfer_id:         ['stock_transfers.transfer_id', true],
          from_warehouse_id:   ['stock_transfers.from_warehouse_id', true],
          to_warehouse_id:     ['stock_transfers.to_warehouse_id', true],
          product_id:          ['stock_transfers.product_id', true],
          quantity:            ['stock_transfers.quantity', true],
          quantity_dispatched: ['stock_transfers.quantity_dispatched', true],
          quantity_received:   ['stock_transfers.quantity_received', true],
          transfer_status:     ['stock_transfers.transfer_status', true],
          expected_at:         ['stock_transfers.expected_at', true],
          created_at:          ['stock_transfers.created_at', true],
          workflow:            ['stock_transfers.id', true],
        },
        joins:      [],
        conditions,
        custom: [

          // ── Status badge ──────────────────────────────────
                    // {
                    //   type: 'compute',
                    //   column: 'transfer_status',
                    //   renderHtml: true,
                    //   callback: (row) => {
                    //     const statusMap: Record<string, string> = {
                    //       pending:    '<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>',
                    //       approved:   '<span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Approved</span>',
                    //       dispatched: '<span class="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Dispatched</span>',
                    //       completed:  '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>',
                    //       cancelled:  '<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Cancelled</span>',
                    //     };
                    //     return statusMap[row.transfer_status] || row.transfer_status;
                    //   },
                    // },

          // ── Created at format ─────────────────────────────
          {
            type: 'compute',
            column: 'created_at',
            callback: (row) => {
              if (!row.created_at) return '';
              return new Date(row.created_at).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
              });
            },
          },

          // ── Workflow action buttons ────────────────────────
          // {
          //   type: 'compute',
          //   column: 'workflow',
          //   renderHtml: true,
          //   callback: (row) => {
          //     const status = row.transfer_status;
          //     const id     = row.id;
          //     let html = '<div class="table-actions-group">';

          //     html += `<button type="button" class="skl-btn-xs skl-btn-blue" data-action="view" data-id="${id}"><i class="fa fa-eye"></i></button>`;

          //     if (status === 'pending') {
          //       html += `<button type="button" class="skl-btn-xs skl-btn-green" data-action="edit" data-id="${id}"><i class="fa fa-edit"></i></button>`;
          //       html += `<button type="button" class="skl-btn-xs skl-btn-blue" data-action="approve" data-id="${id}"><i class="fa fa-check"></i> Approve</button>`;
          //     }

          //     if (status === 'approved') {
          //       html += `<button type="button" class="skl-btn-xs skl-btn-orange" data-action="dispatch" data-id="${id}"><i class="fa fa-truck"></i> Dispatch</button>`;
          //     }

          //     if (status === 'dispatched') {
          //       html += `<button type="button" class="skl-btn-xs skl-btn-green" data-action="receive" data-id="${id}"><i class="fa fa-box"></i> Receive</button>`;
          //     }

          //     html += '</div>';
          //     return html;
          //   },
          // },

        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);

    } catch (error) {
      this.developer.error('getTransferTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve transfer table');
    }
  }


  async getStockMovementTable(query: any) {

    try {

      // =====================================================
      // CONDITIONS
      // =====================================================

      const conditions: any[] = [
        {
          column: 'stock_movements.deleted_at',
          operator: 'IS',
          value: null,
        },
      ];

      // =====================================================
      // FILTERS
      // =====================================================

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

      if (query.batch_id) {
        conditions.push({
          column: 'stock_movements.batch_id',
          operator: '=',
          value: query.batch_id,
        });
      }

      if (query.product_variant_id) {
        conditions.push({
          column: 'stock_movements.product_variant_id',
          operator: '=',
          value: query.product_variant_id,
        });
      }

      // =====================================================
      // REQUEST SET
      // =====================================================

      const reqSet: ReqSet = {
        key: 'stock_movements',

        table: 'stock_movements',

        actions: 've',

        act: 'id',

        filters: {
          search: query.search || '',

          sort: query.sortBy
            ? {
              [query.sortBy]:
                query.sortDir || 'DESC',
            }
            : {
              'stock_movements.created_at':
                'DESC',
            },

          pagination: {
            type: 'offset',

            page:
              parseInt(query.page) || 1,

            limit:
              parseInt(query.limit) || 10,
          },
        },
      };

      // =====================================================
      // TABLE SET
      // =====================================================

      const set: TableSet = {
        columns: {

          id: ['stock_movements.id',true,],
          movement_id: ['stock_movements.movement_id',true,],
          movement_type: ['stock_movements.movement_type',true,],
          direction: ['stock_movements.direction',true,],
          warehouse_name: ['warehouses.name AS warehouse_name',true,],
          product_name: ['products.name AS product_name',true,],
          variant_name: ['product_variants.name AS variant_name',true,],
          batch_id: ['stock_movements.batch_id',true,],
          quantity: ['stock_movements.quantity',true,],
          quantity_before: ['stock_movements.quantity_before',true,],
          quantity_after: ['stock_movements.quantity_after',true,],
          created_by: ['stock_movements.created_by',true,],
          created_at: ['stock_movements.created_at',true,],
        },

        // =====================================================
        // JOINS
        // =====================================================

        joins: [
          { type: 'left', table: 'warehouses', on: [['stock_movements.warehouse_id','warehouses.warehouse_id',],], },
          { type: 'left', table: 'product_variants', on: [['stock_movements.product_variant_id','product_variants.variant_id',],], },
          { type: 'left', table: 'products',on: [['product_variants.product_id','products.product_id',],],},],

        conditions,
        custom: [
          { type: 'compute',
            column: 'movement_type',
            callback: (row) => {
              const types: Record<string, string> = {
                stock_in:'Stock In',
                stock_out:'Stock Out',
                transfer_in:'Transfer In',
                transfer_out:'Transfer Out',
                damage:'Damage',
                expiry:'Expiry',
                return:'Return',
                adjustment:'Adjustment',
              };

              return (
                types[row.movement_type] ||row.movement_type);
            },
          },
          {type: 'compute',
            column: 'direction',
            callback: (row) => {
              return Number(row.direction) === 1
                ? '<span class="badge badge-success">IN</span>'
                : '<span class="badge badge-danger">OUT</span>';
            },
            renderHtml: true,
          },
        ],

        req_set: reqSet,
      };

      // =====================================================
      // GENERATE TABLE RESPONSE
      // =====================================================

      return await this.tableHelper.generateResponse(
        set,
      );

    } catch (error) {

      this.developer.error(
        'getStockMovementTable error',
        { error },
      );

      throw new InternalServerErrorException(
        'Failed to retrieve stock movements table',
      );
    }
  }

  async getIntakeTable(query: any) {
    try {
      const conditions: any[] = [
        {
          column: 'vendor_intakes.deleted_at',
          operator: 'IS',
          value: null,
        },
      ];

      if (query.quality_status) {
        conditions.push({
          column: 'vendor_intakes.quality_status',
          operator: '=',
          value: query.quality_status,
        });
      }

      if (query.intake_status) {
        conditions.push({
          column: 'vendor_intakes.intake_status',
          operator: '=',
          value: query.intake_status,
        });
      }

      const reqSet: ReqSet = {
        key: 'vendor_intakes',
        table: 'vendor_intakes',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'vendor_intakes.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['vendor_intakes.id', true],
          intake_id: ['vendor_intakes.intake_id', true],
          vendor_name: ['vendors.name', true],
          warehouse_name: ['warehouses.name', true],
          product_name: ['products.name', true],
          variant_name: ['product_variants.name', true],
          quantity: ['vendor_intakes.quantity', true],
          unit_type: ['vendor_intakes.unit_type', true],
          quality_status: ['vendor_intakes.quality_status', true],
          intake_status: ['vendor_intakes.intake_status', true],
          vehicle_number: ['vendor_intakes.vehicle_number', true],
          received_at: ['vendor_intakes.received_at', true],
          created_at: ['vendor_intakes.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'vendors',
            on: [['vendor_intakes.vendor_id', 'vendors.vendor_id']],
          },
          {
            type: 'left',
            table: 'warehouses',
            on: [['vendor_intakes.warehouse_id', 'warehouses.warehouse_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['vendor_intakes.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'product_variants',
            on: [['vendor_intakes.variant_id', 'product_variants.id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'received_at',
            callback: (row) => row.received_at ? new Date(row.received_at).toLocaleString('en-IN') : '—',
          },
          {
            type: 'compute',
            column: 'created_at',
            callback: (row) => row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '—',
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getIntakeTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve vendor intake table');
    }
  }
}
