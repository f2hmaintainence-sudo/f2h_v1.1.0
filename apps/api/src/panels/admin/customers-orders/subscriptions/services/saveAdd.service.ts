import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { SubscriptionsShowAddService } from './showAdd.service';

function makeSubscriptionId() {
  return `SUB_${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`.slice(0, 30);
}

@Injectable()
export class SubscriptionsSaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: SubscriptionsShowAddService,
  ) { }

  async saveSubscription(body: any, adminId: string) {
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

      const insertData: Record<string, any> = {};
      for (const field of fields) {
        if (body[field.name] !== undefined) {
          let value = body[field.name];
          if (typeof value === 'string') value = value.trim();
          if (value === '') value = null;
          insertData[field.name] = value;
        }
      }

      insertData.id = body.id || makeSubscriptionId();
      insertData.auto_renew =
        body.auto_renew === true || body.auto_renew === 'true';
      insertData.renewal_grace_days =
        insertData.renewal_grace_days === null ||
        insertData.renewal_grace_days === undefined
          ? 3
          : Number(insertData.renewal_grace_days);
      insertData.created_by = adminId;
      insertData.updated_by = adminId;

      if (insertData.status === 'cancelled' && !insertData.cancelled_at) {
        insertData.cancelled_at = new Date().toISOString();
      }

      const result = await this.dataService.insert('subscriptions', insertData);
      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_create',
        target_type: 'subscription',
        target_id: insertData.id,
        details: JSON.stringify({ table: 'subscriptions' }),
      });

      return {
        status: true,
        message: 'Subscription created successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveSubscription error', { error });
      throw new InternalServerErrorException('Failed to create subscription');
    }
  }

  async saveSubscriptionOverride(body: any, adminId: string) {
    try {
      const fields = await this.showAddService.subscriptionOverrideFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      await this.ensureSubscribableSubscriptionItem(body.subscription_item_id);

      const insertData: Record<string, any> = {
        subscription_item_id: String(body.subscription_item_id).trim(),
        override_date: body.override_date,
        override_type: String(body.override_type).trim().toLowerCase(),
        m_quantity: Number(body.m_quantity ?? 0),
        e_quantity: Number(body.e_quantity ?? 0),
        is_paid: body.is_paid === true || body.is_paid === 'true',
        notes:
          typeof body.notes === 'string' && body.notes.trim() !== ''
            ? body.notes.trim()
            : null,
      };

      const result = await this.dataService.insert(
        'subscription_overrides',
        insertData,
      );
      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      await this.dataService.insert('subscription_logs', {
        subscription_item_id: insertData.subscription_item_id,
        action: 'override_create',
        old_data: null,
        new_data: JSON.stringify(insertData),
        created_by: adminId,
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_override_create',
        target_type: 'subscription_override',
        target_id: String(result?.data?.id ?? insertData.subscription_item_id),
        details: JSON.stringify({ table: 'subscription_overrides' }),
      });

      return {
        status: true,
        message: 'Subscription override created successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveSubscriptionOverride error', { error });
      throw new InternalServerErrorException(
        'Failed to create subscription override',
      );
    }
  }

  private async ensureSubscribableSubscriptionItem(subscriptionItemId: string) {
    const result = await this.dataService.query('subscription_items', {
      select: ['subscription_items.id'],
      joins: [
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
        {
          column: 'subscription_items.id',
          operator: '=',
          value: String(subscriptionItemId || '').trim(),
        },
        { column: 'products.is_subscribable', operator: '=', value: true },
      ],
      limit: 1,
    });

    if (!result?.data?.length) {
      throw new BadRequestException(
        'Subscription item must belong to a subscribable product',
      );
    }
  }
}
