import { Controller, Get, Post, Put, Patch, Delete, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { DeliveryManagementService } from './delivery.service';
import { DeliveryRunService } from './delivery-run.service';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { DeliveryShowAddService } from './services/showAdd.service';
import { DeliverySaveAddService } from './services/saveAdd.service';
import { DeliveryShowEditService } from './services/showEdit.service';
import { DeliverySaveEditService } from './services/saveEdit.service';
import { DeliveryLeaveTableService } from './services/table.service';
import { DeliveryLeaveShowEditService, DeliveryLeaveSaveEditService } from './services/leave-edit.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/delivery', version: '1' })
export class DeliveryManagementController {
  constructor(
    private readonly deliveryService: DeliveryManagementService,
    private readonly runService: DeliveryRunService,
    private readonly dispatchService: DeliveryDispatchService,
    private readonly showAddService: DeliveryShowAddService,
    private readonly saveAddService: DeliverySaveAddService,
    private readonly showEditService: DeliveryShowEditService,
    private readonly saveEditService: DeliverySaveEditService,
    private readonly leaveTableService: DeliveryLeaveTableService,
    private readonly leaveShowEditService: DeliveryLeaveShowEditService,
    private readonly leaveSaveEditService: DeliveryLeaveSaveEditService,
  ) { }

  // ── Delivery Partners ──

  @Get('partners')
  async getDeliveryPartners(@Query() query: any) {
    return this.deliveryService.getDeliveryPartners(query);
  }

  @Get('partners/:id/portfolio')
  async getPartnerPortfolio(@Param('id') id: string) {
    return this.deliveryService.getPartnerPortfolio(id);
  }

  // Static routes MUST be before parameterized routes (:id)
  @Get('partners/showAdd')
  async showPartnerAdd() {
    return this.showAddService.getPartnerAddForm();
  }

  @Post('partners/saveAdd')
  async savePartnerAdd(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.savePartner(body, adminId);
  }

  @Get('partners/showEdit/:id')
  async showPartnerEditPrefix(@Param('id') id: string) {
    return this.showEditService.getPartnerEditForm(id);
  }

  @Post('partners/saveEdit/:id')
  async savePartnerEditPostPrefix(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.savePartner(id, body, adminId);
  }

  @Put('partners/saveEdit/:id')
  async savePartnerEditPutPrefix(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.savePartner(id, body, adminId);
  }

  @Patch('partners/saveEdit/:id')
  async savePartnerEditPatchPrefix(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.savePartner(id, body, adminId);
  }

  @Get('partners/:id/showEdit')
  async showPartnerEdit(@Param('id') id: string) {
    return this.showEditService.getPartnerEditForm(id);
  }

  @Post('partners/:id/saveEdit')
  async savePartnerEditPost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.savePartner(id, body, adminId);
  }

  @Put('partners/:id/saveEdit')
  async savePartnerEditPut(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.savePartner(id, body, adminId);
  }

  @Patch('partners/:id/saveEdit')
  async savePartnerEditPatch(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.savePartner(id, body, adminId);
  }

  /**
   * Partners currently on shift.
   *
   * Declared above `partners/:id` on purpose — Nest matches routes in
   * declaration order, so a literal segment registered after the parameterised
   * one would be swallowed by it and resolve as an id lookup for "online".
   */
  @Get('partners/online')
  async getOnlinePartners(@Query('branch_id') branchId?: string) {
    return this.deliveryService.getOnlinePartners(branchId);
  }

  @Get('partners/live-positions')
  async getLivePartnerPositions(@Query('branch_id') branchId?: string) {
    return this.deliveryService.getLivePartnerPositions(branchId);
  }

  @Get('partners/:id')
  async getPartnerDetails(@Param('id') id: string) {
    return this.deliveryService.getPartnerDetails(id);
  }

  @Get('partners/:id/stats')
  async getPartnerStats(@Param('id') id: string, @Query('days') days?: string) {
    return this.deliveryService.getPartnerStats(id, parseInt(days || '30', 10));
  }

  @Patch('partners/:id/status')
  async updatePartnerStatus(
    @Param('id') id: string,
    @Body() body: { is_active?: boolean; is_available?: boolean; branch_id?: string; daily_salary?: number },
  ) {
    return this.deliveryService.updatePartnerStatus(id, body);
  }

  @Get('partners/:id/documents')
  async getPartnerDocuments(@Param('id') id: string) {
    return this.deliveryService.getPartnerDocuments(id);
  }

  @Patch('partners/:id/verify')
  async updatePartnerVerification(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.deliveryService.updatePartnerVerification(id, body);
  }

  // ── Delivery Runs ──

  @Post('runs/create')
  async createOptimizedRuns(
    @Body() body: { date?: string; branch_id?: string; slot?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.runService.createOptimizedRuns(body.date, body.branch_id, body.slot, adminId);
  }

  @Get('runs')
  async getRuns(@Query() query: any) {
    return this.runService.getRuns(query);
  }

  @Get('runs/summary')
  async getRunSummary(@Query('date') date?: string) {
    return this.runService.getRunSummary(date);
  }

  @Get('runs/check-availability')
  async checkPartnerAvailability(
    @Query('branch_id') branchId?: string,
    @Query('date') date?: string,
  ) {
    return this.runService.checkPartnerAvailability(branchId, date);
  }

  @Get('runs/partner-summary')
  async getPartnerRunSummary(@Query('date') date?: string) {
    return this.runService.getPartnerRunSummary(date);
  }

  @Get('runs/partner-addresses')
  async getPartnerAddressesForSwap(
    @Query('partner_a') partnerA: string,
    @Query('partner_b') partnerB: string,
    @Query('date') date?: string,
  ) {
    return this.runService.getPartnerAddressesForSwap(partnerA, partnerB, date);
  }

  @Post('runs/swap-addresses')
  async swapAddresses(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.runService.swapAddresses({ ...body, admin_id: adminId });
  }

  @Get('runs/with-orders')
  async getRunsWithOrders(@Query() query: any) {
    return this.runService.getRunsWithOrders(query);
  }

  @Get('runs/partners-with-stops')
  async getPartnersWithStops(@Query() query: any) {
    return this.runService.getPartnersWithStops(query);
  }

  @Get('runs/eligible-targets')
  async getEligibleTargetRuns(@Query('order_id') orderId: string) {
    return this.runService.getEligibleTargetRuns(orderId);
  }

  @Post('runs/orders/move')
  async moveOrderBetweenRuns(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.runService.moveOrderBetweenRuns({ ...body, admin_id: adminId });
  }

  @Post('runs/orders/swap')
  async swapOrdersBetweenRuns(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.runService.swapOrdersBetweenRuns({ ...body, admin_id: adminId });
  }

  @Get('runs/:id')
  async getRunDetails(@Param('id') id: string) {
    console.log("getRunDetails run Id", { id });
    return this.runService.getRunDetails(id);
  }

  @Get('runs/:id/addresses')
  async getRunAddresses(@Param('id') id: string) {
    return this.runService.getRunAddresses(id);
  }


  @Patch('runs/:id/status')
  async updateRunStatus(
    @Param('id') id: string,
    @Body() body: { status: string; performed_by?: string },
  ) {
    return this.runService.updateRunStatus(id, body.status, body.performed_by);
  }

  @Patch('runs/:id/reassign')
  async reassignRun(
    @Param('id') id: string,
    @Body() body: { to_partner_id: string; reason?: string; admin_id?: string },
  ) {
    return this.runService.reassignRun(id, body.to_partner_id, body.reason, body.admin_id);
  }

  // ── Run Address Status ──

  @Patch('addresses/:id/status')
  async updateAddressStatus(
    @Param('id') id: string,
    @Body() body: {
      status: string;
      reason?: string;
      proof_url?: string;
      latitude?: number;
      longitude?: number;
      performed_by?: string;
    },
  ) {
    return this.runService.updateAddressStatus(
      id,
      body.status,
      { reason: body.reason, proof_url: body.proof_url, latitude: body.latitude, longitude: body.longitude },
      body.performed_by,
    );
  }

  // ── Delivery Logs ──

  @Get('logs')
  async getLogs(@Query() query: any) {
    return this.runService.getLogs(query);
  }

  // ── Delivery Tracking (kept for backward compat) ──

  @Get('tracking')
  async getDeliveryTracking(@Query() query: any) {
    return this.deliveryService.getDeliveryTracking(query);
  }

  @Get('tracking/summary')
  async getTrackingSummary(@Query('date') date?: string) {
    return this.deliveryService.getTrackingSummary(date);
  }

  @Patch('orders/:orderId/status')
  async updateDeliveryStatus(
    @Param('orderId') orderId: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.deliveryService.updateDeliveryStatus(orderId, body.status, body.notes);
  }

  @Patch('orders/:orderId/assign')
  async assignPartnerToOrder(
    @Param('orderId') orderId: string,
    @Body() body: { partner_id: string },
  ) {
    return this.deliveryService.assignPartnerToOrder(orderId, body.partner_id);
  }

  // ── Missed Deliveries ──

  @Get('missed')
  async getMissedDeliveries(@Query() query: any) {
    return this.deliveryService.getMissedDeliveries(query);
  }

  // ── Delivery Dispatch (Stock → Delivery Boy) ──

  @Post('dispatch/:runId')
  async dispatchToDeliveryPartner(
    @Param('runId') runId: string,
    @Body() body: { items: Array<{ warehouse_id: string; product_variant_id: string; planned_qty: number; loaded_qty: number; unit?: string }> },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.dispatchService.dispatchToDeliveryPartner(runId, body.items, adminId);
  }

  @Post('dispatch/:runId/return')
  async processDeliveryReturn(
    @Param('runId') runId: string,
    @Body() body: { items: Array<{ product_variant_id: string; delivered_qty: number; returned_qty: number; damaged_qty: number; extra_sold_qty?: number; remarks?: string }> },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.dispatchService.processDeliveryReturn(runId, body.items, adminId);
  }

  @Get('dispatch/requirements')
  async getDispatchRequirements(@Query() query: any) {
    return this.dispatchService.getDispatchRequirements(query);
  }

  @Get('dispatch/summary')
  async getDispatchSummary(@Query() query: any) {
    return this.dispatchService.getDispatchSummary(query);
  }

  @Get('dispatch/available-variants')
  async getAvailableVariants(@Query() query: any) {
    return this.dispatchService.getAvailableVariants(query);
  }

  @Get('dispatch/returns')
  async getDispatchReturns(@Query() query: any) {
    return this.dispatchService.getDispatchReturns(query);
  }

  @Get('dispatch/history/items')
  async getDispatchHistoryItems(@Query() query: any) {
    return this.dispatchService.getDispatchHistoryItems(query);
  }

  @Get('dispatch/history/partners')
  async getDispatchHistoryPartners(@Query() query: any) {
    return this.dispatchService.getDispatchHistoryPartners(query);
  }

  @Get('dispatch/:runId/return-preview')
  async getRunReturnPreview(@Param('runId') runId: string) {
    return this.dispatchService.getRunReturnPreview(runId);
  }

  @Get('dispatch/:runId/items')
  async getRunDispatchItems(@Param('runId') runId: string) {
    return this.dispatchService.getRunDispatchItems(runId);
  }

  // ── Leave Requests Admin Endpoints ──

  @Post('leave-requests')
  async recordPartnerLeave(@Body() dto: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.deliveryService.recordPartnerLeave(dto, adminId);
  }

  @Get('leave-requests')
  async getAdminLeaveRequests(@Query() query: any) {
    return this.deliveryService.getAdminLeaveRequests(query);
  }

  @Patch('leave-requests/:id/status')
  async updateLeaveStatus(
    @Param('id') id: string,
    @Body() body: { status: string; admin_remarks?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.deliveryService.updateLeaveStatus(id, body, adminId);
  }

  // ── Leave Requests ──

  @Get('leave-requests/table')
  async getLeaveRequests(@Query() query: any) {
    return this.leaveTableService.getLeaveRequestsTable(query);
  }

  @Get('leave-requests/:id/showEdit')
  async showLeaveRequestEdit(@Param('id') id: string) {
    return this.leaveShowEditService.getLeaveRequestEditForm(id);
  }

  @Post('leave-requests/:id/saveEdit')
  async saveLeaveRequestEdit(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.leaveSaveEditService.saveLeaveRequest(id, body, adminId);
  }

  @Delete('leave-requests/:id/delete')
  async deleteLeaveRequest(@Param('id') id: string) {
    return this.leaveSaveEditService.deleteLeaveRequest(id);
  }
}
