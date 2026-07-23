import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { InventoryShowAddService } from './showAdd.service';

@Injectable()
export class InventorySaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: InventoryShowAddService,
  ) {}

  async updateMovement(id: string, body: any, adminId: string) {
    try {
      const fields = this.showAddService.movementFields(
        await this.showAddService.getVariantOptions(),
      );
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
          let value = body[field.name];
          if (typeof value === 'string') value = value.trim();
          if (field.name === 'variant_id' || field.name === 'quantity')
            value = Number(value);
          updateData[field.name] = value === '' ? null : value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      updateData.updated_at = new Date().toISOString();

      const result = await this.dataService.query('stock_movements', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'stock_movement_update',
        target_type: 'stock_movements',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      return {
        status: true,
        message: 'Stock movement updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.developer.error('updateMovement error', { error, id, body });
      throw new InternalServerErrorException('Failed to update stock movement');
    }
  }
}
