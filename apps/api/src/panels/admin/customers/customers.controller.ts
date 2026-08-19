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
import { CustomersService } from './customers.service';
import { CustomerTableService } from './services/table.service';
import { CustomerShowAddService } from './services/showAdd.service';
import { CustomerSaveAddService } from './services/saveAdd.service';
import { CustomerShowEditService } from './services/showEdit.service';
import { CustomerSaveEditService } from './services/saveEdit.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: '/admin/customer', version: '1' })
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly tableService: CustomerTableService,
    private readonly showAddService: CustomerShowAddService,
    private readonly saveAddService: CustomerSaveAddService,
    private readonly showEditService: CustomerShowEditService,
    private readonly saveEditService: CustomerSaveEditService,
  ) { }

  // ─── TABLE + FORM CRUD (static routes FIRST) ──────────────────
  @Get('intelligence-list')
  async getCustomerIntelligenceList(@Query() query: any) {
    return this.customersService.getCustomerIntelligenceList(query);
  }

  @Get('table')
  async getCustomerTable(@Query() query: any) {
    return this.tableService.getCustomersTable(query);
  }

  @Get('postpaid/table')
  async getPostpaidCustomerTable(@Query() query: any) {
    return this.tableService.getCustomersTable({ ...query, is_postpaid: true });
  }

  @Get('showAdd')
  async showCustomerAdd() {
    return this.showAddService.getCustomersForm();
  }

  @Post('saveAdd')
  async saveCustomerAdd(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveCustomer(body, adminId);
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

  // ─── SPECIAL PRICES CRUD ─────────────────────────────────────────
  @Get('special-prices/table')
  async getSpecialPricesTable(@Query() query: any) {
    return this.customersService.getSpecialPricesTable(query);
  }

  @Get('special-prices/options')
  async getSpecialPricesOptions() {
    return this.customersService.getSpecialPricesOptions();
  }

  @Post('special-prices')
  async saveSpecialPricesRule(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    const customerId = body.customer_id;
    const items = body.items || [{ product_variant_id: body.product_variant_id, discount: body.discount }];
    return this.customersService.saveSpecialPrices(customerId, items, adminId);
  }


  @Delete('special-prices/:id')
  async deleteSpecialPriceById(@Param('id') id: string) {
    return this.customersService.deleteSpecialPriceById(id);
  }

  // ─── SINGLE CUSTOMER (parameterized routes AFTER) ─────────────


  @Get(':id/portfolio')
  async getCustomerPortfolio(@Param('id') id: string) {
    return this.customersService.getCustomerPortfolio(id);
  }

  @Post(':id/container-transaction')
  async logContainerTransaction(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.logContainerTransaction(id, body, adminId);
  }

  @Post(':id/settle-postpaid-bill')
  async settlePostpaidBill(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.settlePostpaidBill(id, body, adminId);
  }

  @Get(':id/view')
  async getCustomerView(@Param('id') id: string) {
    return this.customersService.getCustomerView(id);
  }

  @Get(':id/showEdit')
  async showCustomerEdit(@Param('id') id: string) {
    return this.showEditService.getCustomersEditForm(id);
  }

  @Post(':id/saveEdit')
  async saveCustomerEdit(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.saveCustomer(id, body, adminId);
  }

  @Delete(':id/softDelete')
  async softDeleteCustomer(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.softDeleteCustomer(id, adminId);
  }

  @Get(':id')
  async getCustomerProfile(@Param('id') id: string) {
    return this.customersService.getCustomerProfile(id);
  }

  @Get(':id/orders')
  async getCustomerOrders(@Param('id') id: string, @Query() query: any) {
    return this.customersService.getCustomerOrders(id, query);
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

  // ─── SPECIAL PRICES ────────────────────────────────────────────
  @Get('products/list')
  async getProductsList() {
    return this.customersService.getProductsList();
  }

  @Get('products/:productId/variants')
  async getProductVariants(@Param('productId') productId: string) {
    return this.customersService.getProductVariants(productId);
  }

  @Get(':id/special-prices')
  async getSpecialPrices(@Param('id') id: string) {
    return this.customersService.getSpecialPrices(id);
  }

  @Post(':id/special-prices')
  async saveSpecialPrices(
    @Param('id') id: string,
    @Body() body: { items: Array<{ product_variant_id: string; discount: number }> },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.customersService.saveSpecialPrices(id, body.items, adminId);
  }

  @Delete(':id/special-prices/:variantId')
  async deleteSpecialPrice(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Req() req: any,
  ) {
    return this.customersService.deleteSpecialPrice(id, variantId);
  }
}
