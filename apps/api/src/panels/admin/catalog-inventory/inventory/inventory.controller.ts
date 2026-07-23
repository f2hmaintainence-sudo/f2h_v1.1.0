import { Body, Controller, Get, Param, Post, Query, Req,UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryShowAddService } from './services/showAdd.service';
import { InventorySaveAddService } from './services/saveAdd.service';
import { InventoryShowEditService } from './services/showEdit.service';
import { InventorySaveEditService } from './services/saveEdit.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { InventoryDashboardService } from './services/inventory-dashboard.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'admin/inventory', version: '1' })
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly showAddService: InventoryShowAddService,
    private readonly saveAddService: InventorySaveAddService,
    private readonly showEditService: InventoryShowEditService,
    private readonly saveEditService: InventorySaveEditService,
    private readonly reportsService: InventoryReportsService,
    private readonly dashboardService: InventoryDashboardService,
  ) { }

  @Get('stats')
  async getInventoryStats(@Query() query: any) {
    return this.inventoryService.getInventoryStats(query);
  }

  @Get('table')
  async getInventoryTable(@Query() query: any) {
    return this.inventoryService.getInventoryTable(query);
  }

  @Get('showAdd')
  async getAddInventoryForm() {
    return this.showAddService.showMovement();
  }

  @Post('saveAdd')
  async saveInventoryMovement(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.saveAddService.saveMovement(body, adminId);
  }

  @Get('showEdit/:id')
  async getEditInventoryForm(@Param('id') id: string) {
    return this.showEditService.editMovement(id);
  }

  @Post('saveEdit/:id')
  async saveEditInventoryMovement(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.saveEditService.updateMovement(id, body, adminId);
  }

  @Get('stock-movements/table')
  async getStockMovementsTable(@Query() query: any) {
    return this.inventoryService.getStockMovementsTable(query);
  }

  @Get('warehouse/table')
  async getWarehouseStockTable(@Query() query: any) {
    return this.inventoryService.getWarehouseStockTable(query);
  }

  @Get('expiry/table')
  async getExpiryTrackingTable(@Query() query: any) {
    return this.inventoryService.getExpiryTrackingTable(query);
  }

  @Get('production-plans/table')
  async getProductionPlansTable(@Query() query: any) {
    return this.inventoryService.getProductionPlansTable(query);
  }

  // ── Consumption Forecast ──

  @Get('forecast')
  async getConsumptionForecast(@Query() query: any) {
    return this.reportsService.getConsumptionForecast(query);
  }

  @Post('forecast/compute')
  async computeForecast(@Body() body: { branch_id?: string; days?: number }) {
    return this.reportsService.computeForecast(body.branch_id, body.days);
  }

  // ── Stock Adjustments ──

  @Get('adjustments/table')
  async getStockAdjustments(@Query() query: any) {
    return this.reportsService.getStockAdjustments(query);
  }

  // ── Inventory Reports ──

  @Get('report/export')
  async getInventoryReport(@Query() query: any) {
    return this.reportsService.getInventoryReport(query);
  }

  // ── Purchase Entries ──

  @Get('purchases')
  async getPurchaseEntries(@Query() query: any) {
    return this.reportsService.getPurchaseEntries(query);
  }

  @Post('purchases')
  async createPurchaseEntry(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.reportsService.createPurchaseEntry(body, adminId);
  }

  // ── Dashboard & Reports ──

  @Get('dashboard')
  async getInventoryDashboard() {
    return this.dashboardService.getDashboardData();
  }

  @Get('dashboard/warehouse-summary')
  async getWarehouseStockSummary() {
    return { status: true, data: await this.dashboardService.getWarehouseStockSummary() };
  }

  @Get('dashboard/branch-summary')
  async getBranchStockSummary() {
    return { status: true, data: await this.dashboardService.getBranchStockSummary() };
  }

  @Get('dashboard/dispatch-status')
  async getDispatchStatus(@Query('date') date?: string) {
    return { status: true, data: await this.dashboardService.getDispatchStatusSummary(date) };
  }

  @Get('dashboard/transfer-status')
  async getTransferStatus() {
    return { status: true, data: await this.dashboardService.getTransferStatusSummary() };
  }

  @Get('dashboard/production-requirements')
  async getProductionRequirements(@Query('date') date?: string) {
    return { status: true, data: await this.dashboardService.getProductionRequirements(date) };
  }

  @Get('dashboard/delivery-dispatch')
  async getDeliveryDispatchSummary(@Query('date') date?: string) {
    return { status: true, data: await this.dashboardService.getDeliveryDispatchSummary(date) };
  }

  @Get('reconciliation')
  async getDailyReconciliation(
    @Query('date') date?: string,
    @Query('warehouse_id') warehouseId?: string,
  ) {
    return this.dashboardService.getDailyReconciliation(date, warehouseId);
  }
}
