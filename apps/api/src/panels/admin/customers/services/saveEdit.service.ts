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
export class CustomerSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: CustomerShowAddService,
  ) { }

  async saveCustomer(id: string, body: any, adminId: string) {
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

      // 2. Unique check — phone (exclude self)
      if (body.phone) {
        const existing = await this.dataService.query('users', {
          select: ['user_id'],
          where: [
            {
              column: 'phone',
              operator: '=',
              value: String(body.phone).trim(),
            },
            { column: 'user_id', operator: '!=', value: id },
          ],
          limit: 1,
        });
        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { phone: 'Phone number already used by another customer' },
          });
        }
      }

      // 3. Build update data for users (identity) and customers (extension)
      const userUpdateData: Record<string, any> = {};
      const customerUpdateData: Record<string, any> = {};

      if (body.full_name !== undefined) {
        const parts = String(body.full_name).trim().split(/\s+/);
        userUpdateData.first_name = parts[0] || '';
        userUpdateData.last_name = parts.slice(1).join(' ') || '';
      }
      if (body.phone !== undefined) {
        userUpdateData.phone = String(body.phone).trim();
      }
      if (body.email !== undefined) {
        userUpdateData.email = String(body.email).trim().toLowerCase();
      }

      const customerFields = [
        'referral_status',
        'postpaid_credit_limit',
        'is_postpaid_enabled',
        'is_blocked',
        'block_reason',
      ];

      for (const fieldName of customerFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();

          if (fieldName === 'postpaid_credit_limit') {
            value = value === '' || value === null ? 0 : Number(value);
          }

          if (fieldName === 'is_postpaid_enabled' || fieldName === 'is_blocked') {
            value = value === true || value === 'true' || value === 1 || value === '1';
          }

          customerUpdateData[fieldName] = value;
        }
      }

      if (Object.keys(userUpdateData).length === 0 && Object.keys(customerUpdateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      // 4. UPDATE
      if (Object.keys(userUpdateData).length > 0) {
        userUpdateData.updated_at = new Date().toISOString();
        await this.dataService.query('users', {
          update: userUpdateData,
          where: [{ column: 'user_id', operator: '=', value: id }],
        });
      }

      customerUpdateData.updated_at = new Date().toISOString();
      await this.dataService.query('customers', {
        update: customerUpdateData,
        where: [{ column: 'customer_id', operator: '=', value: id }],
      });

      // 5. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customers_update',
        target_type: 'customers',
        target_id: id,
        details: JSON.stringify({ changes: [...Object.keys(userUpdateData), ...Object.keys(customerUpdateData)] }),
      });

      return {
        status: true,
        message: 'Customer updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveCustomer edit error', { error, id });
      throw new InternalServerErrorException('Failed to update customer');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS — Save Edit
  // ═══════════════════════════════════════════════════════════════

  async saveWalletTransaction(id: string, body: any, adminId: string) {
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

      // 2. Build update data (whitelist)
      const allowedUpdateFields = [
        'customer_id',
        'wallet_id',
        'direction',
        'amount',
        'balance_before',
        'balance_after',
        'reason',
        'reference_type',
        'description',
        'initiated_by',
      ];
      const updateData: Record<string, any> = {};
      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();
          updateData[fieldName] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      // 3. UPDATE
      const result = await this.dataService.query('customer_wallet_transactions', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: id }],
      });
      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      // 4. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_transactions_update',
        target_type: 'customer_wallet_transactions',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      return {
        status: true,
        message: 'Wallet transaction updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveWalletTransaction edit error', { error, id });
      throw new InternalServerErrorException(
        'Failed to update wallet transaction',
      );
    }
  }
}
