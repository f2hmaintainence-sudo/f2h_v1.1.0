import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TableHelper, TableSet, ReqSet } from '../../../../helpers/TableHelper';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

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
export class CustomerTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) {}

  async getBranchTable(query: any) {
    try {
      const conditions: any[] = [];

      // Filter by active status if needed
      if (query.is_active !== undefined) {
        conditions.push({
          column: 'branches.is_active',
          operator: '=',
          value: query.is_active === 'true',
        });
      }

      const reqSet: ReqSet = {
        key: 'branches',
        table: 'branches',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'branches.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['branches.id', false],
          branch_id: ['branches.branch_id', false],
          branch_name: ['branches.branch_name', true],
          branch_code: ['branches.branch_code', true],
          city: ['branches.city', true],
          state: ['branches.state', true],
          is_active: ['branches.is_active', true],
          delivery_radius_km: ['branches.delivery_radius_km', true],
          buffer_zone: ['branches.buffer_zone', true],
          allow_buffer_order: ['branches.allow_buffer_order', true],
          hex_shape: ['branches.hex_shape', true],
          lat: ['branches.lat', true],
          lng: ['branches.lng', true],
          created_at: ['branches.created_at', true],
        },
        joins: [],
        conditions,
        custom: [
          {
            type: 'modify',
            column: 'is_active',
            view:
              '::IF(is_active = true, <span class="badge badge-success">Active</span>)::' +
              'ELSE(<span class="badge badge-danger">Inactive</span>)::',
            renderHtml: true,
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getBranchesTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve branches table',
      );
    }
  }

  async getZoneTable(query: any) {
    try {
      const conditions: any[] = [];

      if (query.is_active !== undefined) {
        conditions.push({
          column: 'zones.is_active',
          operator: '=',
          value: query.is_active === 'true',
        });
      }

      const reqSet: ReqSet = {
        key: 'zones',
        table: 'zones',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'zones.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['zones.id', true],
          name: ['zones.name', true],
          description: ['zones.description', true],
          is_active: ['zones.is_active', true],
          created_at: ['zones.created_at', true],
        },
        joins: [],
        conditions,
        custom: [
          {
            type: 'modify',
            column: 'is_active',
            view:
              '::IF(is_active = true, <span class="badge badge-success">Active</span>)::' +
              'ELSE(<span class="badge badge-danger">Inactive</span>)::',
            renderHtml: true,
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getZoneTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve zones table');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS TABLE (kept for backwards compat if needed, but not used for branches)
  // ═══════════════════════════════════════════════════════════════

  async getWalletTransactionsTable(query: any) {
    return { data: [], total: 0, page: 1, limit: 10 };
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER TABLE (filtered by branch and zone)
  // ═══════════════════════════════════════════════════════════════

  async getCustomerTable(query: any) {
    try {
      const conditions: any[] = [];

      // Filter by zone_id if provided
      if (query.zone_id) {
        conditions.push({
          column: 'customers.zone_id',
          operator: '=',
          value: query.zone_id,
        });
      }

      // Filter by branch_id if provided (through zones join)
      if (query.branch_id) {
        conditions.push({
          column: 'zones.branch_id',
          operator: '=',
          value: query.branch_id,
        });
      }

      if (query.is_active !== undefined) {
        conditions.push({
          column: 'customers.is_blocked',
          operator: '=',
          value: query.is_active === 'false', // is_blocked is inverse of is_active roughly
        });
      }

      const reqSet: ReqSet = {
        key: 'customers',
        table: 'customers',
        actions: 'v',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'DESC' }
            : { 'customers.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['customers.id', false],
          full_name: ["CONCAT_WS(' ', users.first_name, users.last_name)", true],
          phone: ['users.phone', true],
          email: ['users.email', true],
          zone_name: ['zones.name', true],
          branch_name: ['branches.branch_name', true],
          total_orders: ['customers.total_orders', true],
          created_at: ['customers.created_at', true],
        },
        joins: [
          {
            type: 'LEFT',
            table: 'users',
            on: [['users.user_id', 'customers.customer_id']],
          },
          {
            type: 'LEFT',
            table: 'zones',
            on: [['zones.id', 'customers.zone_id']],
          },
          {
            type: 'LEFT',
            table: 'branches',
            on: [['branches.branch_id', 'zones.branch_id']],
          }
        ],
        conditions,
        custom: [],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getCustomerTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve customer table');
    }
  }
}

@Injectable()
export class StaffsTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) {}

  async getStaffsTable(query: any) {
    try {
      const conditions: any[] = [];

      if (query.is_active !== undefined) {
        conditions.push({
          column: 'management_staff.is_active',
          operator: '=',
          value: query.is_active === 'true',
        });
      }

      if (query.branch_id) {
        conditions.push({
          column: 'management_staff.branch_id',
          operator: '=',
          value: query.branch_id,
        });
      }

      const reqSet: ReqSet = {
        key: 'management_staff',
        table: 'management_staff',
        actions: 'ved', // view, edit, delete
        act: 'id', // This matches the identifierKey in page.tsx: identifierKey="id"
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'management_staff.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['management_staff.management_id', false],
          management_id: ['management_staff.management_id', true],
          user_name: ['management_staff.user_name', true],
          email: ['users.email', true],
          phone: ['management_staff.phone', true],
          branch_name: ['branches.branch_name', true],
          department: ['management_staff.department', true],
          designation: ['management_staff.designation', true],
          is_active: ['management_staff.is_active', true],
          created_at: ['management_staff.created_at', true],
        },
        joins: [
          {
            type: 'LEFT',
            table: 'users',
            on: [['users.user_id', 'management_staff.user_id']],
          },
          {
            type: 'LEFT',
            table: 'branches',
            on: [['branches.branch_id', 'management_staff.branch_id']],
          },
        ],
        conditions,
        custom: [
          
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getStaffsTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve staffs table');
    }
  }
}
