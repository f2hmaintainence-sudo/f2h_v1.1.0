import { Injectable } from '@nestjs/common';
import {
  FormHelper,
  FormResponse,
  FieldDef,
} from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';

@Injectable()
export class BranchShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly Data: DataService,
  ) { }

  // Expose field definitions for validation reuse in saveEdit
  branchFields(): FieldDef[][] {
    return [
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
          placeholder: 'e.g. Kuppam',
          validation: { maxLength: 100 },
        },
        {
          name: 'state',
          label: 'State',
          type: 'text',
          required: false,
          width: 'half',
          placeholder: 'e.g. Andhra Pradesh',
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
          name: 'lat',
          label: 'Latitude',
          type: 'number',
          required: false,
          width: 'half',
          placeholder: 'e.g. 12.9716',
        },
        {
          name: 'lng',
          label: 'Longitude',
          type: 'number',
          required: false,
          width: 'half',
          placeholder: 'e.g. 77.5946',
        },
        {
          name: 'delivery_radius_km',
          label: 'Delivery Radius (km)',
          type: 'number',
          required: false,
          width: 'half',
          placeholder: '5',
          defaultValue: 5,
          validation: { min: 0.5, max: 50 },
        },
        {
          name: 'sector_count',
          label: 'Number of Sectors',
          type: 'number',
          required: false,
          width: 'half',
          placeholder: '3',
          defaultValue: 3,
          validation: { min: 1, max: 20 },
        },
      ],
    ];
  }

  async branchShowAddForm(): Promise<FormResponse> {
    const fields = this.branchFields();

    const response = this.formHelper.generateResponse({
      title: 'Add Branch',
      fields,
      script: '',
    });
    return {
      ...response,
      submitUrl: '/admin/branch/saveAdd',
      submitMethod: 'POST',
    } as any;
  }

  // ═══════════════════════════════════════════════════════════════
  // ZONE — Show Add Form (legacy)
  // ═══════════════════════════════════════════════════════════════

  async zoneShowAddForm(): Promise<FormResponse> {
    // Fetch branches for dropdown
    const branchesResult = await this.Data.query('branches', {
      select: ['branch_id', 'branch_name', 'city', 'state'],
      where: [{ column: 'is_active', operator: '=', value: true }],
    });

    const branchOptions = (branchesResult?.data || []).map((b: any) => ({
      label: `${b.branch_name}${b.city ? ` — ${b.city}` : ''}`,
      value: b.branch_id,
    }));

    const fields: FieldDef[][] = [
      [
        {
          name: 'name',
          label: 'Zone Name',
          type: 'text',
          required: true,
          width: 'half',
          placeholder: 'e.g. KR Puram',
          validation: { minLength: 2, maxLength: 100 },
        },
        {
          name: 'branch_id',
          label: 'Branch',
          type: 'select',
          required: true,
          width: 'half',
          options: branchOptions,
          placeholder: 'Select Branch',
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          required: false,
          width: 'full',
          placeholder: 'Brief description of the zone area',
          validation: { maxLength: 500 },
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

    const response = this.formHelper.generateResponse({
      title: 'Add Zone',
      fields,
      script: '',
    });
    return {
      ...response,
      submitUrl: '/admin/zone/saveAdd',
      submitMethod: 'POST',
    } as any;
  }
}

@Injectable()
export class StaffsShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly Data: DataService,
  ) {}

  async getStaffsForm(): Promise<FormResponse> {
    const branchesResult = await this.Data.query('branches', {
      select: ['branch_id', 'branch_name'],
      where: [{ column: 'is_active', operator: '=', value: true }],
    });
    const branchOptions = (branchesResult?.data || []).map((b: any) => ({
      value: b.branch_id,
      label: b.branch_name,
    }));

    const rolesResult = await this.Data.query('roles', {
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
          validation: { minLength: 3, maxLength: 50 },
        },
        {
          name: 'email',
          label: 'Email Address',
          type: 'email',
          required: true,
          width: 'half',
          placeholder: 'staff@form2home.com',
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
          validation: {
            minLength: 10,
            maxLength: 15,
            pattern: '^\\+?[0-9]+$',
            message: 'Enter a valid phone number',
          },
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          required: true,
          width: 'half',
          placeholder: 'Min 8 chars, 1 uppercase, 1 special char',
          validation: { minLength: 8 },
        },

        {
          name: 'role_id',
          label: 'Role',
          type: 'select',
          required: true,
          width: 'half',
          options: roleOptions,
          defaultValue: roleOptions[0]?.value || '',
        },
        {
          name: 'branch_id',
          label: 'Assign to Branch',
          type: 'select',
          required: false,
          width: 'half',
          options: [{ value: '', label: 'Central (No Branch)' }, ...branchOptions],
          defaultValue: '',
        },

        {
          name: 'department',
          label: 'Department',
          type: 'text',
          required: false,
          width: 'half',
          placeholder: 'e.g. Delivery, Operations, Billing',
        },
        {
          name: 'designation',
          label: 'Designation',
          type: 'text',
          required: false,
          width: 'half',
          placeholder: 'e.g. Manager, Supervisor',
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

    const response = this.formHelper.generateResponse({
      title: 'Add Staff Member',
      fields,
      script: '',
    });

    return {
      ...response,
      submitUrl: '/admin/branch/staffs/saveAdd',
      submitMethod: 'POST',
    } as any;
  }
}