import { Injectable } from '@nestjs/common';
import {
  FormHelper,
  FormResponse,
  FieldDef,
} from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';

@Injectable()
export class DeliveryShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
  ) { }

  async getPartnerAddForm(): Promise<FormResponse> {
    const branchesResult = await this.dataService.query('branches', {
      select: ['branch_id', 'branch_name', 'city'],
      orderBy: { column: 'branch_name', order: 'ASC' },
    });
    const branchOptions = (branchesResult?.data || []).map((b: any) => ({
      value: b.branch_id,
      label: `${b.branch_name || b.branch_id} ${b.city ? `(${b.city})` : ''}`.trim(),
    }));

    return this.formHelper.generateResponse({
      title: 'Add Delivery Partner',
      submitLabel: 'Create Partner',
      fields: this.partnerFields(branchOptions),
      script: '',
    });
  }

  partnerFields(branchOptions: { value: string; label: string }[] = []): FieldDef[] {
    return [
      {
        name: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: 'Enter full name',
        validation: { minLength: 2, maxLength: 150 },
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'phone',
        required: true,
        width: 'half',
        placeholder: '+91 9876543210',
        validation: {
          minLength: 10,
          maxLength: 20,
          pattern: '^\\+?[0-9]+$',
          message: 'Enter a valid phone number',
        },
      },
      {
        name: 'email',
        label: 'Email Address',
        type: 'email',
        required: false,
        width: 'half',
        placeholder: 'partner@example.com',
        validation: {
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          message: 'Enter a valid email',
        },
      },
      {
        name: 'branch_id',
        label: 'Assign Branch',
        type: 'select',
        required: false,
        width: 'half',
        options: branchOptions,
        optionsEndpoint: '/admin/zone/branches-list?all=true',
      },
      {
        name: 'daily_salary',
        label: 'Daily Salary (₹/day)',
        type: 'number',
        required: false,
        width: 'third',
        defaultValue: 0,
        placeholder: '0.00',
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'max_daily_orders',
        label: 'Max Daily Orders',
        type: 'number',
        required: false,
        width: 'third',
        defaultValue: 50,
        placeholder: '50',
        validation: { min: 0, max: 1000 },
      },
      {
        name: 'is_active',
        label: 'Partner Status (Active)',
        type: 'toggle',
        required: false,
        width: 'third',
        defaultValue: true,
      },
      {
        name: 'is_available',
        label: 'Currently Available',
        type: 'toggle',
        required: false,
        width: 'third',
        defaultValue: true,
      },
    ];
  }

  partnerEditFields(branchOptions: { value: string; label: string }[] = []): FieldDef[] {
    return [
      {
        name: 'branch_id',
        label: 'Assign Branch',
        type: 'select',
        required: false,
        width: 'full',
        options: branchOptions,
        optionsEndpoint: '/admin/zone/branches-list?all=true',
      },
      {
        name: 'daily_salary',
        label: 'Daily Salary (₹/day)',
        type: 'number',
        required: false,
        width: 'half',
        prefix: '₹',
        defaultValue: 0,
        placeholder: '0.00',
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'max_daily_orders',
        label: 'Max Daily Orders',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 50,
        placeholder: '50',
        validation: { min: 0, max: 1000 },
      },
      {
        name: 'is_active',
        label: 'Partner Status',
        description: 'Toggle account access & delivery assignment',
        type: 'toggle',
        required: false,
        width: 'full',
        defaultValue: true,
        toggleOptions: {
          onLabel: 'ACTIVE',
          offLabel: 'INACTIVE',
          pill: true,
        },
      },
    ];
  }
}
