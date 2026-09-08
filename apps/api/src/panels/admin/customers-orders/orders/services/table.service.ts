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

function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function normalizeOrderType(value: unknown): string {
  const type = String(value ?? '').toLowerCase();
  if (['one-time', 'one_time', 'onetime', 'single'].includes(type)) {
    return 'one-time';
  }
  if (['subscription', 'subscriptions'].includes(type)) {
    return 'subscription';
  }
  if (['undelivered', 'failed'].includes(type)) {
    return 'undelivered';
  }
  return '';
}

function normalizeStatus(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  if (status === 'faild') return 'failed';
  return status;
}

function extractSimpleFilters(query: any): string[] {
  const rawFilters = query?.filters;

  if (Array.isArray(rawFilters)) {
    return rawFilters.map((item: any) => normalizeStatus(item));
  }

  if (rawFilters && typeof rawFilters === 'object') {
    return Object.values(rawFilters).map((item: any) => normalizeStatus(item));
  }

  if (rawFilters) {
    return [normalizeStatus(rawFilters)];
  }

  return Object.entries(query || {})
    .filter(([key]) => /^filters\[\d+\]$/.test(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => normalizeStatus(value));
}

@Injectable()
export class OrdersTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) { }

  async getOrdersTable(query: any) {
    try {
      const filters = extractFilters(query);
      const conditions: any[] = [];
      const scope = String(query.scope || '').toLowerCase();
      const orderType = normalizeOrderType(query.type || query.order_source);
      const simpleFilters = extractSimpleFilters(query);
      const statusValues = [
        'pending',
        'packed',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'failed',
        'placed',
      ];
      const status =
        normalizeStatus(query.status) ||
        simpleFilters.find((filter) => statusValues.includes(filter));

      if (query.fromDate) {
        conditions.push({
          column: 'orders.scheduled_date',
          operator: '>=',
          value: query.fromDate,
        });
      }
      if (query.toDate) {
        conditions.push({
          column: 'orders.scheduled_date',
          operator: '<=',
          value: query.toDate,
        });
      }
      if (!query.fromDate && !query.toDate) {
        if (query.date) {
          conditions.push({
            column: 'orders.scheduled_date',
            operator: '=',
            value: query.date,
          });
        } else if (scope === 'today' || query.today === '1' || query.today === 'true') {
          conditions.push({
            column: 'orders.scheduled_date',
            operator: '=',
            value: todayInIndia(),
          });
        }
      }

      if (orderType === 'undelivered' || scope === 'undelivered') {
        conditions.push({
          column: 'orders.status',
          operator: '!=',
          value: 'delivered',
        });
      } else if (orderType) {
        conditions.push({
          column: 'orders.order_source',
          operator: '=',
          value: orderType,
        });
      }

      if (status && orderType !== 'undelivered' && scope !== 'undelivered') {
        conditions.push({
          column: 'orders.status',
          operator: '=',
          value: status,
        });
      }

      const reqSet: ReqSet = {
        key: 'orders',
        table: 'orders',
        actions: 'v',
        act: 'order_id',
        filters: {
          search: query.search || '',
          dateRange: filters.dateRange,
          columns: filters.columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'DESC' }
            : { 'orders.scheduled_date': 'DESC', 'orders.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['orders.id', false],
          order_id: ['orders.order_id', true],
          customer_name: ['orders.customer_name', true],
          customer_id: ['orders.customer_id', true],
          customer_phone: ['orders.contact_number', true],
          contact_number: ['orders.contact_number', true],
          delivery_partner_id: ['orders.delivery_partner_id', true],
          partner_first_name: ['dpu.first_name AS partner_first_name', true],
          partner_last_name: ['dpu.last_name AS partner_last_name', true],
          partner_phone: ['dpu.phone AS partner_phone', true],
          partner_vehicle: ['dp.vehicle_type AS partner_vehicle', true],
          partner_name: ["TRIM(CONCAT(dpu.first_name, ' ', COALESCE(dpu.last_name, ''))) AS partner_name", false],
          order_source: ['orders.order_source', true],
          subscription_id: ['orders.subscription_id', true],
          scheduled_date: ['orders.scheduled_date', true],
          delivery_slot: ['orders.delivery_slot', true],
          status: ['orders.status', true],
          payment_status: ['orders.payment_status', true],
          payment_mode: ['orders.payment_mode', true],
          subtotal: ['orders.subtotal', true],
          discount_amount: ['orders.discount_amount', true],
          gst_amount: ['orders.gst_amount', true],
          total_amount: ['orders.total_amount', true],
          delivery_image: ['orders.delivery_image', true],
          created_at: ['orders.created_at', true],
          failed_reason: [
            "(SELECT dra.failed_reason FROM delivery_run_addresses dra WHERE (dra.order_ids LIKE '%' || orders.order_id || '%' OR (dra.address_id = orders.address_id AND dra.customer_id = orders.customer_id AND dra.delivery_status = 'failed')) AND dra.failed_reason IS NOT NULL AND dra.failed_reason != '' ORDER BY dra.id DESC LIMIT 1) AS failed_reason",
            false,
          ],
          cancel_reason: [
            "(SELECT osl.notes FROM order_status_logs osl WHERE osl.order_id = orders.order_id AND osl.status = 'cancelled' AND osl.notes IS NOT NULL AND osl.notes != '' ORDER BY osl.id DESC LIMIT 1) AS cancel_reason",
            false,
          ],
        },
        joins: [
          {
            type: 'left',
            table: 'users dpu',
            on: [['orders.delivery_partner_id', 'dpu.user_id']],
          },
          {
            type: 'left',
            table: 'delivery_partners dp',
            on: [['orders.delivery_partner_id', 'dp.delivery_partner_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'order_source',
            callback: (row) => {
              const source = String(row.order_source || '-').toLowerCase();

              const classes =
                source === 'subscription'
                  ? 'text-purple-800 border border-purple-200'
                  : source === 'one-time'
                    ? 'text-blue-800 border border-blue-200'
                    : 'text-gray-800 border border-gray-200';

              const label = source
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());

              return `
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${classes}">
                  ${label}
                </span>
              `;
            },
            renderHtml: true,
          },

          {
            type: 'compute',
            column: 'status',
            callback: (row) => {
              const status = String(row.status || 'pending').toLowerCase();

              const classes =
                status === 'delivered'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : status === 'cancelled'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : status === 'failed'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : status === 'packed' || status === 'out_for_delivery'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

              const label = status
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());

              const reason =
                status === 'failed'
                  ? String(row.failed_reason || '').trim()
                  : status === 'cancelled'
                    ? String(row.cancel_reason || '').trim()
                    : '';

              const reasonHtml = reason
                ? `<div class="text-xs text-red-600 mt-1 max-w-[180px] truncate" title="${reason.replace(/"/g, '&quot;')}">
                     ⚠ ${reason}
                   </div>`
                : '';

              return `
                <div>
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${classes}">
                    ${label}
                  </span>
                  ${reasonHtml}
                </div>
              `;
            },
            renderHtml: true,
          },

          {
            type: 'compute',
            column: 'partner_name',
            callback: (row) => {
              const fName = String(row.partner_first_name || '').trim();
              const lName = String(row.partner_last_name || '').trim();
              const full = `${fName} ${lName}`.trim();
              return full || (row.delivery_partner_id ? row.delivery_partner_id : '');
            },
          },
          {
            type: 'compute',
            column: 'payment_status',
            callback: (row) => {
              const status = String(row.payment_status || 'pending').toLowerCase();

              const classes =
                status === 'paid'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : status === 'failed'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

              const label = status
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
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getOrdersTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve orders table');
    }
  }

  // async getSubscriptionSnapshotsTable(query: any) {
  //   try {
  //     const filters = extractFilters(query);
  //     const conditions: any[] = [
  //       {
  //         column: 'orders.order_source',
  //         operator: '=',
  //         value: 'subscription',
  //       },
  //     ];
  //     const scope = String(query.scope || '').toLowerCase();
  //     const simpleFilters = extractSimpleFilters(query);
  //     const deliveryStatus = normalizeStatus(
  //       query.delivery_status || query.status,
  //     ) || simpleFilters.find((filter) =>
  //       ['scheduled', 'delivered', 'skipped', 'failed', 'pending'].includes(
  //         filter,
  //       ),
  //     );
  //     const billingStatus = normalizeStatus(query.billing_status);

  //     if (scope === 'today' || query.today === '1' || query.today === 'true') {
  //       conditions.push({
  //         column: 'orders.scheduled_date',
  //         operator: '=',
  //         value: query.date || todayInIndia(),
  //       });
  //     }

  //     if (deliveryStatus) {
  //       conditions.push({
  //         column: 'orders.status',
  //         operator: '=',
  //         value: deliveryStatus,
  //       });
  //     }

  //     if (billingStatus) {
  //       conditions.push({
  //         column: 'orders.payment_status',
  //         operator: '=',
  //         value: billingStatus,
  //       });
  //     }

  //     const reqSet: ReqSet = {
  //       key: 'subscription_orders_table',
  //       table: 'order_items',
  //       actions: 'v',
  //       act: 'id',
  //       filters: {
  //         search: query.search || '',
  //         dateRange: filters.dateRange,
  //         columns: filters.columns,
  //         sort: query.sortBy
  //           ? { [query.sortBy]: query.sortDir || 'DESC' }
  //           : {
  //               'orders.scheduled_date': 'DESC',
  //               'orders.created_at': 'DESC',
  //             },
  //         pagination: {
  //           type: 'offset',
  //           page: parseInt(query.page) || 1,
  //           limit: parseInt(query.limit) || 10,
  //         },
  //       },
  //     };

  //     const set: TableSet = {
  //       columns: {
  //         id: ['order_items.id', false],
  //         snapshot_date: ['orders.scheduled_date', true],
  //         customer_id: ['orders.customer_id', false],
  //         subscription_id: ['orders.subscription_id', true],
  //         subscription_item_id: ['order_items.id', false],
  //         product_name: ['products.name AS product_name', false],
  //         variant_name: ['product_variants.name AS variant_name', true],

  //         custom_price: ['order_items.unit_price AS custom_price', true],
  //         delivery_status: ['orders.status AS delivery_status', true],
  //         billing_status: ['orders.payment_status AS billing_status', true],
  //         generated_at: ['orders.created_at AS generated_at', true],
  //       },
  //       joins: [
  //         {
  //           type: 'inner',
  //           table: 'orders',
  //           on: [['order_items.order_id', 'orders.order_id']],
  //         },
  //         {
  //           type: 'left',
  //           table: 'product_variants',
  //           on: [['order_items.variant_id', 'product_variants.variant_id']],
  //         },
  //         {
  //           type: 'left',
  //           table: 'products',
  //           on: [['product_variants.product_id', 'products.product_id']],
  //         },
  //       ],
  //       conditions,
  //       custom: [
  //         {
  //           type: 'compute',
  //           column: 'delivery_status',
  //           callback: (row) => {
  //             const status = String(row.delivery_status || 'pending').toLowerCase();

  //             const classes =
  //               status === 'delivered'
  //                 ? 'bg-green-100 text-green-800 border border-green-200'
  //                 : status === 'failed'
  //                   ? 'bg-red-100 text-red-800 border border-red-200'
  //                   : status === 'skipped'
  //                     ? 'bg-gray-100 text-gray-700 border border-gray-200'
  //                     : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

  //             const label = status.charAt(0).toUpperCase() + status.slice(1);

  //             return `
  //               <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${classes}">
  //                 ${label}
  //               </span>
  //             `;
  //           },
  //           renderHtml: true,
  //         },

  //         {
  //           type: 'compute',
  //           column: 'billing_status',
  //           callback: (row) => {
  //             const status = String(row.billing_status || 'pending').toLowerCase();

  //             const classes =
  //               status === 'billed' || status === 'paid'
  //                 ? 'bg-green-100 text-green-800 border border-green-200'
  //                 : status === 'failed'
  //                   ? 'bg-red-100 text-red-800 border border-red-200'
  //                   : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

  //             const label = status.charAt(0).toUpperCase() + status.slice(1);

  //             return `
  //               <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${classes}">
  //                 ${label}
  //               </span>
  //             `;
  //           },
  //           renderHtml: true,
  //         },
  //       ],
  //       req_set: reqSet,
  //     };

  //     return await this.tableHelper.generateResponse(set);
  //   } catch (error) {
  //     this.developer.error('getSubscriptionSnapshotsTable error', { error });
  //     throw new InternalServerErrorException(
  //       'Failed to retrieve subscription orders table',
  //     );
  //   }
  // }
}
