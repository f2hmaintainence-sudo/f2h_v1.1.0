import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper, FormResponse } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { ProductionShowAddService } from './showAdd.service';

@Injectable()
export class ProductionShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: ProductionShowAddService,
  ) {}

 async editProduction(id: string): Promise<FormResponse> {
  try {
    const result = await this.dataService.query('product_batches', {
      select: ['product_batches.*'],
      where: [
        { column: 'product_batches.id', operator: '=', value: Number(id) },
      ],
      limit: 1,
    });

    if (!result?.data?.length)
      throw new BadRequestException('Production batch not found');

    const baseForm = await this.showAddService.showProduction();

    // ✅ Format TIMESTAMPTZ → YYYY-MM-DD for date input fields
    const raw = result.data[0];
    const data = {
      ...raw,
      manufactured_at: raw.manufactured_at
        ? new Date(raw.manufactured_at).toISOString().split('T')[0]
        : null,
      expiry_at: raw.expiry_at
        ? new Date(raw.expiry_at).toISOString().split('T')[0]
        : null,
    };

    return this.formHelper.generateResponse({
      title: 'Edit Production Batch',
      submitLabel: 'Update Batch',
      fields: baseForm.fields,
      data,
      script: '',
    });
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    this.developer.error('editProduction error', { error, id });
    throw new InternalServerErrorException(
      'Failed to load production edit form',
    );
  }
}

  async editPlanning(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('production_plans', {
        select: ['*'],
        where: [
          { column: 'id', operator: '=', value: Number(id) },
        ],
        limit: 1,
      });

      if (!result?.data?.length)
        throw new BadRequestException('Production plan not found');

      const baseForm = await this.showAddService.showPlanning();
      
      const raw = result.data[0];
      const data = {
        ...raw,
        planned_date: raw.planned_date
          ? new Date(raw.planned_date).toISOString().split('T')[0]
          : null,
      };

      return this.formHelper.generateResponse({
        title: 'Edit Production Plan',
        submitLabel: 'Update Plan',
        fields: baseForm.fields,
        data,
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('editPlanning error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load planning edit form',
      );
    }
  }
}
