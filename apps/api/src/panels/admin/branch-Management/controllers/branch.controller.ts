import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BranchManagementService } from '../ModuleServices/branchManagement.service';
import { CustomerTableService } from '../services/table.service';
import { BranchShowAddService } from '../services/showAdd.service';
import { BranchSaveAddService } from '../services/saveAdd.service';
import { BranchShowEditService } from '../services/showEdit.service';
import { BranchSaveEditService } from '../services/saveEdit.service';
import { SectorService } from '../ModuleServices/sector.service';
import { CreateBranchDto } from '../dto/branch.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/branch', version: '1' })
export class BranchController {
  constructor(
    private readonly customersService: BranchManagementService,
    private readonly tableService: CustomerTableService,
    private readonly showAddService: BranchShowAddService,
    private readonly saveAddService: BranchSaveAddService,
    private readonly showEditService: BranchShowEditService,
    private readonly saveEditService: BranchSaveEditService,
    private readonly sectorService: SectorService,
  ) { }

  // ─── TABLE + FORM CRUD (static routes FIRST) ──────────────────
  @Get('table')
  async getBranchTable(@Query() query: any) {
    return this.tableService.getBranchTable(query);
  }

  @Get('showAdd')
  async showBranchAdd() {
    return this.showAddService.branchShowAddForm();
  }

  @Post('saveAdd')
  async saveBranchAdd(@Body() body: CreateBranchDto, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveBranch(body, adminId);
  }

  // ─── H3 HEXES FOR MAP RENDERING (legacy endpoint) ─────────────
  @Get('hexes/:branchId')
  async getBranchHexes(@Param('branchId') branchId: string) {
    return { status: true, data: [] };
  }

  @Get('segments')
  async getSegments() {
    return this.customersService.getSegments();
  }

  // ─── WALLET TRANSACTIONS CRUD (static routes FIRST) ─────────────
  @Get('wallets/table')
  async getWalletTransactionsTable(@Query() query: any) {
    return this.tableService.getWalletTransactionsTable(query);
  }

  @Get('wallets/:id/view')
  async getWalletTransactionView(@Param('id') id: string) {
    return this.customersService.getWalletTransactionView(id);
  }

  @Delete('wallets/:id/softDelete')
  async softDeleteWalletTransaction(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.softDeleteWalletTransaction(id, adminId);
  }

  // ─── SINGLE CUSTOMER (parameterized routes AFTER) ─────────────
  @Get(':id/view')
  async getCustomerView(@Param('id') id: string) {
    return this.customersService.getCustomerView(id);
  }

  @Get(':id/showEdit')
  async showCustomerEdit(@Param('id') id: string) {
    return this.showEditService.getCustomersEditForm(id);
  }

  @Post(':id/saveEdit')
  async saveBranchEdit(
    @Param('id') id: string,
    @Body() body: Partial<CreateBranchDto>,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.saveBranch(id, body, adminId);
  }

  @Delete(':id/softDelete')
  async softDeleteCustomer(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.softDeleteCustomer(id, adminId);
  }

  // ─── GET FULL BRANCH BY ID ─────────────────────────────────
  @Get(':id/detail')
  async getBranchById(@Param('id') id: string) {
    return this.customersService.getBranchById(id);
  }

  @Get(':id/orders')
  async getCustomerOrders(@Param('id') id: string, @Query() query: any) {
    return this.customersService.getCustomerOrders(id, query);
  }

  @Get(':id/subscriptions')
  async getCustomerSubscriptions(@Param('id') id: string, @Query() query: any) {
    return this.customersService.getCustomerSubscriptions(id, query);
  }

  @Get(':id/wallet')
  async getWalletLedger(@Param('id') id: string, @Query() query: any) {
    return this.customersService.getWalletLedger(id, query);
  }

  @Get(':id/complaints')
  async getComplaints(@Param('id') id: string, @Query() query: any) {
    return this.customersService.getComplaints(id, query);
  }

  @Get(':id/score')
  async getCustomerScore(@Param('id') id: string) {
    return this.customersService.getCustomerScore(id);
  }

  // ─── WALLET ACTIONS ─────────────────────────────────────────────
  @Post(':id/wallet/credit')
  async creditWallet(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.creditWallet(
      id,
      body.amount,
      body.reason,
      adminId,
    );
  }

  @Post(':id/wallet/debit')
  async debitWallet(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.debitWallet(
      id,
      body.amount,
      body.reason,
      adminId,
    );
  }

  @Post(':id/wallet/freeze')
  async freezeWallet(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.freezeWallet(id, adminId);
  }

  // ─── SUBSCRIPTION OVERRIDES ─────────────────────────────────────
  @Post(':id/subscriptions/:subId/pause')
  async pauseSubscription(
    @Param('id') id: string,
    @Param('subId') subId: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.pauseSubscription(id, subId, adminId);
  }

  @Post(':id/subscriptions/:subId/resume')
  async resumeSubscription(
    @Param('id') id: string,
    @Param('subId') subId: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.resumeSubscription(id, subId, adminId);
  }

  @Put(':id/subscriptions/:subId')
  async modifySubscription(
    @Param('id') id: string,
    @Param('subId') subId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.modifySubscription(id, subId, body, adminId);
  }

  @Delete(':id/subscriptions/:subId')
  async cancelSubscription(
    @Param('id') id: string,
    @Param('subId') subId: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.cancelSubscription(id, subId, adminId);
  }

  // ─── COMPLAINT RESOLUTION ───────────────────────────────────────
  @Post(':id/complaints/:cid/refund')
  async approveRefund(
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.approveRefund(id, cid, adminId);
  }

  @Post(':id/complaints/:cid/reject')
  async rejectComplaint(
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.rejectComplaint(id, cid, body.reason, adminId);
  }

  // ─── ACCOUNT CONTROLS ──────────────────────────────────────────
  @Post(':id/block')
  async blockCustomer(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.blockCustomer(id, body.reason, adminId);
  }

  @Post(':id/unblock')
  async unblockCustomer(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.unblockCustomer(id, adminId);
  }

  @Put(':id/postpaid-limit')
  async setPostpaidLimit(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.setPostpaidLimit(id, body.limit, adminId);
  }

  @Post(':id/notify')
  async sendNotification(@Param('id') id: string, @Body() body: any) {
    return this.customersService.sendNotification(id, body.message, body.type);
  }

  @Get(':id/export')
  async exportCustomerData(@Param('id') id: string) {
    return this.customersService.exportCustomerData(id);
  }

  @Delete(':id')
  async deleteAccount(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.deleteAccount(id, adminId);
  }
}
