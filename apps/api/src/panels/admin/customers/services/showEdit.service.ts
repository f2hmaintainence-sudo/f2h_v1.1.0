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
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { CustomerShowAddService } from './showAdd.service';

@Injectable()
export class CustomerShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: CustomerShowAddService,
  ) { }

  async getCustomersEditForm(id: string): Promise<FormResponse> {
    try {
      // 1. Fetch existing record
      const result = await this.dataService.query('customers', {
        select: [
          'customers.*',
          'users.first_name',
          'users.last_name',
          'users.phone',
          'users.email',
        ],
        joins: [
          {
            type: 'left',
            table: 'users',
            on: [['customers.customer_id', 'users.user_id']],
          },
        ],
        where: [{ column: 'customers.customer_id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Customer not found');
      }

      const custData = result.data[0];
      custData.full_name = custData.full_name || `${custData.first_name || ''} ${custData.last_name || ''}`.trim();

      // 2. Use SAME fields from showAdd (no duplication)
      const fields: FieldDef[] = [
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
          label: 'Phone',
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
          label: 'Email',
          type: 'email',
          required: false,
          width: 'half',
          placeholder: 'customer@example.com',
          validation: {
            pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
            message: 'Enter a valid email',
          },
        },
        // {
        //   name: 'zone_id',
        //   label: 'Zone',
        //   type: 'text',
        //   required: false,
        //   width: 'half',
        //   placeholder: 'e.g. zone UUID',
        //   validation: { maxLength: 50 },
        // },
        {
          name: 'referral_status',
          label: 'Referral Code',
          type: 'text',
          required: false,
          width: 'half',
          placeholder: 'e.g. REF-ABC123',
          validation: { maxLength: 20 },
        },
        {
          name: 'postpaid_credit_limit',
          label: 'Postpaid Credit Limit (₹)',
          type: 'number',
          required: false,
          width: 'third',
          defaultValue: 0,
          placeholder: '0',
          validation: { min: 0, max: 999999 },
        },
        {
          name: 'is_postpaid_enabled',
          label: 'Postpaid Enabled',
          type: 'toggle',
          required: false,
          width: 'third',
          defaultValue: false,
        },
        {
          name: 'is_blocked',
          label: 'Blocked',
          type: 'toggle',
          required: false,
          width: 'third',
          defaultValue: false,
        },
        {
          name: 'block_reason',
          label: 'Block Reason',
          type: 'textarea',
          required: false,
          width: 'full',
          placeholder: 'Reason for blocking (if applicable)',
          validation: { maxLength: 1000 },
          visibleWhen: { field: 'is_blocked', value: true },
        },
      ];
      // 3. Return form with pre-filled data
      return this.formHelper.generateResponse({
        title: 'Edit Customer',
        submitLabel: 'Update Customer',
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
  // WALLET TRANSACTIONS — Show Edit
  // ═══════════════════════════════════════════════════════════════

  async getWalletTransactionsEditForm(id: string): Promise<FormResponse> {
    try {
      // 1. Fetch existing record
      const result = await this.dataService.query('customer_wallet_transactions', {
        select: ['wallet_transactions.*'],
        where: [{ column: 'wallet_transactions.id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Wallet transaction not found');
      }

      // 2. Use SAME fields from showAdd
      const fields = this.showAddService.walletTransactionsFields();

      // 3. Return form with pre-filled data
      return this.formHelper.generateResponse({
        title: 'Edit Wallet Transaction',
        submitLabel: 'Update Transaction',
        fields,
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getWalletTransactionsEditForm error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to load wallet transaction edit form',
      );
    }
  }
}
