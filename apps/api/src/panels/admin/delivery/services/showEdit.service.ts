import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  FormHelper,
  FormResponse,
} from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { DeliveryShowAddService } from './showAdd.service';

@Injectable()
export class DeliveryShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: DeliveryShowAddService,
  ) {}

  async getPartnerEditForm(id: string): Promise<FormResponse> {
    try {
      // 1. Fetch existing record
      const result = await this.dataService.query('delivery_partners', {
        select: ['delivery_partners.*'],
        where: [{ column: 'delivery_partners.delivery_partner_id', operator: '=', value: id }],
        limit: 1,
      });

      const row = result?.data?.[0];

      if (!row) {
        throw new BadRequestException('Delivery partner not found');
      }

      // Fetch user identity fields (full_name, phone, email) from users table
      const userRes = await this.dataService.query('users', {
        select: ['first_name', 'last_name', 'phone', 'email', 'user_name'],
        where: [{ column: 'user_id', operator: '=', value: id }],
        limit: 1,
      });
      const userRow = userRes?.data?.[0];
      if (userRow) {
        row.full_name = [userRow.first_name, userRow.last_name].filter(Boolean).join(' ').trim() || userRow.user_name || '';
        row.phone = userRow.phone || '';
        row.email = userRow.email || '';
      }

      // 2. Fetch branches for dynamic options
      const branchesResult = await this.dataService.query('branches', {
        select: ['branch_id', 'branch_name', 'city'],
        orderBy: { column: 'branch_name', order: 'ASC' },
      });
      const branchOptions = (branchesResult?.data || []).map((b: any) => ({
        value: b.branch_id,
        label: `${b.branch_name || b.branch_id} ${b.city ? `(${b.city})` : ''}`.trim(),
      }));

      const fields = this.showAddService.partnerEditFields(branchOptions);

      // 3. Return form with pre-filled data
      return this.formHelper.generateResponse({
        title: 'Edit Partner Profile',
        subtitle: row.full_name || 'Delivery Partner',
        maxWidth: '480px',
        submitLabel: 'Save Changes',
        fields,
        data: row,
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getPartnerEditForm error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load delivery partner edit form',
      );
    }
  }
}
