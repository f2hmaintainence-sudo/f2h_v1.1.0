import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  TableHelper,
  TableSet,
  JoinDef,
  CustomDef,
  ReqSet,
} from '../../../../helpers/TableHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class BranchManagementService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER DIRECTORY TABLE
  // ═══════════════════════════════════════════════════════════════

  async getCustomerTable(query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        id: ['customers.id', false],
        customer_name: ['users.first_name', true],
        phone: ['users.phone', true],
        email: ['users.email', true],
        joined: ['customers.created_at', true],
        wallet_balance: ['wallets.balance', true],
        status: ['customers.status', true],
      };

      const joins: JoinDef[] = [
        {
          type: 'left',
          table: 'users',
          on: [['customers.user_id', 'users.user_id']],
        },
        {
          type: 'left',
          table: 'wallets',
          on: [['customers.id', 'wallets.customer_id']],
        },
      ];

      const conditions: any[] = [];

      if (query.status) {
        conditions.push({
          column: 'customers.status',
          operator: '=',
          value: query.status,
        });
      }

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = active, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Active</span>)::' +
            'ELSEIF(status = dormant, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Dormant</span>)::' +
            'ELSEIF(status = paused, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Paused</span>)::' +
            'ELSEIF(status = blocked, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Blocked</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">New</span>)::',
          renderHtml: true,
        },
        {
          type: 'addon',
          column: 'actions',
          view: '<a class="px-3 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer">View</a>',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customers',
        table: 'customers',
        filters: {
          search: query.search || '',
          dateRange: {},
          columns: {},
          sort: query.sortBy ? { [query.sortBy]: query.sortDir || 'ASC' } : {},
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins,
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getCustomerTable error', {
        error,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer table',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER SEGMENTATION
  // ═══════════════════════════════════════════════════════════════

  async getSegments() {
    try {
      const active = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          {
            column: 'customers.status',
            operator: '=',
            value: 'active',
          },
        ],
      });
      const dormant = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          {
            column: 'customers.status',
            operator: '=',
            value: 'dormant',
          },
        ],
      });
      const paused = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          {
            column: 'customers.status',
            operator: '=',
            value: 'paused',
          },
        ],
      });
      const blocked = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          { column: 'customers.status', operator: '=', value: 'blocked' },
        ],
      });

      return {
        status: true,
        data: {
          active: active?.data?.[0]?.count ?? 0,
          dormant: dormant?.data?.[0]?.count ?? 0,
          paused: paused?.data?.[0]?.count ?? 0,
          blocked: blocked?.data?.[0]?.count ?? 0,
        },
      };
    } catch (error) {
      this.developer.error('CustomersService.getSegments error', { error });
      throw new InternalServerErrorException('Failed to retrieve segments');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SINGLE CUSTOMER PROFILE
  // ═══════════════════════════════════════════════════════════════

  async getCustomerProfile(id: string) {
    try {
      const result = await this.dataService.query('customers', {
        select: [
          'customers.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          'users.phone',
          'users.created_at AS user_created_at',
          'wallets.balance AS wallet_balance',
          'wallets.is_frozen AS wallet_frozen',
        ],
        joins: [
          {
            type: 'left',
            table: 'users',
            on: [['customers.user_id', 'users.user_id']],
          },
          {
            type: 'left',
            table: 'wallets',
            on: [['customers.id', 'wallets.customer_id']],
          },
        ],
        where: [{ column: 'customers.id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Customer not found');
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CustomersService.getCustomerProfile error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer profile',
      );
    }
  }

  async getCustomerOrders(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        order_id: ['orders.id', true],
        product: ['order_items.product_name', true],
        amount: ['orders.total_amount', true],
        status: ['orders.status', true],
        delivery_date: ['orders.delivery_date', true],
        created_at: ['orders.created_at', true],
      };

      const joins: JoinDef[] = [
        {
          type: 'left',
          table: 'order_items',
          on: [['orders.id', 'order_items.order_id']],
        },
      ];

      const conditions = [
        { column: 'orders.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = delivered, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Delivered</span>)::' +
            'ELSEIF(status = pending, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Pending</span>)::' +
            'ELSEIF(status = failed, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Failed</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Processing</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_orders',
        table: 'orders',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'orders.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins,
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getCustomerOrders error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer orders',
      );
    }
  }

  async getCustomerSubscriptions(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        sub_id: ['subscriptions.id', true],
        product: ['subscriptions.product_name', true],
        frequency: ['subscriptions.frequency', true],
        quantity: ['subscriptions.quantity', true],
        slot: ['subscriptions.delivery_slot', true],
        status: ['subscriptions.status', true],
        start_date: ['subscriptions.start_date', true],
      };

      const conditions = [
        { column: 'subscriptions.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = active, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Active</span>)::' +
            'ELSEIF(status = paused, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Paused</span>)::' +
            'ELSEIF(status = cancelled, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Cancelled</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_subscriptions',
        table: 'subscriptions',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'subscriptions.start_date': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins: [],
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getCustomerSubscriptions error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve subscriptions',
      );
    }
  }

  async getWalletLedger(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        txn_id: ['wallet_transactions.id', true],
        type: ['wallet_transactions.type', true],
        amount: ['wallet_transactions.amount', true],
        reason: ['wallet_transactions.reason', true],
        initiated_by: ['wallet_transactions.initiated_by', true],
        created_at: ['wallet_transactions.created_at', true],
      };

      const conditions = [
        { column: 'wallet_transactions.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'type',
          view:
            '::IF(type = credit, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">+ Credit</span>)::' +
            'ELSEIF(type = debit, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">− Debit</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">System</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_wallet',
        table: 'customer_wallet_transactions',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'wallet_transactions.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins: [],
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getWalletLedger error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve wallet ledger',
      );
    }
  }

  async getComplaints(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        complaint_id: ['complaints.id', true],
        subject: ['complaints.subject', true],
        description: ['complaints.description', true],
        status: ['complaints.status', true],
        priority: ['complaints.priority', true],
        created_at: ['complaints.created_at', true],
      };

      const conditions = [
        { column: 'complaints.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = open, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Open</span>)::' +
            'ELSEIF(status = resolved, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Resolved</span>)::' +
            'ELSEIF(status = rejected, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Rejected</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Under Review</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_complaints',
        table: 'complaints',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'complaints.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins: [],
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getComplaints error', {
        error,
        id,
      });
      throw new InternalServerErrorException('Failed to retrieve complaints');
    }
  }

  async getCustomerScore(id: string) {
    try {
      const profile = await this.dataService.query('customers', {
        select: [
          'customers.fraud_score',
          'customers.loyalty_points',
          'customers.credit_limit',
        ],
        where: [{ column: 'customers.id', operator: '=', value: id }],
        limit: 1,
      });

      return {
        status: true,
        data: profile?.data?.[0] ?? {
          fraud_score: 0,
          loyalty_points: 0,
          credit_limit: 0,
        },
      };
    } catch (error) {
      this.developer.error('CustomersService.getCustomerScore error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer score',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET ACTIONS
  // ═══════════════════════════════════════════════════════════════

  async creditWallet(
    customerId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    if (!amount || amount <= 0)
      throw new BadRequestException('Amount must be positive');
    if (!reason) throw new BadRequestException('Reason is required');

    try {
      await this.dataService.query('wallets', {
        update: { balance: amount },
        where: [
          { column: 'wallets.customer_id', operator: '=', value: customerId },
        ],
      });

      await this.dataService.insert('customer_wallet_transactions', {
        customer_id: customerId,
        type: 'credit',
        amount,
        reason,
        initiated_by: adminId,
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_credit',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ amount, reason }),
      });

      return { status: true, message: `₹${amount} credited successfully` };
    } catch (error) {
      this.developer.error('CustomersService.creditWallet error', {
        error,
        customerId,
      });
      throw new InternalServerErrorException('Failed to credit wallet');
    }
  }

  async debitWallet(
    customerId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    if (!amount || amount <= 0)
      throw new BadRequestException('Amount must be positive');
    if (!reason) throw new BadRequestException('Reason is required');

    try {
      await this.dataService.query('wallets', {
        update: { balance: -amount },
        where: [
          { column: 'wallets.customer_id', operator: '=', value: customerId },
        ],
      });

      await this.dataService.insert('customer_wallet_transactions', {
        customer_id: customerId,
        type: 'debit',
        amount,
        reason,
        initiated_by: adminId,
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_debit',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ amount, reason }),
      });

      return { status: true, message: `₹${amount} debited successfully` };
    } catch (error) {
      this.developer.error('CustomersService.debitWallet error', {
        error,
        customerId,
      });
      throw new InternalServerErrorException('Failed to debit wallet');
    }
  }

  async freezeWallet(customerId: string, adminId: string) {
    try {
      await this.dataService.query('wallets', {
        update: { is_frozen: true },
        where: [
          { column: 'wallets.customer_id', operator: '=', value: customerId },
        ],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_freeze',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ action: 'frozen' }),
      });

      return { status: true, message: 'Wallet frozen successfully' };
    } catch (error) {
      this.developer.error('CustomersService.freezeWallet error', {
        error,
        customerId,
      });
      throw new InternalServerErrorException('Failed to freeze wallet');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBSCRIPTION OVERRIDES
  // ═══════════════════════════════════════════════════════════════

  async pauseSubscription(customerId: string, subId: string, adminId: string) {
    try {
      await this.dataService.query('subscriptions', {
        update: { status: 'paused', paused_at: new Date().toISOString() },
        where: [
          { column: 'subscriptions.id', operator: '=', value: subId },
          {
            column: 'subscriptions.customer_id',
            operator: '=',
            value: customerId,
          },
        ],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_pause',
        target_type: 'subscription',
        target_id: subId,
        details: JSON.stringify({ customer_id: customerId }),
      });

      return { status: true, message: 'Subscription paused' };
    } catch (error) {
      this.developer.error('CustomersService.pauseSubscription error', {
        error,
      });
      throw new InternalServerErrorException('Failed to pause subscription');
    }
  }

  async resumeSubscription(customerId: string, subId: string, adminId: string) {
    try {
      await this.dataService.query('subscriptions', {
        update: { status: 'active', paused_at: null },
        where: [
          { column: 'subscriptions.id', operator: '=', value: subId },
          {
            column: 'subscriptions.customer_id',
            operator: '=',
            value: customerId,
          },
        ],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_resume',
        target_type: 'subscription',
        target_id: subId,
        details: JSON.stringify({ customer_id: customerId }),
      });

      return { status: true, message: 'Subscription resumed' };
    } catch (error) {
      this.developer.error('CustomersService.resumeSubscription error', {
        error,
      });
      throw new InternalServerErrorException('Failed to resume subscription');
    }
  }

  async modifySubscription(
    customerId: string,
    subId: string,
    data: any,
    adminId: string,
  ) {
    try {
      const allowedFields: Record<string, any> = {};
      if (data.quantity !== undefined) allowedFields.quantity = data.quantity;
      if (data.delivery_slot) allowedFields.delivery_slot = data.delivery_slot;
      if (data.product_name) allowedFields.product_name = data.product_name;
      if (data.frequency) allowedFields.frequency = data.frequency;

      if (Object.keys(allowedFields).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      await this.dataService.query('subscriptions', {
        update: allowedFields,
        where: [
          { column: 'subscriptions.id', operator: '=', value: subId },
          {
            column: 'subscriptions.customer_id',
            operator: '=',
            value: customerId,
          },
        ],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_modify',
        target_type: 'subscription',
        target_id: subId,
        details: JSON.stringify({
          changes: allowedFields,
          customer_id: customerId,
        }),
      });

      return { status: true, message: 'Subscription modified successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CustomersService.modifySubscription error', {
        error,
      });
      throw new InternalServerErrorException('Failed to modify subscription');
    }
  }

  async cancelSubscription(customerId: string, subId: string, adminId: string) {
    try {
      await this.dataService.query('subscriptions', {
        update: { status: 'cancelled', cancelled_at: new Date().toISOString() },
        where: [
          { column: 'subscriptions.id', operator: '=', value: subId },
          {
            column: 'subscriptions.customer_id',
            operator: '=',
            value: customerId,
          },
        ],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_cancel',
        target_type: 'subscription',
        target_id: subId,
        details: JSON.stringify({ customer_id: customerId }),
      });

      return { status: true, message: 'Subscription cancelled' };
    } catch (error) {
      this.developer.error('CustomersService.cancelSubscription error', {
        error,
      });
      throw new InternalServerErrorException('Failed to cancel subscription');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPLAINT RESOLUTION
  // ═══════════════════════════════════════════════════════════════

  async approveRefund(
    customerId: string,
    complaintId: string,
    adminId: string,
  ) {
    try {
      const complaint = await this.dataService.query('complaints', {
        select: ['complaints.refund_amount'],
        where: [{ column: 'complaints.id', operator: '=', value: complaintId }],
        limit: 1,
      });

      const refundAmount = complaint?.data?.[0]?.refund_amount ?? 0;

      await this.dataService.query('complaints', {
        update: {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: adminId,
        },
        where: [{ column: 'complaints.id', operator: '=', value: complaintId }],
      });

      if (refundAmount > 0) {
        await this.creditWallet(
          customerId,
          refundAmount,
          `Refund for complaint #${complaintId}`,
          adminId,
        );
      }

      return {
        status: true,
        message: 'Refund approved and credited to wallet',
      };
    } catch (error) {
      this.developer.error('CustomersService.approveRefund error', { error });
      throw new InternalServerErrorException('Failed to approve refund');
    }
  }

  async rejectComplaint(
    customerId: string,
    complaintId: string,
    reason: string,
    adminId: string,
  ) {
    if (!reason) throw new BadRequestException('Rejection reason is required');

    try {
      await this.dataService.query('complaints', {
        update: {
          status: 'rejected',
          rejection_reason: reason,
          resolved_at: new Date().toISOString(),
          resolved_by: adminId,
        },
        where: [{ column: 'complaints.id', operator: '=', value: complaintId }],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'complaint_reject',
        target_type: 'complaint',
        target_id: complaintId,
        details: JSON.stringify({ customer_id: customerId, reason }),
      });

      return { status: true, message: 'Complaint rejected' };
    } catch (error) {
      this.developer.error('CustomersService.rejectComplaint error', { error });
      throw new InternalServerErrorException('Failed to reject complaint');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACCOUNT CONTROLS
  // ═══════════════════════════════════════════════════════════════

  async blockCustomer(customerId: string, reason: string, adminId: string) {
    if (!reason) throw new BadRequestException('Block reason is required');

    try {
      await this.dataService.query('customers', {
        update: {
          status: 'blocked',
          blocked_reason: reason,
          blocked_at: new Date().toISOString(),
        },
        where: [{ column: 'customers.id', operator: '=', value: customerId }],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customer_block',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ reason }),
      });

      return { status: true, message: 'Customer blocked' };
    } catch (error) {
      this.developer.error('CustomersService.blockCustomer error', { error });
      throw new InternalServerErrorException('Failed to block customer');
    }
  }

  async unblockCustomer(customerId: string, adminId: string) {
    try {
      await this.dataService.query('customers', {
        update: { status: 'active', blocked_reason: null, blocked_at: null },
        where: [{ column: 'customers.id', operator: '=', value: customerId }],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customer_unblock',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ action: 'unblocked' }),
      });

      return { status: true, message: 'Customer unblocked' };
    } catch (error) {
      this.developer.error('CustomersService.unblockCustomer error', { error });
      throw new InternalServerErrorException('Failed to unblock customer');
    }
  }

  async setPostpaidLimit(customerId: string, limit: number, adminId: string) {
    if (limit === undefined || limit < 0)
      throw new BadRequestException('Invalid credit limit');

    try {
      const isEnabled = limit > 0;
      await this.dataService.query('customers', {
        update: { postpaid_credit_limit: limit, is_postpaid_enabled: isEnabled },
        where: [{ column: 'customers.customer_id', operator: '=', value: customerId }],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'set_postpaid_limit',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ credit_limit: limit, is_postpaid_enabled: isEnabled }),
      }).catch(() => {});

      return { status: true, message: `Postpaid limit set to ₹${limit}` };
    } catch (error) {
      this.developer.error('BranchManagementService.setPostpaidLimit error', {
        error,
      });
      throw new InternalServerErrorException('Failed to set postpaid limit');
    }
  }

  async sendNotification(
    customerId: string,
    message: string,
    type: string = 'push',
  ) {
    if (!message) throw new BadRequestException('Message is required');

    try {
      await this.dataService.insert('notifications', {
        recipient_type: 'customer',
        recipient_id: customerId,
        type,
        message,
        status: 'pending',
        created_by: 'system',
        updated_by: 'system',
      });

      return { status: true, message: 'Notification queued successfully' };
    } catch (error) {
      this.developer.error('CustomersService.sendNotification error', {
        error,
      });
      throw new InternalServerErrorException('Failed to send notification');
    }
  }

  async exportCustomerData(customerId: string) {
    try {
      const profile = await this.getCustomerProfile(customerId);
      const orders = await this.dataService.query('orders', {
        select: ['*'],
        where: [
          { column: 'orders.customer_id', operator: '=', value: customerId },
        ],
      });
      const walletTxns = await this.dataService.query('customer_wallet_transactions', {
        select: ['*'],
        where: [
          {
            column: 'wallet_transactions.customer_id',
            operator: '=',
            value: customerId,
          },
        ],
      });

      return {
        status: true,
        data: {
          profile: profile.data,
          orders: orders?.data ?? [],
          wallet_transactions: walletTxns?.data ?? [],
        },
      };
    } catch (error) {
      this.developer.error('CustomersService.exportCustomerData error', {
        error,
      });
      throw new InternalServerErrorException('Failed to export customer data');
    }
  }

  async deleteAccount(customerId: string, adminId: string) {
    try {
      await this.dataService.query('customers', {
        update: {
          status: 'deleted',
          deleted_at: new Date().toISOString(),
        },
        where: [{ column: 'customers.id', operator: '=', value: customerId }],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'account_delete_dpdpa',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ action: 'DPDPA account deletion' }),
      });

      return {
        status: true,
        message: 'Account deletion initiated (DPDPA compliance)',
      };
    } catch (error) {
      this.developer.error('CustomersService.deleteAccount error', { error });
      throw new InternalServerErrorException('Failed to delete account');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW & SOFT DELETE (for table actions)
  // ═══════════════════════════════════════════════════════════════

  async getCustomerView(id: string) {
    try {
      const result = await this.dataService.query('customers', {
        select: ['customers.*'],
        where: [
          { column: 'customers.id', operator: '=', value: id },
          { column: 'customers.deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        return { status: false, message: 'Customer not found' };
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      this.developer.error('getCustomerView error', { error, id });
      throw new InternalServerErrorException('Failed to load customer details');
    }
  }

  async softDeleteCustomer(id: string, adminId: string = 'system') {
    try {
      const result = await this.dataService.query('customers', {
        update: { deleted_at: new Date().toISOString() },
        where: [
          { column: 'id', operator: '=', value: id },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
      });

      if (!result?.status) {
        return {
          status: false,
          message: 'Customer not found or already deleted',
        };
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customer_soft_delete',
        target_type: 'customers',
        target_id: id,
        details: JSON.stringify({ action: 'soft_delete' }),
      });

      return { status: true, message: 'Customer deleted successfully' };
    } catch (error) {
      this.developer.error('softDeleteCustomer error', { error, id });
      throw new InternalServerErrorException('Failed to delete customer');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS VIEW & SOFT DELETE
  // ═══════════════════════════════════════════════════════════════

  async getWalletTransactionView(id: string) {
    try {
      const result = await this.dataService.query('customer_wallet_transactions', {
        select: ['wallet_transactions.*'],
        where: [
          { column: 'wallet_transactions.id', operator: '=', value: id },
          {
            column: 'wallet_transactions.deleted_at',
            operator: 'IS',
            value: null,
          },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        return { status: false, message: 'Wallet transaction not found' };
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      this.developer.error('getWalletTransactionView error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load wallet transaction details',
      );
    }
  }

  async softDeleteWalletTransaction(id: string, adminId: string = 'system') {
    try {
      const result = await this.dataService.query('customer_wallet_transactions', {
        update: { deleted_at: new Date().toISOString() },
        where: [
          { column: 'id', operator: '=', value: id },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
      });

      if (!result?.status) {
        return {
          status: false,
          message: 'Wallet transaction not found or already deleted',
        };
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_transactions_soft_delete',
        target_type: 'customer_wallet_transactions',
        target_id: id,
        details: JSON.stringify({ action: 'soft_delete' }),
      });

      return {
        status: true,
        message: 'Wallet transaction deleted successfully',
      };
    } catch (error) {
      this.developer.error('softDeleteWalletTransaction error', { error, id });
      throw new InternalServerErrorException(
        'Failed to delete wallet transaction',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GET FULL BRANCH BY ID (used by frontend detail view)
  // ═══════════════════════════════════════════════════════════════

  async getBranchById(branchId: string) {
    try {
      const isNum = !isNaN(Number(branchId));
      let whereClause: any[] = [{ column: 'branches.branch_id', operator: '=', value: branchId }];
      if (isNum) {
        whereClause = [{ column: 'branches.id', operator: '=', value: Number(branchId) }];
      }

      let result = await this.dataService.query('branches', {
        select: [
          'branches.id',
          'branches.branch_id',
          'branches.branch_name',
          'branches.branch_code',
          'branches.city',
          'branches.state',
          'branches.lat',
          'branches.lng',
          'branches.delivery_radius_km',
          'branches.buffer_zone',
          'branches.allow_buffer_order',
          'branches.hex_shape',
          'branches.is_active',
          'branches.created_at',
          'branches.updated_at',
        ],
        where: whereClause,
        limit: 1,
      });

      if (!result?.data?.length && !isNum) {
        result = await this.dataService.query('branches', {
          select: [
            'branches.id',
            'branches.branch_id',
            'branches.branch_name',
            'branches.branch_code',
            'branches.city',
            'branches.state',
            'branches.lat',
            'branches.lng',
            'branches.delivery_radius_km',
            'branches.buffer_zone',
            'branches.allow_buffer_order',
            'branches.hex_shape',
            'branches.is_active',
            'branches.created_at',
            'branches.updated_at',
          ],
          where: [{ column: 'branches.branch_code', operator: '=', value: branchId }],
          limit: 1,
        });
      }

      if (!result?.data?.length) {
        return { status: false, message: 'Branch not found' };
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      this.developer.error('getBranchById error', { error, branchId });
      return { status: false, message: 'Failed to fetch branch' };
    }
  }
}
