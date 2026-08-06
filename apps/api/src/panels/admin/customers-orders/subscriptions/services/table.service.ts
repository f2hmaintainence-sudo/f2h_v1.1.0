import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ReqSet,
  TableHelper,
  TableSet,
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

function normalizeStatus(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

function extractSimpleFilters(query: any): string[] {
  const result: string[] = [];

  if (query?.status) result.push(String(query.status).toLowerCase());
  if (query?.statusFilter) result.push(String(query.statusFilter).toLowerCase());
  if (query?.filter) result.push(String(query.filter).toLowerCase());

  const rawFilters = query?.filters;
  if (Array.isArray(rawFilters)) {
    rawFilters.forEach((item: any) => result.push(String(item).toLowerCase()));
  } else if (rawFilters && typeof rawFilters === 'object') {
    Object.values(rawFilters).forEach((item: any) =>
      result.push(String(item).toLowerCase()),
    );
  } else if (rawFilters) {
    result.push(String(rawFilters).toLowerCase());
  }

  for (const [key, value] of Object.entries(query || {})) {
    if (/^filters\[\d+\]$/.test(key) && value) {
      result.push(String(value).toLowerCase());
    }
  }

  return Array.from(new Set(result));
}

@Injectable()
export class SubscriptionsTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) {}

  async getSubscriptionsTable(query: any) {
    try {
      const tableFilters = extractFilters(query);
      const conditions: any[] = [];

      // Simple filters sent from frontend:
      const simpleFilters = extractSimpleFilters(query);

      const scheduleType = String(query.schedule_type || '').toLowerCase();
      const paymentType = String(query.payment_type || '').toLowerCase();

      // Status filter
      const statusValues = ['active', 'paused', 'cancelled', 'expired'];

      const status = simpleFilters.find((filter) =>
        statusValues.includes(filter),
      );

      if (status && status !== 'all') {
        conditions.push({
          column: 'subscriptions.status',
          operator: '=',
          value: status,
        });
      }

      // Target date filter for scheduled subscriptions
      if (query.filterByTargetDate === 'true' && (query.targetDate || query.date)) {
        const targetDate = query.targetDate || query.date;
        const dateStr = String(targetDate).slice(0, 10);
        conditions.push({
          column: 'subscriptions.start_date',
          operator: '<=',
          value: dateStr,
        });
      }

      // Today filter
      if (simpleFilters.includes('today')) {
        conditions.push({
          column: 'DATE(subscriptions.created_at)',
          operator: '=',
          value: new Date().toISOString().split('T')[0],
        });
      }

      // Auto renew enabled
      if (simpleFilters.includes('auto_renew')) {
        conditions.push({
          column: 'subscriptions.auto_renew',
          operator: '=',
          value: true,
        });
      }

    /*
    |--------------------------------------------------------------------------
    | Existing Query Filters
    |--------------------------------------------------------------------------
    */

    if (scheduleType) {
      conditions.push({
        column: 'subscriptions.schedule_type',
        operator: '=',
        value: scheduleType,
      });
    }

    if (paymentType) {
      conditions.push({
        column: 'subscriptions.payment_type',
        operator: '=',
        value: paymentType,
      });
    }

    const reqSet: ReqSet = {
      key: 'subscriptions',
      table: 'subscriptions',
      actions: 'ved',
      act: 'id',
      filters: {
        search: query.search || '',
        dateRange: tableFilters.dateRange,
        columns: tableFilters.columns,
        sort: query.sortBy
          ? { [query.sortBy]: query.sortDir || 'DESC' }
          : {
              'subscriptions.start_date': 'DESC',
              'subscriptions.created_at': 'DESC',
            },
        pagination: {
          type: 'offset',
          page: parseInt(query.page) || 1,
          limit: parseInt(query.limit) || 10,
        },
      },
    };

    const set: TableSet = {
      columns: {
        id: ['subscriptions.id', false],
        subscription_number: ['subscriptions.subscription_number', true],
        subscription_id: ['subscriptions.subscription_id', true],
        customer_id: ['subscriptions.customer_id', true],
        first_name: ['users.first_name', false],
        last_name: ['users.last_name', false],
        full_name: ["CONCAT_WS(' ', users.first_name, users.last_name)", false],
        customer_name: ['users.first_name', true],
        mobile: ['users.phone', false],
        phone: ['users.phone', true],
        schedule_type: ['subscriptions.schedule_type', true],
        payment_type: ['subscriptions.payment_type', true],
        billing_cycle: ['subscriptions.billing_cycle', true],
        start_date: ['subscriptions.start_date', true],
        end_date: ['subscriptions.end_date', true],
        auto_renew: ['subscriptions.auto_renew', true],
        renewal_grace_days: ['subscriptions.renewal_grace_days', true],
        status: ['subscriptions.status', true],
        wallet_balance: ['customers.wallet_balance', true],
        created_at: ['subscriptions.created_at', true],
      },
      joins: [
        {
          type: 'LEFT',
          table: 'users',
          on: [['users.user_id', 'subscriptions.customer_id']],
        },
        {
          type: 'LEFT',
          table: 'customers',
          on: [['customers.customer_id', 'subscriptions.customer_id']],
        },
      ],
      conditions,
      custom: [
        {
          type: 'compute',
          column: 'customer_name',
          callback: (row) => {
            if (row.full_name) return row.full_name;
            const parts = [row.first_name, row.last_name].filter(Boolean);
            if (parts.length > 0) return parts.join(' ');
            return row.customer_id || 'N/A';
          },
          renderHtml: false,
        },
        {
          type: 'compute',
          column: 'phone',
          callback: (row) => {
            return row.mobile || row.phone || 'N/A';
          },
          renderHtml: false,
        },
      ],
      req_set: reqSet,
    };

    return await this.tableHelper.generateResponse(set);
  } catch (error) {
    this.developer.error('getSubscriptionsTable error', { error });

    throw new InternalServerErrorException(
      'Failed to retrieve subscriptions table',
    );
  }
}

  async getSubscriptionOverridesTable(query: any) {
    try {
      const filters = extractFilters(query);
      const conditions: any[] = [
        { column: 'products.is_subscribable', operator: '=', value: true },
      ];

      if (query.override_type) {
        conditions.push({
          column: 'subscription_overrides.override_type',
          operator: '=',
          value: String(query.override_type).toLowerCase(),
        });
      }

      const reqSet: ReqSet = {
        key: 'subscription_overrides',
        table: 'subscription_overrides',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'DESC' }
            : { 'subscription_overrides.override_date': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['subscription_overrides.id', false],
          subscription_item_id: [
            'subscription_overrides.subscription_item_id',
            true,
          ],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name AS variant_name', true],
          override_date: ['subscription_overrides.override_date', true],
          override_type: ['subscription_overrides.override_type', true],
          m_quantity: ['subscription_overrides.m_quantity', true],
          e_quantity: ['subscription_overrides.e_quantity', true],
          is_paid: ['subscription_overrides.is_paid', true],
          notes: ['subscription_overrides.notes', true],
          created_at: ['subscription_overrides.created_at', true],
        },
        joins: [
          {
            type: 'inner',
            table: 'subscription_items',
            on: [
              [
                'subscription_overrides.subscription_item_id',
                'subscription_items.id',
              ],
            ],
          },
          {
            type: 'inner',
            table: 'product_variants',
            on: [
              [
                'subscription_items.product_variant_id',
                'product_variants.variant_id',
              ],
            ],
          },
          {
            type: 'inner',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'override_type',
            callback: (row) => {
              const label = String(row.override_type || '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());

              return `
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  ${label}
                </span>
              `;
            },
            renderHtml: true,
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getSubscriptionOverridesTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve subscription overrides table',
      );
    }
  }

  async getSubscriptionLogsTable(query: any) {
    try {
      const filters = extractFilters(query);
      const conditions: any[] = [];

      if (query.action) {
        conditions.push({
          column: 'subscription_logs.action',
          operator: '=',
          value: String(query.action),
        });
      }

      const reqSet: ReqSet = {
        key: 'subscription_logs',
        table: 'subscription_logs',
        actions: 'v',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'DESC' }
            : { 'subscription_logs.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['subscription_logs.id', false],
          subscription_id: ['subscription_logs.subscription_id', true],
          subscription_item_id: [
            'subscription_logs.subscription_item_id',
            true,
          ],
          action: ['subscription_logs.action', true],
          old_data: ['subscription_logs.old_data', false],
          new_data: ['subscription_logs.new_data', false],
          created_by: ['subscription_logs.created_by', true],
          created_at: ['subscription_logs.created_at', true],
        },
        joins: [],
        conditions,
        custom: [],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getSubscriptionLogsTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve subscription logs table',
      );
    }
  }
}

