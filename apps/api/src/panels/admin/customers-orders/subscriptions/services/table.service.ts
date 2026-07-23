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
  const rawFilters = query?.filters;

  if (Array.isArray(rawFilters)) {
    return rawFilters.map((item: any) => String(item).toLowerCase());
  }

  if (rawFilters && typeof rawFilters === 'object') {
    return Object.values(rawFilters).map((item: any) =>
      String(item).toLowerCase(),
    );
  }

  if (rawFilters) {
    return [String(rawFilters).toLowerCase()];
  }

  return Object.entries(query || {})
    .filter(([key]) => /^filters\[\d+\]$/.test(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => String(value).toLowerCase());
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
    // ?filters[0]=active&filters[1]=today
    const simpleFilters = extractSimpleFilters(query);

    const scheduleType = String(query.schedule_type || '').toLowerCase();
    const paymentType = String(query.payment_type || '').toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Simple Filter Handling
    |--------------------------------------------------------------------------
    | Frontend examples:
    | filters={['active']}
    | filters={['paused']}
    | filters={['today']}
    | filters={['paid']}
    */

    // Status filter
    const statusValues = ['active', 'paused', 'cancelled', 'expired'];

    const status = simpleFilters.find((filter) =>
      statusValues.includes(filter),
    );

    if (status) {
      conditions.push({
        column: 'subscriptions.status',
        operator: '=',
        value: status,
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
        customer_id: ['subscriptions.customer_id', true],
        customer_name: ['customers.full_name', true],
        phone: ['customers.phone', true],
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
          table: 'customers',
          on: [['customers.customer_id', 'subscriptions.customer_id']],
        },
      ],
      conditions,
      custom: [
        {
          type: 'compute',
          column: 'status',
          callback: (row) => {
            const value = String(row.status || 'active').toLowerCase();

            const classes =
              value === 'active'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : value === 'paused'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : value === 'completed'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : value === 'expired'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : value === 'cancelled'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200';

            const label = value
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase());

            return `
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${classes}">
                ${label}
              </span>
            `;
          },
          renderHtml: true,
        },
        {
          type: 'compute',
          column: 'auto_renew',
          callback: (row) => {
            const enabled =
              row.auto_renew === true || row.auto_renew === 'true';

            const classes = enabled
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-gray-100 text-gray-700 border border-gray-200';

            const label = enabled ? 'Yes' : 'No';

            return `
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${classes}">
                ${label}
              </span>
            `;
          },
          renderHtml: true,
        },
        {
          type: 'compute',
          column: 'wallet_balance',
          callback: (row) => {
            const balance = Number(row.wallet_balance || 0);
            const classes = balance > 0
              ? 'text-green-700 font-semibold'
              : 'text-red-600 font-semibold';
            return `<span class="${classes}">₹${balance.toFixed(2)}</span>`;
          },
          renderHtml: true,
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

