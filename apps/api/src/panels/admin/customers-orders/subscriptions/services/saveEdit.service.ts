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

  async saveSubscriptionOverride(id: string, body: any, adminId: string) {
    try {
      await this.ensureSubscribableOverride(id);

      const fields = await this.showAddService.subscriptionOverrideFields();
      const validation = this.formHelper.validateFields(fields, {
        ...body,
        subscription_item_id: body.subscription_item_id ?? 'existing',
        override_date: body.override_date ?? '2000-01-01',
        override_type: body.override_type ?? 'extra',
      });
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const allowedUpdateFields = [
        'override_date',
        'override_type',
        'm_quantity',
        'e_quantity',
        'is_paid',
        'notes',
      ];
      const updateData: Record<string, any> = {};

      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();
          if (value === '') value = null;
          if (fieldName === 'override_type' && value) {
            value = String(value).toLowerCase();
          }
          if (['m_quantity', 'e_quantity'].includes(fieldName)) {
            value = value === null ? 0 : Number(value);
          }
          if (fieldName === 'is_paid') {
            value = value === true || value === 'true';
          }
          updateData[fieldName] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      const result = await this.dataService.query('subscription_overrides', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: id }],
      });
      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      await this.dataService.insert('subscription_logs', {
        action: 'override_update',
        old_data: null,
        new_data: JSON.stringify({ id, changes: updateData }),
        created_by: adminId,
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_override_update',
        target_type: 'subscription_override',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      return {
        status: true,
        message: 'Subscription override updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveSubscriptionOverride edit error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to update subscription override',
      );
    }
  }

  private async ensureSubscribableOverride(id: string) {
    const result = await this.dataService.query('subscription_overrides', {
      select: ['subscription_overrides.id'],
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
      where: [
        { column: 'subscription_overrides.id', operator: '=', value: id },
        { column: 'products.is_subscribable', operator: '=', value: true },
      ],
      limit: 1,
    });

    if (!result?.data?.length) {
      throw new BadRequestException('Subscription override not found');
    }
  }
}
