import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { SubscriptionsShowAddService } from './showAdd.service';

@Injectable()
export class SubscriptionsSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: SubscriptionsShowAddService,
  ) { }

  async saveSubscription(id: string, body: any, adminId: string) {
    try {
      const fields = this.showAddService.subscriptionsFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const allowedUpdateFields = [
        'subscription_number',
        'customer_id',
        'schedule_type',
        'payment_type',
        'start_date',
        'end_date',
        'billing_cycle',
        'renewal_grace_days',
        'status',
        'auto_renew',
        'pause_reason',
        'cancel_reason',
        'notes',
      ];
      const updateData: Record<string, any> = {};

      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();
          if (value === '') value = null;
          if (fieldName === 'auto_renew') {
            value = value === true || value === 'true';
          }
          if (fieldName === 'renewal_grace_days' && value !== null) {
            value = Number(value);
          }
          updateData[fieldName] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      if (updateData.status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }
      updateData.updated_at = new Date().toISOString();
      updateData.updated_by = adminId;

      const result = await this.dataService.query('subscriptions', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: id }],
      });
      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_update',
        target_type: 'subscription',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      return {
        status: true,
        message: 'Subscription updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveSubscription edit error', { error, id });
      throw new InternalServerErrorException('Failed to update subscription');
    }
  }

}
