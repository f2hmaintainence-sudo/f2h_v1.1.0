import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { DeliveryShowAddService } from './showAdd.service';
import * as crypto from 'crypto';

@Injectable()
export class DeliverySaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: DeliveryShowAddService,
  ) { }

  async savePartner(body: any, adminId: string) {
    try {
      const fields = this.showAddService.partnerFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      if (body.phone) {
        const existing = await this.dataService.query('delivery_partners', {
          select: ['delivery_partner_id'],
          where: [
            {
              column: 'phone',
              operator: '=',
              value: String(body.phone).trim(),
            },
          ],
          limit: 1,
        });
        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { phone: 'Phone number already used by another delivery partner' },
          });
        }
      }

      const randomId = crypto.randomUUID ? crypto.randomUUID() : 'db_' + Date.now();
      const insertData: Record<string, any> = {
        id: randomId,
        delivery_partner_id: randomId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      for (const field of fields) {
        if (body[field.name] !== undefined && body[field.name] !== null && body[field.name] !== '') {
          let value = body[field.name];
          if (typeof value === 'string') value = value.trim();
          if (field.type === 'email' && typeof value === 'string') value = value.toLowerCase();
          insertData[field.name] = value;
        }
      }

      if (insertData.daily_salary !== undefined) insertData.daily_salary = Number(insertData.daily_salary);
      if (insertData.max_daily_orders !== undefined) insertData.max_daily_orders = Number(insertData.max_daily_orders);
      insertData.is_active = body.is_active === true || body.is_active === 'true' || body.is_active === 1 || body.is_active === '1';
      insertData.is_available = body.is_available === true || body.is_available === 'true' || body.is_available === 1 || body.is_available === '1';

      const result = await this.dataService.insert('delivery_partners', insertData);
      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'delivery_partner_create',
        target_type: 'delivery_partners',
        target_id: randomId,
        details: JSON.stringify({ full_name: insertData.full_name, phone: insertData.phone }),
      });

      return {
        status: true,
        message: 'Delivery partner created successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('savePartner create error', { error });
      throw new InternalServerErrorException('Failed to create delivery partner');
    }
  }
}
