import { Controller, Get, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { DataService } from 'src/shared/database/Data.service';

@Controller({ path: 'customer/package', version: '1' })
export class PackageController {
  constructor(
    private readonly Data: DataService,
  ) {}

  @Get('balance')
  @UseGuards(AuthGuard('jwt'))
  async getpackageContainers(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;

    // Resolve customer
    let customerResult = await this.Data.query('customers', {
      where: [{ column: 'email', operator: '=', value: email }],
      limit: 1,
    });
    if (!customerResult?.data?.length) {
      customerResult = await this.Data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: userId }],
        limit: 1,
      });
    }
    const customer = customerResult?.data?.[0];
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

  @Get('transactions')
  @UseGuards(AuthGuard('jwt'))
  async getPackageTransactions(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;

    // Resolve customer
    let customerResult = await this.Data.query('customers', {
      where: [{ column: 'email', operator: '=', value: email }],
      limit: 1,
    });
    if (!customerResult?.data?.length) {
      customerResult = await this.Data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: userId }],
        limit: 1,
      });
    }
    const customer = customerResult?.data?.[0];
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const txResult = await this.Data.query('container_transactions', {
      select: [
        'container_transactions.*',
        'packaging_types.name AS package_name',
      ],
      joins: [
        {
          type: 'left',
          table: 'packaging_types',
          on: [['container_transactions.packaging_type_id', 'packaging_types.id']],
        },
      ],
      where: [{ column: 'container_transactions.customer_id', operator: '=', value: customer.customer_id }],
      orderBy: [{ column: 'container_transactions.created_at', direction: 'DESC' }],
    });

    return {
      status: true,
      data: txResult?.data || [],
    };
  }
}