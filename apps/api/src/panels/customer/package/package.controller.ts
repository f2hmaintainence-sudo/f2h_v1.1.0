import { Controller, Get, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';

@Controller({ path: 'customer/package', version: '1' })
export class PackageController {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
  ) {}

  @Get('balance')
  @UseGuards(AuthGuard('jwt'))
  async getpackageContainers(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;

    // Resolve customer via JOIN users
    const custRows = await this.db.query(
      `SELECT c.customer_id
       FROM customers c
       JOIN users u ON u.user_id = c.customer_id
       WHERE c.customer_id = $1 OR (u.email IS NOT NULL AND u.email = $2 AND u.email != '')
       LIMIT 1`,
      [userId, email || userId],
    );
    const customer = custRows?.[0];
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const txResult = await this.Data.query('customer_container_balances', {
      select: [
        'customer_container_balances.*',
        'containers.name AS package_name',
        'containers.is_returnable',
        'containers.quantity AS container_quantity',
      ],
      joins: [
        {
          type: 'left',
          table: 'containers',
          on: [['customer_container_balances.container_id', 'containers.container_id']],
        },
      ],
      where: [{ column: 'customer_container_balances.customer_id', operator: '=', value: customer.customer_id }],
    });

    return {
      status: true,
      data: txResult?.data || [],
    };
  }

}