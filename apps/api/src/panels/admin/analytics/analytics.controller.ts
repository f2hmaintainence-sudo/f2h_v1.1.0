import { Controller, Get, Post, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── Revenue Reports ──
  @Get('revenue')
  async getRevenueReport(@Query() query: any) {
    return this.analyticsService.getRevenueReport(query);
  }

  /**
   * Full revenue & payments report: branch-wise, payment-type-wise,
   * subscription vs one-time, and billing collection status.
   * Filters: from/to (or days), branch_id, order_source, payment_mode.
   */
  @Get('revenue/report')
  async getRevenuePaymentsReport(@Query() query: any) {
    return this.analyticsService.getRevenuePaymentsReport(query);
  }

  @Get('revenue/report/export/csv')
  async exportRevenueReportCsv(@Query() query: any, @Res() res: Response) {
    const csv = await this.analyticsService.exportRevenueCsv(query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-report-${stamp}.csv"`);
    res.send(csv);
  }

  @Get('revenue/report/export/pdf')
  async exportRevenueReportPdf(@Query() query: any, @Res() res: Response) {
    const buffer = await this.analyticsService.exportRevenueReportPdf(query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-report-${stamp}.pdf"`);
    res.end(buffer);
  }

  @Get('subscription-revenue')
  async getSubscriptionRevenue(@Query() query: any) {
    return this.analyticsService.getSubscriptionRevenue(query);
  }

  // ── Wallet & Payment Reports ──
  @Get('wallet')
  async getWalletReport(@Query() query: any) {
    return this.analyticsService.getWalletReport(query);
  }


  @Get('outstanding')
  async getOutstandingBalances(@Query() query: any) {
    return this.analyticsService.getOutstandingBalances(query);
  }

  @Get('refunds')
  async getRefundReport(@Query() query: any) {
    return this.analyticsService.getRefundReport(query);
  }

  @Get('refunds/list')
  async getRefundsList(@Query() query: any) {
    return this.analyticsService.getRefundsList(query);
  }

  @Post('refunds/:id/process')
  async processRefund(@Param('id') id: string) {
    return this.analyticsService.processRefund(id);
  }

  // ── Growth Reports ──
  @Get('customer-growth')
  async getCustomerGrowth(@Query() query: any) {
    return this.analyticsService.getCustomerGrowth(query);
  }

  @Get('subscription-growth')
  async getSubscriptionGrowth(@Query() query: any) {
    return this.analyticsService.getSubscriptionGrowth(query);
  }

  @Get('retention')
  async getRetention(@Query() query: any) {
    return this.analyticsService.getRetention(query);
  }

  // ── Performance Reports ──
  @Get('product-performance')
  async getProductPerformance(@Query() query: any) {
    return this.analyticsService.getProductPerformance(query);
  }

  @Get('branch-performance')
  async getBranchPerformance(@Query() query: any) {
    return this.analyticsService.getBranchPerformance(query);
  }

  @Get('branch-profitability')
  async getBranchProfitability(@Query() query: any) {
    return this.analyticsService.getBranchProfitability(query);
  }

  @Get('delivery-efficiency')
  async getDeliveryEfficiency(@Query() query: any) {
    return this.analyticsService.getDeliveryEfficiency(query);
  }

  // ── Consolidated ──
  @Get('consolidated')
  async getConsolidated(@Query() query: any) {
    return this.analyticsService.getConsolidated(query);
  }

  // ── PDF Export ──
  @Get('export/revenue')
  async exportRevenuePdf(@Query() query: any, @Res() res: Response) {
    const buffer = await this.analyticsService.exportRevenuePdf(query);
    const filename = `revenue-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export/subscription')
  async exportSubscriptionPdf(@Query() query: any, @Res() res: Response) {
    const buffer = await this.analyticsService.exportSubscriptionPdf(query);
    const filename = `subscription-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
