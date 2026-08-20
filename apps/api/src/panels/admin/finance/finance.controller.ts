import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FinanceService } from './services/finance.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

/**
 * Admin finance surface: outstanding balances, payment reports, and bill settlement.
 *
 * This controller previously also answered on `customer/bills` and `bills` with no
 * guard at all, which made every subscriber's outstanding balance and every invoice
 * PDF readable — and `POST outstandings/:id/pay` callable — without credentials.
 * The customer-facing receipt routes now live in `CustomerBillsController` below,
 * where they are scoped to the caller.
 */
@Controller({ path: ['admin/finance', 'admin/postpaid-bills'], version: '1' })
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get(['billing', 'bills'])
  async getAllCustomerBills(@Query() query: any) {
    return await this.service.getAllCustomerBills(query);
  }

  @Get(['billing/stats', 'bills/stats'])
  async getBillingStats(@Query('days') days?: number) {
    return await this.service.getBillingStats(days ? Number(days) : 30);
  }

  @Get('outstandings')
  async getSubscriberOutstandings(@Query() query: any) {
    return await this.service.getSubscriberOutstandings(query);
  }

  @Get('outstandings/stats')
  async getSubscriberOutstandingsStats() {
    return await this.service.getSubscriberOutstandingsStats();
  }

  @Get(['payments', 'payments-report', 'payment-transactions'])
  async getCombinedPayments(@Query() query: any) {
    return await this.service.getCombinedPayments(query);
  }

  @Get('payments-stats')
  async getPaymentsStats(@Query('days') days?: number) {
    return await this.service.getPaymentsStats(days ? Number(days) : 30);
  }

  @Get(['receipt/:id/pdf', ':id/pdf', 'pdf/:id'])
  async getBillReceiptPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.getBillReceiptPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return res.end(buffer);
  }

  @Get(['receipt/:id', ':id/receipt'])
  async getBillReceipt(@Param('id') id: string) {
    return await this.service.getBillReceipt(id);
  }

  @Post('outstandings/:id/pay')
  @HttpCode(HttpStatus.OK)
  async payBill(
    @Param('id') id: string,
    @Body() body: { amount: number; paymentMode?: string; referenceNumber?: string; notes?: string },
  ) {
    return await this.service.payBill(id, body.amount, body.paymentMode, body.referenceNumber, body.notes);
  }

  @Post('outstandings/:id/remind')
  @HttpCode(HttpStatus.OK)
  async sendBillReminder(@Param('id') id: string, @Body() body?: { message?: string }) {
    return await this.service.sendBillReminder(id, body?.message);
  }

  @Post('outstandings/bulk-remind')
  @HttpCode(HttpStatus.OK)
  async sendBulkBillReminders(
    @Body() body: { billIds?: string[]; overdueOnly?: boolean; customMessage?: string },
  ) {
    return await this.service.sendBulkBillReminders(body);
  }
}

/**
 * Receipts a customer may read. Every lookup is filtered by the customer id on the
 * token, so an authenticated customer can only fetch their own invoices. Admins
 * reach the same data through `FinanceController` without the scope.
 */
@Controller({ path: ['customer/bills', 'bills', 'receipt'], version: '1' })
export class CustomerBillsController {
  constructor(private readonly service: FinanceService) {}

  @Get(['receipt/:id/pdf', ':id/pdf', 'pdf/:id'])
  async getOwnReceiptPdf(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as any;
    const userId = user?.user_id || user?.id;
    const userRole = user?.role;
    const isPrivileged = userRole === ROLE.ADMIN || userRole === ROLE.SUPER_ADMIN;

    const { buffer, filename } = await this.service.getBillReceiptPdf(
      id,
      isPrivileged ? undefined : userId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return res.end(buffer);
  }

  @Get(['receipt/:id', ':id/receipt', ':id'])
  async getOwnReceipt(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id || user?.id;
    const userRole = user?.role;
    const isPrivileged = userRole === ROLE.ADMIN || userRole === ROLE.SUPER_ADMIN;

    return await this.service.getBillReceipt(id, isPrivileged ? undefined : userId);
  }
}
