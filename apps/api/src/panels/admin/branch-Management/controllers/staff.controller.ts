import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Req,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { StaffsTableService } from '../services/table.service';
import { StaffsShowAddService } from '../services/showAdd.service';
import { StaffsSaveAddService } from '../services/saveAdd.service';
import { StaffsShowEditService } from '../services/showEdit.service';
import { StaffsSaveEditService } from '../services/saveEdit.service';
import { DataService } from '../../../../shared/database/Data.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'admin/branch/staffs', version: '1' })
export class StaffsrController {
  constructor(
    private readonly tableService: StaffsTableService,
    private readonly showAddService: StaffsShowAddService,
    private readonly saveAddService: StaffsSaveAddService,
    private readonly showEditService: StaffsShowEditService,
    private readonly saveEditService: StaffsSaveEditService,
    private readonly dataService: DataService,
  ) {}

  @Get('table')
  async getStaffsTable(@Query() query: any) {
    return this.tableService.getStaffsTable(query);
  }

  @Get('showAdd')
  async showStaffAdd() {
    return this.showAddService.getStaffsForm();
  }

  @Post('saveAdd')
  async saveStaffAdd(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveStaff(body, adminId);
  }

  @Get(':id/showEdit')
  async showStaffEdit(@Param('id') id: string) {
    return this.showEditService.getStaffsEditForm(id);
  }

  @Post(':id/saveEdit')
  async saveStaffEdit(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.saveStaffEdit(id, body, adminId);
  }

  @Get(':id/view')
  async getStaffView(@Param('id') id: string) {
    try {
      const result = await this.dataService.query('management_staff', {
        select: [
          'management_staff.*',
          'users.email',
          'users.role_id',
          'branches.branch_name',
        ],
        joins: [
          {
            type: 'LEFT',
            table: 'users',
            on: [['users.user_id', 'management_staff.user_id']],
          },
          {
            type: 'LEFT',
            table: 'branches',
            on: [['branches.branch_id', 'management_staff.branch_id']],
          },
        ],
        where: [{ column: 'management_staff.management_id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Staff member not found');
      }

      return {
        status: true,
        data: result.data[0],
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to retrieve staff details');
    }
  }

  @Delete(':id/delete')
  async deleteStaff(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';

    const currentRows = await this.dataService.query('management_staff', {
      select: ['user_id'],
      where: [{ column: 'management_id', operator: '=', value: id }],
      limit: 1,
    });

    if (!currentRows?.data?.length) {
      throw new BadRequestException('Staff member not found');
    }

    const userId = currentRows.data[0].user_id;
    const now = new Date().toISOString();

    await this.dataService.executeTransaction(async (tx) => {
      // Soft delete management_staff
      await this.dataService.update(
        'management_staff',
        { deleted_at: now, is_active: false },
        [{ column: 'management_id', operator: '=', value: id }],
        { transaction: tx }
      );

      // Soft delete user
      await this.dataService.update(
        'users',
        { deleted_at: now, account_status: 'deleted' },
        [{ column: 'user_id', operator: '=', value: userId }],
        { transaction: tx }
      );
    });

    try {
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'staff_delete',
        target_type: 'management_staff',
        target_id: id,
        after_data: JSON.stringify({ deleted_at: now }),
      });
    } catch (auditError) {
      // ignore
    }

    return { status: true, message: 'Staff member deleted successfully' };
  }
}
