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
        const existing = await this.dataService.query('customers', {
          select: ['id'],
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

      // 3. Build insert data from form fields
      const insertData: Record<string, any> = {};
      for (const field of fields) {
        if (body[field.name] !== undefined) {
          let value = body[field.name];
          if (typeof value === 'string') value = value.trim();
          if (field.type === 'email' && typeof value === 'string')
            value = value.toLowerCase();
          insertData[field.name] = value;
        }
      }

      // 4. Transform booleans and generated columns
      insertData.is_postpaid_enabled =
        body.is_postpaid_enabled === true ||
        body.is_postpaid_enabled === 'true' ||
        body.is_postpaid_enabled === 1 ||
        body.is_postpaid_enabled === '1';
      insertData.is_blocked =
        body.is_blocked === true ||
        body.is_blocked === 'true' ||
        body.is_blocked === 1 ||
        body.is_blocked === '1';

      if (insertData.postpaid_credit_limit !== undefined) {
        insertData.postpaid_credit_limit =
          insertData.postpaid_credit_limit === '' || insertData.postpaid_credit_limit === null
            ? 0
            : Number(insertData.postpaid_credit_limit);
      }

      if (insertData.full_name !== undefined) {
        const parts = String(insertData.full_name).trim().split(/\s+/);
        insertData.first_name = parts[0] || '';
        insertData.last_name = parts.slice(1).join(' ') || '';
        delete insertData.full_name;
      }

      // 5. INSERT
      const result = await this.dataService.insert('customers', insertData);
      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      // 6. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customers_create',
        target_type: 'customers',
        target_id: insertData.id || 'new',
        details: JSON.stringify({
          table: 'customers',
          key_fields: Object.keys(insertData).slice(0, 5),
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
        'wallet_transactions',
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
        target_type: 'wallet_transactions',
        target_id: insertData.id || 'new',
        details: JSON.stringify({
          table: 'wallet_transactions',
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
