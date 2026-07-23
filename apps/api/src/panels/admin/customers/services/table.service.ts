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
  ) { }

  async getCustomersTable(query: any) {
    try {
      const conditions: any[] = [];

      // Check if this is for Postpaid Customers table
      const isPostpaidTable =
        query.is_postpaid === true ||
        query.is_postpaid === 'true' ||
        query.is_postpaid === 1 ||
        query.is_postpaid === '1';

      if (isPostpaidTable) {
        conditions.push({
          column: 'customers.is_postpaid_enabled',
          operator: '=',
          value: true,
        });
      }

      // Filter by blocked status
      if (query.is_blocked !== undefined) {
        conditions.push({
          column: 'customers.is_blocked',
          operator: '=',
          value: query.is_blocked === 'true',
        });
      }

      // Always exclude soft-deleted customers
      conditions.push({
        column: 'customers.deleted_at',
        operator: 'IS',
        value: null,
      });

      const reqSet: ReqSet = {
        key: 'customers',
        table: 'customers',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
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
          id: ['customers.customer_id', false],
          is_postpaid_enabled: ['customers.is_postpaid_enabled', false],
          full_name: ['customers.full_name', true],
          postpaid_credit_limit: ['customers.postpaid_credit_limit', isPostpaidTable],
          wallet_balance: ['customer_wallet_balances.wallet_balance', true],
          phone: ['customers.phone', true],
          email: ['customers.email', true],

          // branch: ['b.branch_name', true],

          subscription_number: ['customers.subscription_number', true],
          // subscription_status: ['s.status', true],
          // billing_cycle: ['s.billing_cycle', true],
          // payment_type: ['s.payment_type', true],

          created_at: ['customers.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'customer_wallet_balances',
            on: [['customers.customer_id', 'customer_wallet_balances.customer_id']],
          },
          // {
          //   type: 'left',
          //   table: 'customer_addresses ca',
          //   on: [['customers.customer_id', 'ca.customer_id']],
          // },
          // {
          //   type: 'left',
          //   table: 'branches b',
          //   on: [['ca.branch_id', 'b.branch_id']],
          // },
          // {
          //   type: 'left',
          //   table: 'subscriptions s',
          //   on: [['customers.customer_id', 's.customer_id']],
          // },
        ],
        conditions,
        custom: [
          {
            type: 'modify',
            column: 'full_name',
            view:
              '<div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;"><span style="font-weight: 600; color: #1f2937;">::full_name::</span>' +
              '::IF(is_postpaid_enabled = true, <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="3"/></svg>Postpaid</span>)::</div>',
            renderHtml: true,
          },
          {
            type: 'modify',
            column: 'postpaid_credit_limit',
            view: '<span class="font-bold text-deep-green">₹::postpaid_credit_limit::</span>',
            renderHtml: true,
          },
          {
            type: 'compute',
            column: 'wallet_balance',
            callback: (row: Record<string, any>) => {
              const bal = Number(row.wallet_balance || 0);
              const colorClass = bal < 0 ? 'text-red-600' : 'text-deep-green';
              return `<span class="font-bold ${colorClass}">₹${bal.toFixed(2)}</span>`;
            },
            renderHtml: true,
          },
          {
            type: 'modify',
            column: 'is_blocked',
            view:
              '::IF(is_blocked = true, <span class="badge badge-danger">Blocked</span>)::' +
              'ELSE(<span class="badge badge-success">Active</span>)::',
            renderHtml: true,
          },
          {
            type: 'modify',
            column: 'is_flagged',
            view:
              '::IF(is_flagged = true, <span class="badge badge-warning">Flagged</span>)::' +
              'ELSE(<span class="badge badge-secondary">Normal</span>)::',
            renderHtml: true,
          },
          {
            type: 'modify',
            column: 'subscription_number',
            view:
              '::IF(subscription_number IS NOT NULL, <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#e0e7ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>Subscribed</span>)::' +
              'ELSE(<span class="text-gray-400 font-medium">—</span>)::',
            renderHtml: true,
          },
          // {
          //   type: 'modify',
          //   column: 'subscription_status',
          //   view:
          //     '::IF(subscription_status = "active", <span class="badge badge-success">Active</span>)::' +
          //     'ELSEIF(subscription_status = "paused", <span class="badge badge-warning">Paused</span>)::' +
          //     'ELSEIF(subscription_status = "expired", <span class="badge badge-secondary">Expired</span>)::' +
          //     'ELSEIF(subscription_status = "cancelled", <span class="badge badge-danger">Cancelled</span>)::' +
          //     'ELSE(<span class="badge badge-light">No Subscription</span>)::',
          //   renderHtml: true,
          // },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getCustomersTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve customers table',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS TABLE
  // ═══════════════════════════════════════════════════════════════

  async getWalletTransactionsTable(query: any) {
    try {
      const conditions: any[] = [];

      if (query.transaction_type) {
        conditions.push({
          column: 'customer_wallet_transactions.transaction_type',
          operator: '=',
          value: query.transaction_type,
        });
      }

      if (query.reference_type) {
        conditions.push({
          column: 'customer_wallet_transactions.reference_type',
          operator: '=',
          value: query.reference_type,
        });
      }

      const reqSet: ReqSet = {
        key: 'customer_wallet_transactions',
        table: 'customer_wallet_transactions',
        actions: 'ved',
        act: 'transaction_id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'customer_wallet_transactions.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          transaction_id: [
            'customer_wallet_transactions.wallet_transaction_id',
            true,
          ],
          customer_id: [
            'customer_wallet_transactions.customer_id',
            true,
          ],
          transaction_type: [
            'customer_wallet_transactions.transaction_type',
            true,
          ],
          amount: [
            'customer_wallet_transactions.amount',
            true,
          ],
          balance_after: [
            'customer_wallet_transactions.balance_after',
            true,
          ],
          reference_type: [
            'customer_wallet_transactions.reference_type',
            true,
          ],
          reference_id: [
            'customer_wallet_transactions.reference_id',
            true,
          ],
          remarks: [
            'customer_wallet_transactions.remarks',
            true,
          ],
          created_by: [
            'customer_wallet_transactions.created_by',
            true,
          ],
          created_at: [
            'customer_wallet_transactions.created_at',
            true,
          ],
        },

        joins: [
          // {
          //   type: 'left',
          //   table: 'customers c',
          //   on: [['customer_wallet_transactions.customer_id', 'c.customer_id']],
          // },
        ],

        conditions,

        custom: [
          {
            type: 'modify',
            column: 'transaction_type',
            view:
              '::IF(transaction_type = credit, <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10" fill="#16a34a"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="3" fill="none"/></svg>+ Credit</span>)::' +
              'ELSEIF(transaction_type = debit, <span class="badge badge-danger" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#fee2e2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10" fill="#dc2626"/><path d="M8 12h8" stroke="#ffffff" stroke-width="3" fill="none"/></svg>- Debit</span>)::' +
              'ELSEIF(transaction_type = refund, <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Refund</span>)::' +
              'ELSEIF(transaction_type = cashback, <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Cashback</span>)::' +
              'ELSE(<span style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>Other</span>)::',
            renderHtml: true,
          },
          {
            type: 'modify',
            column: 'reference_type',
            view:
              '::IF(reference_type = order, <span class="badge badge-primary" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>Order</span>)::' +
              'ELSEIF(reference_type = subscription, <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#e0e7ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>Subscription</span>)::' +
              'ELSEIF(reference_type = refund, <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #cffafe; color: #0e7490; border: 1px solid #a5f3fc; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Refund</span>)::' +
              'ELSEIF(reference_type = manual, <span class="badge badge-secondary" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Manual</span>)::' +
              'ELSEIF(reference_type = topup, <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>Topup</span>)::' +
              'ELSE(<span style="display: inline-flex; align-items: center; justify-content: center; padding: 2.5px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; line-height: 1.3;">—</span>)::',
            renderHtml: true,
          },
        ],

        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getWalletTransactionsTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve wallet transactions table',
      );
    }
  }
}
