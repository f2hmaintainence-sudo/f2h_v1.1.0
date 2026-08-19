import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards, Version,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PromotionsCouponsService } from './promotions-coupons.service';
import {
  AddPromotionProductsDto,
  CreateCouponDto,
  CreatePromotionDto,
  SetCouponStatusDto,
  SetPromotionStatusDto,
  UpdateCouponDto,
  UpdatePromotionDto,
} from './promotions-coupons.dto';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/promotions-coupons', version: '1' })
export class PromotionsCouponsController {
  constructor(private readonly svc: PromotionsCouponsService) {}

  private getAdminId(req: any): string {
    return req?.user?.sub || req?.user?.user_id || 'ADMIN';
  }

  // ── PROMOTIONS ─────────────────────────────────────────────────────────────

  @Get('promotions')
  listPromotions(@Query('include_deleted') includeDeleted?: string) {
    return this.svc.listPromotions(includeDeleted === 'true');
  }

  @Get('promotions/:id')
  getPromotion(@Param('id') id: string) {
    return this.svc.getPromotion(id);
  }

  @Post('promotions')
  createPromotion(@Body() dto: CreatePromotionDto, @Req() req: any) {
    return this.svc.createPromotion(dto, this.getAdminId(req));
  }

  @Put('promotions/:id')
  updatePromotion(@Param('id') id: string, @Body() dto: UpdatePromotionDto, @Req() req: any) {
    return this.svc.updatePromotion(id, dto, this.getAdminId(req));
  }

  @Patch('promotions/:id/status')
  setPromotionStatus(@Param('id') id: string, @Body() dto: SetPromotionStatusDto, @Req() req: any) {
    return this.svc.setPromotionStatus(id, dto, this.getAdminId(req));
  }

  @Delete('promotions/:id')
  deletePromotion(@Param('id') id: string, @Req() req: any) {
    return this.svc.deletePromotion(id, this.getAdminId(req));
  }

  // ── PROMOTION PRODUCTS ─────────────────────────────────────────────────────

  @Post('promotions/:id/products')
  addPromotionProducts(@Param('id') id: string, @Body() dto: AddPromotionProductsDto) {
    return this.svc.addPromotionProducts(id, dto);
  }

  @Delete('promotions/:id/products/:variantId')
  removePromotionProduct(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.svc.removePromotionProduct(id, variantId);
  }

  @Get('promotions/:id/redemptions')
  getPromotionRedemptions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getPromotionRedemptions(id, Number(page || 1), Number(limit || 50));
  }

  // ── COUPONS ────────────────────────────────────────────────────────────────

  @Get('coupons')
  listCoupons() {
    return this.svc.listCoupons();
  }

  @Get('coupons/:id')
  getCoupon(@Param('id') id: string) {
    return this.svc.getCoupon(id);
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto, @Req() req: any) {
    return this.svc.createCoupon(dto, this.getAdminId(req));
  }

  @Put('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto, @Req() req: any) {
    return this.svc.updateCoupon(id, dto, this.getAdminId(req));
  }

  @Patch('coupons/:id/status')
  setCouponStatus(@Param('id') id: string, @Body() dto: SetCouponStatusDto, @Req() req: any) {
    return this.svc.setCouponStatus(id, dto, this.getAdminId(req));
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteCoupon(id, this.getAdminId(req));
  }

  @Get('coupons/:id/redemptions')
  getCouponRedemptions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getCouponRedemptions(id, Number(page || 1), Number(limit || 50));
  }
}
