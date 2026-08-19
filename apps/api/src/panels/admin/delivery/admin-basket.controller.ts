import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { BasketService } from '../../delivery-partner/orders/services/basket.service';

@Controller({ path: 'admin/delivery/baskets', version: '1' })
@UseGuards(JwtAuthGuard)
export class AdminBasketController {
  constructor(private readonly basketService: BasketService) {}

  @Get('overview')
  async getAllPartnersBasketOverview(@Query('date') dateParam?: string) {
    return this.basketService.getAllPartnersBasketOverview(dateParam);
  }

  @Get('summary')
  async getPartnerBasketSummary(
    @Query('partner_id') partnerId?: string,
    @Query('run_id') runId?: string,
  ) {
    if (!partnerId) throw new BadRequestException('partner_id is required');
    return this.basketService.getBasketSummary(partnerId, runId);
  }

  @Post('emergency-stock')
  @HttpCode(HttpStatus.OK)
  async addEmergencyStock(@Request() req: any, @Body() body: any) {
    const adminId = req.user?.user_id || 'ADMIN';
    const partnerId = body.partner_id || body.partnerId;
    const variantId = body.variant_id || body.variantId;
    const quantity = Number(body.quantity || 1);
    const reason = body.reason;

    if (!partnerId || !variantId) {
      throw new BadRequestException('partner_id and variant_id are required');
    }

    return this.basketService.addEmergencyStock(adminId, partnerId, variantId, quantity, reason);
  }

  @Post(':basketId/reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcileBasket(
    @Request() req: any,
    @Param('basketId') basketId: string,
    @Body() body: any,
  ) {
    const adminId = req.user?.user_id || 'ADMIN';
    return this.basketService.reconcileBasket(basketId, adminId, body.notes);
  }
}
