import { Controller, Get, Query } from '@nestjs/common';
import { CustomerTableService } from '../services/table.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/customer', version: '1' })
export class CustomerController {
  constructor(private readonly tableService: CustomerTableService) { }

  @Get('table')
  async getCustomerTable(@Query() query: any) {
    return this.tableService.getCustomerTable(query);
  }
}
