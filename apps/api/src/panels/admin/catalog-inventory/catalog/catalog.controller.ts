import { UseGuards,Controller, Get, Post, Body, Query, Req, Param, Delete } from '@nestjs/common';
import { CatalogService } from './services/catalog.service';
import { CatalogShowAddService } from './services/showAdd.service';
import { CatalogSaveAddService } from './services/saveAdd.service';
import { CatalogShowEditService } from './services/showEdit.service';
import { CatalogSaveEditService } from './services/saveEdit.service';
import { CatalogSubscriptionConfigService } from './services/subscriptionConfig.service';
import { AuthService } from 'src/panels/admin/auth/auth.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/catalog', version: '1' })
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly showAddService: CatalogShowAddService,
    private readonly saveAddService: CatalogSaveAddService,
    private readonly showEditService: CatalogShowEditService,
    private readonly saveEditService: CatalogSaveEditService,
    private readonly subscriptionConfigService: CatalogSubscriptionConfigService,
    private readonly authService: AuthService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // CATALOG PRODUCTS CRUD
  // ═══════════════════════════════════════════════════════════════

  @Get('/product/table')
  async getCatalogTable(@Query() query: any) {
    return this.catalogService.getCatalogTable(query);
  }

  @Get('/product/showAdd')
  getAddCatalogForm() {
    return this.showAddService.showProduct();
  }

  @Post('/product/saveAdd')
  async saveCatalog(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveProduct(body, adminId);
  }

  @Get('/product/:id/showEdit')
  async getEditCatalogForm(@Param('id') id: string) {
    return this.showEditService.editProduct(id);
  }

  @Post('/product/:id/saveEdit')
  async saveEditCatalog(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.updateProduct(id, body, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT VARIANTS TABLE
  // ═══════════════════════════════════════════════════════════════

  @Get('variants/table')
  async getProductVariantsTable(@Query() query: any) {
    return this.catalogService.getProductVariantsTable(query);
  }

  @Get('variants/showAdd')
  getAddVariantForm() {
    return this.showAddService.getVariantForm();
  }

  @Post('variants/saveAdd')
  async saveVariant(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveVariant(body, adminId);
  }

  @Get('variants/:id/showEdit')
  async getEditVariantForm(@Param('id') id: string) {
    return this.showEditService.getVariantEditForm(id);
  }

  @Post('variants/:id/saveEdit')
  async saveEditVariant(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.updateVariant(id, body, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT CATEGORIES TABLE
  // ═══════════════════════════════════════════════════════════════

  @Get('categories/table')
  async getProductCategoriesTable(@Query() query: any) {
    return this.catalogService.getProductCategoriesTable(query);
  }

  @Get('categories/showAdd')
  getAddCategoryForm() {
    return this.showAddService.getCategoryForm();
  }

  @Post('categories/saveAdd')
  async saveCategory(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveCategory(body, adminId);
  }

  @Get('categories/:id/showEdit')
  async getEditCategoryForm(@Param('id') id: string) {
    return this.showEditService.getCategoryEditForm(id);
  }

  @Post('categories/:id/saveEdit')
  async saveEditCategory(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.saveCategory(id, body, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBSCRIPTION CONFIG - BILLING RULES
  // ═══════════════════════════════════════════════════════════════

  @Get('subscription-config')
  async getSubscriptionConfig() {
    return this.subscriptionConfigService.getConfig();
  }

  @Post('subscription-config')
  async saveSubscriptionConfig(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.saveConfig(body, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL SUBSCRIPTION CONFIG
  // ═══════════════════════════════════════════════════════════════

  @Get('subscription-config/global')
  async getGlobalSubscriptionConfig() {
    return this.subscriptionConfigService.getGlobalConfig();
  }

  @Post('subscription-config/global')
  async saveGlobalSubscriptionConfig(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.saveGlobalConfig(body, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // DELIVERY SLOTS
  // ═══════════════════════════════════════════════════════════════

  @Get('subscription-config/delivery-slots')
  async getDeliverySlots() {
    return this.subscriptionConfigService.getDeliverySlots();
  }

  @Post('subscription-config/delivery-slots')
  async saveDeliverySlot(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.saveDeliverySlot(body, adminId);
  }

  @Get('subscription-config/delivery-slots/showAdd')
  async getDeliverySlotAddForm() {
    return this.showAddService.getDeliverySlotForm();
  }

  @Get('subscription-config/delivery-slots/showEdit/:id')
  async getDeliverySlotEditForm(@Param('id') id: string) {
    return this.showEditService.getDeliverySlotEditForm(id);
  }

  @Get('subscription-config/delivery-slots/:id')
  async getDeliverySlot(@Param('id') id: string) {
    const slotId = parseInt(id, 10);
    return this.subscriptionConfigService.getDeliverySlots();
  }



  // ═══════════════════════════════════════════════════════════════
  // PRODUCT SUBSCRIPTION RULES
  // ═══════════════════════════════════════════════════════════════

  @Get('subscription-config/product-rules')
  async getProductSubscriptionRules() {
    return this.subscriptionConfigService.getProductSubscriptionRules();
  }

  @Get('subscription-config/product-rules/showAdd')
  async getProductRuleAddForm() {
    return this.showAddService.getProductRuleForm();
  }

  @Get('subscription-config/product-rules/showEdit/:productId')
  async getProductRuleEditForm(@Param('productId') productId: string) {
    return this.showEditService.getProductRuleEditForm(productId);
  }

  @Get('subscription-config/product-rules/:productId')
  async getProductSubscriptionRule(@Param('productId') productId: string) {
    const id = parseInt(productId, 10);
    return this.subscriptionConfigService.getProductSubscriptionRule(id);
  }

  @Post('subscription-config/product-rules/:productId')
  async saveProductSubscriptionRule(
    @Param('productId') productId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const id = parseInt(productId, 10);
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.saveProductSubscriptionRule(
      id,
      body,
      adminId,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT SUBSCRIPTION FREQUENCIES
  // ═══════════════════════════════════════════════════════════════

  @Get('subscription-config/product-rules/:productRuleId/frequencies')
  async getProductFrequencies(@Param('productRuleId') productRuleId: string) {
    const id = parseInt(productRuleId, 10);
    return this.subscriptionConfigService.getProductFrequencies(id);
  }

  @Post('subscription-config/product-rules/:productRuleId/frequencies')
  async saveProductFrequency(
    @Param('productRuleId') productRuleId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const id = parseInt(productRuleId, 10);
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.saveProductFrequency(id, body, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT SLOT RULES
  // ═══════════════════════════════════════════════════════════════

  @Get('subscription-config/product-rules/:productRuleId/slot-rules')
  async getProductSlotRules(@Param('productRuleId') productRuleId: string) {
    const id = parseInt(productRuleId, 10);
    return this.subscriptionConfigService.getProductSlotRules(id);
  }

  @Post('subscription-config/product-rules/:productRuleId/slot-rules')
  async saveProductSlotRule(
    @Param('productRuleId') productRuleId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const id = parseInt(productRuleId, 10);
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.saveProductSlotRule(
      id,
      body.delivery_slot_id,
      adminId,
    );
  }

  @Post('subscription-config/product-rules/:productRuleId/slot-rules/:slotId/remove')
  async removeProductSlotRule(
    @Param('productRuleId') productRuleId: string,
    @Param('slotId') slotId: string,
    @Req() req: any,
  ) {
    const ruleId = parseInt(productRuleId, 10);
    const slotIdNum = parseInt(slotId, 10);
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionConfigService.removeProductSlotRule(
      ruleId,
      slotIdNum,
      adminId,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SOFT DELETION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Delete('/product/:id/delete')
  async softDeleteProduct(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.catalogService.softDeleteProduct(id, adminId);
  }

  @Delete('/variants/:id/delete')
  async softDeleteVariant(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.catalogService.softDeleteVariant(id, adminId);
  }

  @Delete('/categories/:id/delete')
  async softDeleteCategory(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.catalogService.softDeleteCategory(id, adminId);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT OFFERS / BANNERS ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('offers/table')
  async getOffersTable(@Query() query: any) {
    return this.catalogService.getOffersTable(query);
  }

  @Get('offers/showAdd')
  getAddOfferForm() {
    return this.showAddService.getOffersForm();
  }

  @Post('offers/saveAdd')
  async saveOffer(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveOffer(body, adminId);
  }

  @Get('offers/:id/showEdit')
  async getEditOfferForm(@Param('id') id: string) {
    return this.showEditService.getOfferEditForm(id);
  }

  @Post('offers/:id/saveEdit')
  async saveEditOffer(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.updateOffer(id, body, adminId);
  }

  @Delete('offers/:id/delete')
  async deleteOffer(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.catalogService.deleteOffer(id, adminId);
  }
}
