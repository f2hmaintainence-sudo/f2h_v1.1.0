import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { DeliveryShowAddService } from './showAdd.service';
import { generateId } from '../../../../helpers/RandomHelper';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

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
        const existing = await this.dataService.query('users', {
          select: ['user_id'],
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
            errors: { phone: 'Phone number already used by another account' },
          });
        }
      }

      if (body.email) {
        const existingEmail = await this.dataService.query('users', {
          select: ['user_id'],
          where: [
            {
              column: 'email',
              operator: '=',
              value: String(body.email).toLowerCase().trim(),
            },
          ],
          limit: 1,
        });
        if (existingEmail?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { email: 'Email address already used by another account' },
          });
        }
      }

      const partnerId = generateId('F2H', 9);
      const nameParts = String(body.full_name || body.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Partner';
      const lastName = nameParts.slice(1).join(' ') || '';
      const now = new Date().toISOString();
      const defaultPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      const dailySalary = body.daily_salary !== undefined && body.daily_salary !== '' ? Number(body.daily_salary) : 0;
      const maxDailyOrders = body.max_daily_orders !== undefined && body.max_daily_orders !== '' ? Number(body.max_daily_orders) : 50;
      const isActive = body.is_active === true || body.is_active === 'true' || body.is_active === 1 || body.is_active === '1';
      const isAvailable = body.is_available === true || body.is_available === 'true' || body.is_available === 1 || body.is_available === '1';

      await this.dataService.executeTransaction(async (tx) => {
        // 1. Insert into users (single source of truth for identity)
        await this.dataService.insert('users', {
          user_id: partnerId,
          first_name: firstName,
          last_name: lastName,
          user_name: [firstName, lastName].filter(Boolean).join(' ').trim(),
          phone: body.phone ? String(body.phone).trim() : null,
          email: body.email ? String(body.email).toLowerCase().trim() : null,
          password: hashedPassword,
          role_id: 'DELIVERY_PARTNER',
          account_status: 'active',
          created_by: adminId,
          created_at: now,
          updated_at: now,
        }, { transaction: tx });

        // 2. Insert into delivery_partners (domain satellite)
        await this.dataService.insert('delivery_partners', {
          delivery_partner_id: partnerId,
          branch_id: body.branch_id || null,
          daily_salary: dailySalary,
          max_daily_orders: maxDailyOrders,
          is_active: isActive,
          is_available: isAvailable,
          vehicle_type: 'BIKE',
          vehicle_number: 'N/A',
          created_at: now,
          updated_at: now,
        }, { transaction: tx });

        // 3. Insert into role_assignments
        await this.dataService.insert('role_assignments', {
          id: Date.now() + Math.floor(Math.random() * 1000),
          user_id: partnerId,
          role_id: 'DELIVERY_PARTNER',
          is_active: 1,
          created_at: now,
          updated_at: now,
        }, { transaction: tx });
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'delivery_partner_create',
        target_type: 'delivery_partners',
        target_id: partnerId,
        details: JSON.stringify({ full_name: body.full_name, phone: body.phone }),
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
