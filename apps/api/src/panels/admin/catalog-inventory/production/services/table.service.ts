import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  TableHelper,
  TableSet,
  ReqSet,
} from '../../../../../helpers/TableHelper';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

@Injectable()
export class ProductionTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) {}

  async getProductionTable(query: any) {
    try {
      const reqSet: ReqSet = {
        key: 'product_batches',
        table: 'product_batches',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'product_batches.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['product_batches.id', true],
          batch_id: ['product_batches.batch_id', true],
          warehouse: ['warehouses.name AS warehouse', true],
          product: ['products.name AS product', true],
          variant: ['product_variants.name AS variant', true],
          quantity: ['product_batches.quantity', true],
          available_quantity: ['product_batches.available_quantity', true],
          damaged_quantity: ['product_batches.damaged_quantity', true],
          status: ['product_batches.status', true],
          manufactured_at: ['product_batches.manufactured_at', true],
          expiry_at: ['product_batches.expiry_at', true],
          created_at: ['product_batches.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'warehouses',
            on: [['product_batches.warehouse_id', 'warehouses.warehouse_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_batches.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'product_variants',
            on: [['product_batches.variant_id', 'product_variants.id']],
          },
        ],
        conditions: [],
        custom: [
          {
            type: 'compute',
            column: 'status',
            callback: (row) =>
              `<span class="badge badge-info">${row.status || 'active'}</span>`,
            renderHtml: true,
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getProductionTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve production table',
      );
    }
  }

  async getPlanningTable(query: any) {
    try {
      const reqSet: ReqSet = {
        key: 'production_plans',
        table: 'production_plans',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
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
          id: ['production_plans.id', true],
          production_id: ['production_plans.production_id', true],
          warehouse: ['warehouses.name AS warehouse', true],
          product: ['products.name AS product', true],
          variant: ['product_variants.name AS variant', true],
          planned_quantity: ['production_plans.planned_quantity', true],
          produced_quantity: ['production_plans.produced_quantity', true],
          planned_date: ['production_plans.planned_date', true],
          production_status: ['production_plans.production_status', true],
          priority: ['production_plans.priority', true],
          created_at: ['production_plans.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'warehouses',
            on: [['production_plans.warehouse_id', 'warehouses.warehouse_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['production_plans.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'product_variants',
            on: [['production_plans.variant_id', 'product_variants.id']],
          },
        ],
        conditions: [
          { column: 'production_plans.deleted_at', operator: 'IS', value: null }
        ],
        custom: [
          {
            type: 'compute',
            column: 'production_status',
            callback: (row) => {
              const status = row.production_status || 'planned';
              const colors: any = {
                planned: 'bg-blue-100 text-blue-700',
                in_progress: 'bg-yellow-100 text-yellow-700',
                completed: 'bg-green-100 text-green-700',
                cancelled: 'bg-red-100 text-red-700',
              };
              return `<span class="px-2 py-1 rounded text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-700'}">${status.toUpperCase()}</span>`;
            },
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'priority',
            callback: (row) => {
              const p = row.priority || 'normal';
              const colors: any = {
                high: 'text-red-600 font-bold',
                normal: 'text-gray-600',
                low: 'text-blue-600',
              };
              return `<span class="${colors[p]}">${p.toUpperCase()}</span>`;
            },
            renderHtml: true,
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getPlanningTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve production planning table',
      );
    }
  }
}
