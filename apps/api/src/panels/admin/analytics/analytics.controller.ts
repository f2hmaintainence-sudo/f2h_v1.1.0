import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';

@Controller({ path: 'admin/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── Revenue Reports ──
  @Get('revenue')
  async getRevenueReport(@Query() query: any) {
    return this.analyticsService.getRevenueReport(query);
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
