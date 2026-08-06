import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { CustomerBillingService } from './services/customer-billing.service';
import {
  GenerateCustomerBillDto,
  GetCustomerBillsQueryDto,
} from './dto/customer-billing.dto';

/**
 * Requirement 7: Create a single API endpoint: POST /postpaid-bills/generate
 */
@Controller({ path: 'postpaid-bills', version: '1' })
export class CustomerBillingApiController {
  constructor(private readonly service: CustomerBillingService) {}

  @Get('eligible-customers')
  async getEligibleCustomers() {
    return await this.service.getEligibleCustomers();
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateBill(@Body(new ValidationPipe({ transform: true, skipMissingProperties: true })) dto: GenerateCustomerBillDto) {
    return await this.service.runMonthlyBatchBilling(dto || {});
  }
}

/**
 * Admin panel controllers for UI management & endpoints
 */
@Controller({ path: 'admin/postpaid-bills', version: '1' })
export class CustomerBillingAdminController {
  constructor(private readonly service: CustomerBillingService) {}

  @Get('eligible-customers')
  async getEligibleCustomersAdmin() {
    return await this.service.getEligibleCustomers();
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateBillAdmin(@Body(new ValidationPipe({ transform: true, skipMissingProperties: true })) dto: GenerateCustomerBillDto) {
    return await this.service.runMonthlyBatchBilling(dto || {});
  }

  @Get()
  async getBills(@Query(new ValidationPipe({ transform: true })) query: GetCustomerBillsQueryDto) {
    return await this.service.getBills(query);
  }

  @Get(':id')
  async getBillById(@Param('id') id: string) {
    return await this.service.getBillById(id);
  }

  @Get(':id/orders')
  async getBillOrders(@Param('id') id: string) {
    return await this.service.getBillById(id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async payBill(
    @Param('id') id: string,
    @Body() body: { amount: number; paymentMode?: string; referenceNumber?: string; notes?: string },
  ) {
    return await this.service.payBill(id, body.amount, body.paymentMode, body.referenceNumber, body.notes);
  }
}
