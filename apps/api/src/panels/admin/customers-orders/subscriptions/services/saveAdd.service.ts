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
