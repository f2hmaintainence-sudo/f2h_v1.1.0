import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { ProductionShowAddService } from './showAdd.service';

@Injectable()
export class ProductionSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: ProductionShowAddService,
  ) {}

  async updateProduction(id: string, body: any, adminId: string) {
    try {
      const fields = this.showAddService.productionFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const updateData: Record<string, any> = {};
      for (const field of fields) {
        if (body[field.name] !== undefined) {
          const value =
            typeof body[field.name] === 'string'
              ? body[field.name].trim()
              : body[field.name];
          updateData[field.name] = value === '' ? null : value;
        }
      }

      updateData.updated_by = adminId;
      updateData.updated_at = new Date().toISOString();

      const result = await this.dataService.query('product_batches', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status)
        throw new InternalServerErrorException('Database update failed');
      return { status: true, message: 'Production batch updated successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('updateProduction error', { error, id, body });
      throw new InternalServerErrorException(
        'Failed to update production batch',
      );
    }
  }

  async updatePlanning(id: string, body: any, adminId: string) {
    try {
      const fields = this.showAddService.planningFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const updateData: Record<string, any> = {};
      for (const field of fields) {
        if (body[field.name] !== undefined) {
          const value =
            typeof body[field.name] === 'string'
              ? body[field.name].trim()
              : body[field.name];
          updateData[field.name] = value === '' ? null : value;
        }
      }

      updateData.updated_by = adminId;
      updateData.updated_at = new Date().toISOString();

      const result = await this.dataService.query('production_plans', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status)
        throw new InternalServerErrorException('Database update failed');
      return { status: true, message: 'Production plan updated successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('updatePlanning error', { error, id, body });
      throw new InternalServerErrorException(
        'Failed to update production plan',
      );
    }
  }
}
