import { Body, Controller, Delete, Get, Param, Post, Query, Req,UseGuards, } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseShowAddService } from './services/showAdd.service';
import { WarehouseSaveAddService } from './services/saveAdd.service';
import { WarehouseShowEditService } from './services/showEdit.service';
import { WarehouseSaveEditService } from './services/saveEdit.service';
import { WarehouseDispatchService } from './services/warehouse-dispatch.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/warehouses', version: '1' })
export class WarehouseController {
  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly showAddService: WarehouseShowAddService,
    private readonly saveAddService: WarehouseSaveAddService,
    private readonly showEditService: WarehouseShowEditService,
    private readonly saveEditService: WarehouseSaveEditService,
    private readonly dispatchService: WarehouseDispatchService,
  ) { }

  // =====================================================
  // WAREHOUSE
  // =====================================================

  @Get('active/list')
  async getActiveWarehouses() {
    return this.warehouseService.getActiveWarehouses();
  }

  @Get('table')
  async getWarehouseTable(
    @Query() query: any,
  ) {
    return this.warehouseService.getWarehouseTable(
      query,
    );
  }

  @Get('showAdd')
  async getAddWarehouseForm() {
    return this.showAddService.showWarehouse();
  }

  @Post('saveAdd')
  async saveWarehouse(
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveAddService.saveWarehouse(
      body,
      adminId,
    );
  }

  @Get(':id/showEdit')
  async getEditWarehouseForm(
    @Param('id') id: string,
  ) {
    return this.showEditService.editWarehouse(
      id,
    );
  }

  @Post(':id/saveEdit')
  async saveEditWarehouse(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveEditService.updateWarehouse(
      id,
      body,
      adminId,
    );
  }
  @Get('stock/table')
    async getStackTable(
      @Query() query: any,
    ) {
      return this.warehouseService.getStockTable(
        query,
      );
    }


  // =====================================================
  // STOCK TRANSFERS
  // =====================================================

  @Get('transfers/table')
  async getTransferTable(
    @Query() query: any,
  ) {
    return this.warehouseService.getTransferTable(
      query,
    );
  }

  @Get('transfers/showAdd')
  async getAddTransferForm() {
    return this.showAddService.showTransfer();
  }

  @Post('transfers/saveAdd')
  async saveTransfer(
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveAddService.saveTransfer(
      body,
      adminId,
    );
  }

  @Get('transfers/:id/showEdit')
  async getEditTransferForm(
    @Param('id') id: string,
  ) {
    return this.showEditService.editTransfer(
      id,
    );
  }

  @Post('transfers/:id/saveEdit')
  async saveEditTransfer(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveEditService.updateTransfer(
      id,
      body,
      adminId,
    );
  }

  @Post('transfers/:id/approve')
  async approveTransfer(
    @Param('id') id: string,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.warehouseService.approveTransfer(
      id,
      adminId,
    );
  }

  @Post('transfers/:id/dispatch')
  async dispatchTransfer(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.warehouseService.dispatchTransfer(
      id,
      body.quantity,
      adminId,
    );
  }

  @Post('transfers/:id/receive')
  async receiveTransfer(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.warehouseService.receiveTransfer(
      id,
      body.quantity,
      adminId,
    );
  }

  @Delete(':id/softDelete')
  async softDeleteWarehouse(
    @Param('id') id: string,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.warehouseService.softDeleteWarehouse(
      id,
      adminId,
    );
  }

  // =====================================================
  // STOCK MOVEMENTS
  // =====================================================

  @Get('stock-movements/table')
  async getStockMovementTable(
    @Query() query: any,
  ) {
    return this.warehouseService.getStockMovementTable(
      query,
    );
  }

  @Get('stock-movements/showAdd')
  
  async getAddStockMovementForm() {

    return this.showAddService.showStockMovement();
  }

  @Post('stock-movements/saveAdd')
  async saveStockMovement(
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveAddService.saveStockMovement(
      body,
      adminId,
    );
  }

  @Get('stock-movements/:id/showEdit')
  async getEditStockMovementForm(
    @Param('id') id: string,
  ) {
    return this.showEditService.editStockMovement(
      id,
    );
  }

  @Post('stock-movements/:id/saveEdit')
    async saveEditStockMovement(
      @Param('id') id: string,
      @Body() body: any,
      @Req() req: any,
    ) {

      const adminId =
        req.user?.user_id ??
        req.user?.id ??
        'system';

      return this.saveEditService.updateStockMovement(
        id,
        body,
        adminId,
      );
    }

  // =====================================================
  // VENDOR INTAKES
  // =====================================================

  @Get('intake/table')
  async getIntakeTable(
    @Query() query: any,
  ) {
    return this.warehouseService.getIntakeTable(
      query,
    );
  }

  @Get('intake/showAdd')
  async getAddIntakeForm() {
    return this.showAddService.showIntake();
  }

  @Post('intake/saveAdd')
  async saveIntake(
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveAddService.saveIntake(
      body,
      adminId,
    );
  }

  @Get('intake/:id/showEdit')
  async getEditIntakeForm(
    @Param('id') id: string,
  ) {
    return this.showEditService.editIntake(
      id,
    );
  }

  @Post('intake/:id/saveEdit')
  async saveEditIntake(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.saveEditService.updateIntake(
      id,
      body,
      adminId,
    );
  }

  @Delete('intake/:id/softDelete')
  async softDeleteIntake(
    @Param('id') id: string,
    @Req() req: any,
  ) {

    const adminId =
      req.user?.user_id ??
      req.user?.id ??
      'system';

    return this.warehouseService.softDeleteIntake(
      id,
      adminId,
    );
  }

  // =====================================================
  // DISPATCH PLANS
  // =====================================================

  @Get('dispatch/table')
  async getDispatchPlans(@Query() query: any) {
    return this.dispatchService.getDispatchPlans(query);
  }

  @Get('dispatch/:id')
  async getDispatchPlanDetails(@Param('id') id: string) {
    return this.dispatchService.getDispatchPlanDetails(id);
  }

  @Post('dispatch/saveAdd')
  async createDispatchPlan(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.dispatchService.createDispatchPlan(body, adminId);
  }

  @Post('dispatch/:id/status')
  async updateDispatchPlanStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.dispatchService.updateDispatchPlanStatus(id, body.status, adminId);
  }

  @Get('dispatch/requirements/:branchId')
  async computeDispatchRequirements(
    @Param('branchId') branchId: string,
    @Query('date') date?: string,
  ) {
    return this.dispatchService.computeDispatchRequirements(branchId, date);
  }
}