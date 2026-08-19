import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FinanceService } from './services/finance.service';

@Controller({ path: ['admin/finance', 'admin/postpaid-bills', 'customer/bills', 'bills'], version: '1' })
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('outstandings')
  async getSubscriberOutstandings(@Query() query: any) {
    return await this.service.getSubscriberOutstandings(query);
  }

  @Get('outstandings/stats')
  async getSubscriberOutstandingsStats() {
    return await this.service.getSubscriberOutstandingsStats();
  }

  @Get('payments-report')
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
  async sendBillReminder(@Param('id') id: string) {
    return await this.service.sendBillReminder(id);
  }
}

@Controller({ path: 'receipt', version: '1' })
export class ReceiptController {
  constructor(private readonly service: FinanceService) {}

  @Get(['pdf/:id', ':id/pdf'])
  async getReceiptPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.getBillReceiptPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return res.end(buffer);
  }

  @Get(':id')
  async getReceipt(@Param('id') id: string) {
    return await this.service.getBillReceipt(id);
  }
}
