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

}
