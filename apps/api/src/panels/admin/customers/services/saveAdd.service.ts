import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { CustomerShowAddService } from './showAdd.service';

@Injectable()
export class CustomerSaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: CustomerShowAddService,
  ) {}

  async saveCustomer(body: any, adminId: string) {
    try {
      // 1. Validate using field definitions from showAdd
      const fields = this.showAddService.customersFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 2. Unique check — phone
      if (body.phone) {
        const existing = await this.dataService.query('users', {
          select: ['user_id'],
          where: [
            {
              column: 'phone',
              operator: '=',
              value: String(body.phone).trim(),
            },
          ],
          limit: 1,
        });
        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { phone: 'Phone number already exists' },
          });
        }
      }

      // Generate unique user_id / customer_id
      const customerId = `USER${Math.random().toString(36).substring(2, 12).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

      const nameParts = String(body.full_name || body.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || '';

      // 3. INSERT INTO users (identity single source of truth)
      const userData = {
        user_id: customerId,
        first_name: firstName,
        last_name: lastName,
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        role_id: 'CUSTOMER',
        account_status: 'active',
        created_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const userInsert = await this.dataService.insert('users', userData);
      if (!userInsert.status) {
        throw new InternalServerErrorException(userInsert.message || 'User creation failed');
      }

      // 4. INSERT INTO customers (satellite domain extension)
      const isPostpaid = body.is_postpaid_enabled === true || body.is_postpaid_enabled === 'true' || body.is_postpaid_enabled === 1 || body.is_postpaid_enabled === '1';
      const isBlocked = body.is_blocked === true || body.is_blocked === 'true' || body.is_blocked === 1 || body.is_blocked === '1';
      const creditLimit = body.postpaid_credit_limit === '' || body.postpaid_credit_limit === null ? 0 : Number(body.postpaid_credit_limit || 0);

      const customerData = {
        customer_id: customerId,
        customer_type: body.customer_type || 'retail',
        is_blocked: isBlocked,
        block_reason: body.block_reason || null,
        is_postpaid_enabled: isPostpaid,
        postpaid_credit_limit: creditLimit,
        first_order_completed: body.referral_status === 'active' || body.referral_status === 'unlocked' || body.first_order_completed === true,
        created_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await this.dataService.insert('customers', customerData);
      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      // 5. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customers_create',
        target_type: 'customers',
        target_id: customerId,
        details: JSON.stringify({
          table: 'customers',
          key_fields: Object.keys(customerData).slice(0, 5),
        }),
      });

      return {
        status: true,
        message: 'Customer created successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveCustomer error', { error });
      throw new InternalServerErrorException('Failed to create customer');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS — Save Add
  // ═══════════════════════════════════════════════════════════════

  async saveWalletTransaction(body: any, adminId: string) {
    try {
      // 1. Validate
      const fields = this.showAddService.walletTransactionsFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 2. Build insert data
      const insertData: Record<string, any> = {};
      for (const field of fields) {
        if (body[field.name] !== undefined) {
          let value = body[field.name];
          if (typeof value === 'string') value = value.trim();
          insertData[field.name] = value;
        }
      }

      // Default balance check (if not provided, we might want to fetch from customer's wallet, but for now we just use the form data)
      if (insertData.balance_before === undefined)
        insertData.balance_before = 0;
      if (insertData.balance_after === undefined) insertData.balance_after = 0;

      // 3. INSERT
      const result = await this.dataService.insert(
        'customer_wallet_transactions',
        insertData,
      );
      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      // 4. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_transactions_create',
        target_type: 'customer_wallet_transactions',
        target_id: insertData.id || 'new',
        details: JSON.stringify({
          table: 'customer_wallet_transactions',
          key_fields: Object.keys(insertData).slice(0, 5),
        }),
      });

      return {
        status: true,
        message: 'Wallet transaction created successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveWalletTransaction error', { error });
      throw new InternalServerErrorException(
        'Failed to create wallet transaction',
      );
    }
  }
}
