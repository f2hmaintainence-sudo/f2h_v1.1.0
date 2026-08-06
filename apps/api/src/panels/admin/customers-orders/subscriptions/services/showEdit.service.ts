import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper, FormResponse } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { SubscriptionsShowAddService } from './showAdd.service';

@Injectable()
export class SubscriptionsShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: SubscriptionsShowAddService,
  ) { }

  async getSubscriptionsEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('subscriptions', {
        select: ['subscriptions.*'],
        where: [{ column: 'subscriptions.id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Subscription not found');
      }

      return this.formHelper.generateResponse({
        title: 'Edit Subscription',
        submitLabel: 'Update Subscription',
        fields: this.showAddService.subscriptionsFields(),
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getSubscriptionsEditForm error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load subscription edit form',
      );
    }
  }

  async getSubscriptionsOverrideEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('subscription_overrides', {
        select: [
          'subscription_overrides.*',
          'subscription_items.product_variant_id',
        ],
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

      return this.formHelper.generateResponse({
        title: 'Edit Subscription Override',
        submitLabel: 'Update Override',
        fields: await this.showAddService.subscriptionOverrideFields(),
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getSubscriptionsOverrideEditForm error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to load subscription override edit form',
      );
    }
  }
}
