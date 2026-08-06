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
export class ProductionSaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: ProductionShowAddService,
  ) {}

  async saveProduction(body: any, adminId: string) {
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

      const insertData = this.pickFields(
        fields.map((field) => field.name),
        body,
      );
      insertData.batch_id = insertData.batch_id?.trim() ||
        `BATCH-${Date.now()}-${Math.floor(Math.random() * 900) + 100}`;
      insertData.status = insertData.status || 'active';
      insertData.quantity = Number(insertData.quantity || 0);
      insertData.available_quantity = Number(
        insertData.available_quantity !== undefined && insertData.available_quantity !== ''
          ? insertData.available_quantity
          : insertData.quantity,
      );
      insertData.damaged_quantity = Number(insertData.damaged_quantity || 0);
      insertData.created_by = adminId;
      insertData.updated_by = adminId;

      const result = await this.dataService.insert(
        'product_batches',
        insertData,
      );
      if (!result?.status) {
        throw new InternalServerErrorException(
          result?.message || 'Database insert failed',
        );
      }

      return {
        status: true,
        message: 'Production batch created successfully',
        id: result.data?.id ?? result.id,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveProduction error', { error, body });
      throw new InternalServerErrorException(
        'Failed to create production batch',
      );
    }
  }

  async savePlanning(body: any, adminId: string) {
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

      const insertData = this.pickFields(
        fields.map((field) => field.name),
        body,
      );
      
      insertData.production_id = `PLAN-${Date.now()}-${Math.floor(Math.random() * 900) + 100}`;
      insertData.production_status = 'planned';
      insertData.planned_quantity = Number(insertData.planned_quantity || 0);
      insertData.created_by = adminId;
      insertData.updated_by = adminId;

      // Basic Raw Material Estimation (Mock Logic)
      // In a real scenario, this would come from a BOM table
      insertData.raw_material_required = insertData.planned_quantity * 1.05; // 5% wastage

      const result = await this.dataService.insert(
        'production_plans',
        insertData,
      );
      
      if (!result?.status) {
        throw new InternalServerErrorException(
          result?.message || 'Database insert failed',
        );
      }

      return {
        status: true,
        message: 'Production plan created successfully',
        id: result.data?.id ?? result.id,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('savePlanning error', { error, body });
      throw new InternalServerErrorException(
        'Failed to create production plan',
      );
    }
  }

  private pickFields(fields: string[], body: any) {
    const data: Record<string, any> = {};
    for (const field of fields) {
      if (body[field] !== undefined) {
        const value =
          typeof body[field] === 'string' ? body[field].trim() : body[field];
        data[field] = value === '' ? null : value;
      }
    }
    return data;
  }
}
