import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper, FormResponse } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { InventoryShowAddService } from './showAdd.service';

@Injectable()
export class InventoryShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: InventoryShowAddService,
  ) {}

  async editMovement(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('stock_movements', {
        select: ['stock_movements.*'],
        where: [
          { column: 'stock_movements.id', operator: '=', value: Number(id) },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Stock movement not found');
      }

      const variantOptions = await this.showAddService.getVariantOptions();
      const fields = this.showAddService.movementFields(variantOptions);

      return this.formHelper.generateResponse({
        title: 'Edit Stock Movement',
        submitLabel: 'Update Movement',
        fields,
        data: {
          ...result.data[0],
          variant_id: String(result.data[0].variant_id || ''),
        },
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('editMovement error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load stock movement edit form',
      );
    }
  }
}
