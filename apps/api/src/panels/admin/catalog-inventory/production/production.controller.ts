import { Body, Controller, Delete, Get, Param, Post, Query, Req,UseGuards } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionShowAddService } from './services/showAdd.service';
import { ProductionSaveAddService } from './services/saveAdd.service';
import { ProductionShowEditService } from './services/showEdit.service';
import { ProductionSaveEditService } from './services/saveEdit.service';
import { BatchProductionService } from './services/batch-production.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/production', version: '1' })
export class ProductionController {
  constructor(
    private readonly productionService: ProductionService,
    private readonly showAddService: ProductionShowAddService,
    private readonly saveAddService: ProductionSaveAddService,
    private readonly showEditService: ProductionShowEditService,
    private readonly saveEditService: ProductionSaveEditService,
    private readonly batchProductionService: BatchProductionService,
  ) { }

  // --- Production Planning ---

  @Get('planning/table')
  async getPlanningTable(@Query() query: any) {
    return this.productionService.getPlanningTable(query);
  }

  @Get('planning/showAdd')
  async getAddPlanningForm() {
    return this.showAddService.showPlanning();
  }

  @Post('planning/saveAdd')
  async savePlanning(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.saveAddService.savePlanning(body, adminId);
  }

  @Get('planning/showEdit/:id')
  async getEditPlanningForm(@Param('id') id: string) {
    return this.showEditService.editPlanning(id);
  }

  @Post('planning/saveEdit/:id')
  async saveEditPlanning(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.saveEditService.updatePlanning(id, body, adminId);
  }

  @Post('planning/updateStatus/:id')
  async updatePlanningStatus(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.productionService.updatePlanningStatus(id, body.status, adminId);
  }

  // --- Production Batches ---

  @Get('batches/table')
  async getProductionTable(@Query() query: any) {
    return this.productionService.getProductionTable(query);
  }

  @Get('batches/showAdd')
  async getAddProductionForm() {
    return this.showAddService.showProduction();
  }

  @Post('batches/saveAdd')
  async saveProduction(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.saveAddService.saveProduction(body, adminId);
  }

  @Get('batches/:id/showEdit')
  async getEditProductionForm(@Param('id') id: string) {
    return this.showEditService.editProduction(id);
  }

  @Post('batches/:id/saveEdit')
  async saveEditProduction(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.saveEditService.updateProduction(id, body, adminId);
  }

  @Delete('batches/:id/softDelete')
  async deleteProduction(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.productionService.deleteProduction(id, adminId);
  }

  // --- Order Batches (Auto-generated) ---

  @Post('order-batches/generate')
  async generateOrderBatches(
    @Body() body: { date?: string; branch_id?: string; slot?: string },
  ) {
    return this.batchProductionService.generateOrderBatches(body.date, body.branch_id, body.slot);
  }

  @Get('order-batches/summary')
  async getOrderBatchesSummary(@Query('date') date?: string) {
    return this.batchProductionService.getDashboardSummary(date);
  }

  @Get('order-batches/table')
  async getOrderBatchesTable(@Query() query: any) {
    return this.batchProductionService.getOrderBatchesTable(query);
  }

  @Get('order-batches/products')
  async getBatchProducts() {
    return this.batchProductionService.getBatchProducts();
  }

  @Post('order-batches/manual')
  async createManualBatch(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.batchProductionService.createManualBatch(body, adminId);
  }

  @Post('order-batches/:id/status')
  async updateOrderBatchStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.batchProductionService.updateBatchStatus(id, body.status, adminId);
  }

  @Post('order-batches/:id/quantity')
  async updateOrderBatchQuantity(
    @Param('id') id: string,
    @Body() body: { prepared_quantity?: number; notes?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.batchProductionService.updateBatchQuantity(id, body, adminId);
  }
}
