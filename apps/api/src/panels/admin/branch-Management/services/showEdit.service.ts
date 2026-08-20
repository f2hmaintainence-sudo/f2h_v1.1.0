import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  FormHelper,
  FormResponse,
  FieldDef,
} from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { BranchShowAddService } from './showAdd.service';

@Injectable()
export class BranchShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly showAddService: BranchShowAddService,
  ) {}

  async getCustomersEditForm(id: string): Promise<FormResponse> {
    try {
      // 1. Fetch existing record
      const result = await this.dataService.query('customers', {
        select: ['customers.*'],
        where: [{ column: 'customers.id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Customer not found');
      }

      // 2. Use SAME fields from showAdd (no duplication)
      const fields: FieldDef[][] = [
        [
          {
            name: 'branch_name',
            label: 'Branch Name',
            type: 'text',
            required: true,
            width: 'half',
            placeholder: 'Enter branch name',
            validation: { minLength: 2, maxLength: 100 },
          },
          {
            name: 'branch_code',
            label: 'Branch Code',
            type: 'text',
            required: true,
            width: 'half',
            placeholder: 'e.g. BR-001',
            validation: { maxLength: 20 },
          },
          {
            name: 'city',
            label: 'City',
            type: 'text',
            required: false,
            width: 'half',
            placeholder: 'e.g. Chennai',
            validation: { maxLength: 100 },
          },
          {
            name: 'state',
            label: 'State',
            type: 'text',
            required: false,
            width: 'half',
            placeholder: 'e.g. Tamil Nadu',
            validation: { maxLength: 100 },
          },
          {
            name: 'is_active',
            label: 'Is Active',
            type: 'toggle',
            required: false,
            width: 'half',
            defaultValue: true,
          },
        ],
        [
          {
            name: 'branch_name',
            label: 'Branch Name',
            type: 'text',
            required: true,
            width: 'half',
            placeholder: 'Enter branch name',
            validation: { minLength: 2, maxLength: 100 },
          },
          {
            name: 'branch_code',
            label: 'Branch Code',
            type: 'text',
            required: true,
            width: 'half',
            placeholder: 'e.g. BR-001',
            validation: { maxLength: 20 },
          },
          {
            name: 'city',
            label: 'City',
            type: 'text',
            required: false,
            width: 'half',
            placeholder: 'e.g. Chennai',
            validation: { maxLength: 100 },
          },
          {
            name: 'state',
            label: 'State',
            type: 'text',
            required: false,
            width: 'half',
            placeholder: 'e.g. Tamil Nadu',
            validation: { maxLength: 100 },
          },
          {
            name: 'is_active',
            label: 'Is Active',
            type: 'toggle',
            required: false,
            width: 'half',
            defaultValue: true,
          },
        ],
      ];
      // 3. Return form with pre-filled data
      return this.formHelper.generateResponse({
        title: 'Edit Branch',
        submitLabel: 'Update Branch',
        fields,
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getCustomersEditForm error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load customer edit form',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ZONE — Edit Form
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // ZONE — Raw Edit Data (for EditZonePopup frontend)
  // ═══════════════════════════════════════════════════════════════

}

@Injectable()
export class StaffsShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async getStaffsEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('management_staff', {
        select: [
          'management_staff.*',
          'users.email',
          'users.role_id',
        ],
        joins: [
          {
            type: 'LEFT',
            table: 'users',
            on: [['users.user_id', 'management_staff.user_id']],
          },
        ],
        where: [{ column: 'management_staff.management_id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Staff member not found');
      }

      const staff = result.data[0];

      const branchesResult = await this.dataService.query('branches', {
        select: ['branch_id', 'branch_name'],
        where: [{ column: 'is_active', operator: '=', value: true }],
      });
      const branchOptions = (branchesResult?.data || []).map((b: any) => ({
        value: b.branch_id,
        label: b.branch_name,
      }));

      const rolesResult = await this.dataService.query('roles', {
        select: ['role_id', 'name'],
        where: [
          { column: 'is_active', operator: '=', value: 1 },
          { column: 'role_id', operator: '!=', value: 'CUSTOMER' },
        ],
      });
      const roleOptions = (rolesResult?.data || []).map((r: any) => ({
        value: r.role_id,
        label: r.name,
      }));

      const fields: FieldDef[][] = [
        [
          {
            name: 'user_name',
            label: 'Staff Username',
            type: 'text',
            required: true,
            width: 'half',
            placeholder: 'Enter username',
            defaultValue: staff.user_name,
            validation: { minLength: 3, maxLength: 50 },
          },
          {
            name: 'email',
            label: 'Email Address',
            type: 'email',
            required: true,
            width: 'half',
            placeholder: 'staff@form2home.com',
            defaultValue: staff.email,
            validation: {
              pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
              message: 'Enter a valid email address',
            },
          },

          {
            name: 'phone',
            label: 'Phone Number',
            type: 'phone',
            required: true,
            width: 'half',
            placeholder: 'e.g. +919876543210',
            defaultValue: staff.phone,
            validation: {
              minLength: 10,
              maxLength: 15,
              pattern: '^\\+?[0-9]+$',
              message: 'Enter a valid phone number',
            },
          },
          {
            name: 'role_id',
            label: 'Role',
            type: 'select',
            required: true,
            width: 'half',
            options: roleOptions,
            defaultValue: staff.role_id,
          },

          {
            name: 'branch_id',
            label: 'Assign to Branch',
            type: 'select',
            required: false,
            width: 'half',
            options: [{ value: '', label: 'Central (No Branch)' }, ...branchOptions],
            defaultValue: staff.branch_id || '',
          },
          {
            name: 'department',
            label: 'Department',
            type: 'text',
            required: false,
            width: 'half',
            placeholder: 'e.g. Delivery, Operations, Billing',
            defaultValue: staff.department || '',
          },
 
          {
            name: 'designation',
            label: 'Designation',
            type: 'text',
            required: false,
            width: 'half',
            placeholder: 'e.g. Manager, Supervisor',
            defaultValue: staff.designation || '',
          },
          {
            name: 'is_active',
            label: 'Is Active',
            type: 'toggle',
            required: false,
            width: 'half',
            defaultValue: staff.is_active === true || staff.is_active === 1,
          },
        ],
      ];

      const response = this.formHelper.generateResponse({
        title: 'Edit Staff Member',
        fields,
        script: '',
      });

      return {
        ...response,
        submitUrl: `/admin/branch/staffs/${id}/saveEdit`,
        submitMethod: 'POST',
      } as any;
    } catch (error) {
      this.developer.error('getStaffsEditForm error', { error, id });
      throw new InternalServerErrorException('Failed to retrieve staff edit form');
    }
  }
}
