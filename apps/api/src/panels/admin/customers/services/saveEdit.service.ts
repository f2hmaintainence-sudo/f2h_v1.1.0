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
        const existing = await this.dataService.query('customers', {
          select: ['customer_id'],
          where: [
            {
              column: 'phone',
              operator: '=',
              value: String(body.phone).trim(),
            },
            { column: 'customer_id', operator: '!=', value: id },
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

      // 3. Build update data (whitelist — confirmed columns in customers table)
      const allowedUpdateFields = [
        'phone',
        'email',
        'referral_status',
        'postpaid_credit_limit',
        'is_postpaid_enabled',
        'is_blocked',
        'block_reason',
      ];
      const updateData: Record<string, any> = {};

      // Handle full_name (which is a GENERATED ALWAYS column in PostgreSQL from first_name and last_name)
      if (body.full_name !== undefined) {
        const parts = String(body.full_name).trim().split(/\s+/);
        updateData.first_name = parts[0] || '';
        updateData.last_name = parts.slice(1).join(' ') || '';
      }

      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();
          if (fieldName === 'email' && typeof value === 'string')
            value = value.toLowerCase();

          if (fieldName === 'postpaid_credit_limit') {
            value = value === '' || value === null ? 0 : Number(value);
          }

          // Transform booleans
          if (
            fieldName === 'is_postpaid_enabled' ||
            fieldName === 'is_blocked'
          ) {
            value = value === true || value === 'true' || value === 1 || value === '1';
          }

          updateData[fieldName] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      // 4. UPDATE
      updateData.updated_at = new Date().toISOString();
      const result = await this.dataService.query('customers', {
        update: updateData,
        where: [{ column: 'customer_id', operator: '=', value: id }],
      });
      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      // 5. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customers_update',
        target_type: 'customers',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
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
      const result = await this.dataService.query('wallet_transactions', {
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
        target_type: 'wallet_transactions',
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
