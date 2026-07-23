import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FormHelper, FormResponse, FieldDef } from '../../../../helpers/FormHelper';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class DeliveryLeaveShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async getLeaveRequestEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('delivery_leave_requests', {
        select: ['*'],
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });

      const row = result?.data?.[0];
      if (!row) {
        throw new BadRequestException('Leave request not found');
      }

      const fields: FieldDef[] = [
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
          width: 'full',
        },
        {
          name: 'admin_remarks',
          label: 'Admin Remarks',
          type: 'textarea',
          required: false,
          placeholder: 'Enter any remarks for approval/rejection',
          width: 'full',
        },
      ];

      return this.formHelper.generateResponse({
        title: 'Manage Leave Request',
        subtitle: `Request #${row.id}`,
        maxWidth: '480px',
        submitLabel: 'Update Status',
        fields,
        data: row,
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getLeaveRequestEditForm error', { error, id });
      throw new InternalServerErrorException('Failed to load leave request edit form');
    }
  }
}

@Injectable()
export class DeliveryLeaveSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async saveLeaveRequest(id: string, body: any, adminId: string) {
    try {
      const fields: FieldDef[] = [
        { name: 'status', type: 'select', required: true },
        { name: 'admin_remarks', type: 'textarea', required: false },
      ];

      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const updateData = {
        status: body.status,
        admin_remarks: body.admin_remarks || null,
        updated_at: new Date().toISOString(),
      };

      const result = await this.dataService.query('delivery_leave_requests', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to update leave request');
      }

      return {
        status: true,
        message: 'Leave request updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveLeaveRequest error', { error, id });
      throw new InternalServerErrorException('Failed to update leave request');
    }
  }

  async deleteLeaveRequest(id: string) {
    try {
      const result = await this.dataService.softDelete('delivery_leave_requests', [
        { column: 'id', operator: '=', value: Number(id) }
      ]);

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete leave request');
      }

      return {
        status: true,
        message: 'Leave request deleted successfully',
      };
    } catch (error) {
      this.developer.error('deleteLeaveRequest error', { error, id });
      throw new InternalServerErrorException('Failed to delete leave request');
    }
  }
}
