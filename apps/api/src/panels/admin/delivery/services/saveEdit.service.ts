import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { DeliveryShowAddService } from './showAdd.service';
import { DeliveryManagementService } from '../delivery.service';

@Injectable()
export class DeliverySaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: DeliveryShowAddService,
    private readonly deliveryService: DeliveryManagementService,
  ) { }

  async savePartner(id: string, body: any, adminId: string) {
    try {
      // 1. Validate using field definitions from showAdd partnerEditFields
      const fields = this.showAddService.partnerEditFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 2. Unique check — phone (exclude self)
      if (body.phone) {
        const existing = await this.dataService.query('users', {
          select: ['user_id'],
          where: [
            {
              column: 'phone',
              operator: '=',
              value: String(body.phone).trim(),
            },
          ],
          limit: 10,
        });
        if (existing?.data?.length) {
          const others = existing.data.filter((r: any) => r.user_id !== id);
          if (others.length > 0) {
            throw new BadRequestException({
              status: false,
              message: 'Validation failed',
              errors: { phone: 'Phone number already used by another account' },
            });
          }
        }
      }

      // 3. Build update data
      const allowedDpFields = [
        'branch_id',
        'daily_salary',
        'max_daily_orders',
        'is_active',
        'is_available',
      ];
      const updateDpData: Record<string, any> = {};
      const updateUserData: Record<string, any> = {};

      if (body.phone !== undefined) updateUserData.phone = String(body.phone).trim();
      if (body.email !== undefined) updateUserData.email = String(body.email).toLowerCase().trim();
      if (body.full_name !== undefined) {
        const parts = String(body.full_name).trim().split(/\s+/);
        updateUserData.first_name = parts[0] || '';
        updateUserData.last_name = parts.slice(1).join(' ') || '';
        updateUserData.user_name = String(body.full_name).trim();
      }

      for (const fieldName of allowedDpFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (fieldName === 'daily_salary' || fieldName === 'max_daily_orders') {
            value = value === '' || value === null ? 0 : Number(value);
          }

          if (fieldName === 'is_active' || fieldName === 'is_available') {
            value = value === true || value === 'true' || value === 1 || value === '1';
          }

          if (fieldName === 'branch_id' && (value === '' || value === 'null')) {
            value = null;
          }

          updateDpData[fieldName] = value;
        }
      }

      if (Object.keys(updateDpData).length === 0 && Object.keys(updateUserData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      const now = new Date().toISOString();

      // 4. Update in database
      if (Object.keys(updateDpData).length > 0) {
        updateDpData.updated_at = now;
        await this.dataService.query('delivery_partners', {
          update: updateDpData,
          where: [{ column: 'delivery_partner_id', operator: '=', value: id }],
        });
      }

      if (Object.keys(updateUserData).length > 0) {
        updateUserData.updated_at = now;
        await this.dataService.query('users', {
          update: updateUserData,
          where: [{ column: 'user_id', operator: '=', value: id }],
        });
      }

      // 5. Trigger notifications via DeliveryManagementService if status/branch/salary changed
      if (
        body.is_active !== undefined ||
        body.is_available !== undefined ||
        body.branch_id !== undefined ||
        body.daily_salary !== undefined
      ) {
        try {
          await this.deliveryService.updatePartnerStatus(id, {
            is_active: updateDpData.is_active,
            is_available: updateDpData.is_available,
            branch_id: updateDpData.branch_id,
            daily_salary: updateDpData.daily_salary,
          });
        } catch (err) {
          this.developer.error('savePartner notification error', { err, id });
        }
      }

      // 6. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'delivery_partner_update',
        target_type: 'delivery_partners',
        target_id: id,
        details: JSON.stringify({ changes: [...Object.keys(updateDpData), ...Object.keys(updateUserData)] }),
      });

      return {
        status: true,
        message: 'Partner profile updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('savePartner edit error', { error, id });
      throw new InternalServerErrorException('Failed to update delivery partner');
    }
  }
}
