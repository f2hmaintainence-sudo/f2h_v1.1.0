import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller({ path: 'admin/dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Full KPI dashboard — single endpoint for all dashboard metrics
   */
  @Get('kpis')
  async getKpis() {
    return this.dashboardService.getKpis();
  }

  /**
   * Branch performance breakdown
   */
  @Get('branch-performance')
  async getBranchPerformance(@Query('days') days?: string) {
    return this.dashboardService.getBranchPerformance(parseInt(days || '30', 10));
  }

  /**
   * Growth metrics (7-day trend)
   */
  @Get('growth')
  async getGrowthMetrics(@Query('days') days?: string) {
    return this.dashboardService.getGrowthMetrics(parseInt(days || '7', 10));
  }

  /**
   * Active alerts
   */
  @Get('alerts')
  async getAlerts() {
    return this.dashboardService.getActiveAlerts();
  }
}
