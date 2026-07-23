// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : subscriptions.controller.ts
// Description : Customer subscription management endpoints (Phase 2 — full feature parity)
//
// ============================================================================

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Public } from 'src/auth/decorators/public.decorator';
import { SubscriptionsService } from '../ModuleServices/subscriptions.service';
import { Request } from 'express';

@Controller({ path: 'customer', version: '1' })
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) { }

  // ── GET subscriptions list ────────────────────────────────────────────
  @Get('subscriptions')
  @UseGuards(AuthGuard('jwt'))
  getSubscriptions(@Req() req: Request) {
    const user = req.user as any;
    return this.service.getSubscriptions(user?.user_id, user?.email);
  }

  // ── GET tomorrow delivery preview (what arrives, can skip/modify) ─────
  @Get('subscriptions/:id/tomorrow')
  @UseGuards(JwtAuthGuard)
  getTomorrowPreview(@Param('id') id: string) {
    return this.service.getTomorrowPreview(id);
  }

  // ── GET enhanced calendar (month view with history) ───────────────────
  @Get('subscriptions/:id/calendar')
  @UseGuards(JwtAuthGuard)
  getCalendar(@Param('id') id: string, @Query('month') month?: string) {
    return this.service.getEnhancedCalendar(id, month);
  }

  // ── Kept for backward compat — redirect to enhanced calendar ──────────
  @Public()
  @Get('subscription-calender/:subscriptionId')
  getSubscriptionCalender(@Param('subscriptionId') subscriptionId: string, @Query('month') month?: string) {
    return this.service.getEnhancedCalendar(subscriptionId, month);
  }

  // ── POST skip a single delivery date ─────────────────────────────────
  @Post('subscriptions/:id/skip')
  @UseGuards(JwtAuthGuard)
  skipDelivery(
    @Param('id') id: string,
    @Body() body: { date: string },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.skipDelivery(id, body.date, user?.user_id);
  }

  // ── POST override quantity for a date ────────────────────────────────
  @Post('subscriptions/:id/override')
  @UseGuards(JwtAuthGuard)
  overrideQuantity(
    @Param('id') id: string,
    @Body() body: { date: string; item_id?: string; m_quantity?: number; e_quantity?: number },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.overrideQuantity(id, body, user?.user_id);
  }

  // ── POST add product item to existing subscription ───────────────────
  @Post('subscriptions/:id/add-item')
  @UseGuards(JwtAuthGuard)
  addItem(
    @Param('id') id: string,
    @Body() body: { product_variant_id: string; m_quantity: number; e_quantity: number; unit_price?: number },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.addSubscriptionItem(id, body, user?.user_id);
  }

  // ── DELETE remove item from subscription ─────────────────────────────
  @Public()
  @Post('subscription-items/:id/cancel')
  async cancelSubscriptionItem(@Param('id') id: string) {
    return this.service.cancelSubscriptionItem(id);
  }

  // ── PATCH change delivery address for subscription ────────────────────
  @Patch('subscriptions/:id/address')
  @UseGuards(JwtAuthGuard)
  changeAddress(
    @Param('id') id: string,
    @Body() body: { address_id: string },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.changeAddress(id, body.address_id, user?.user_id);
  }

  // ── POST pause subscription ───────────────────────────────────────────
  @Public()
  @Post('subscriptions/:id/pause')
  async pauseSubscription(
    @Param('id') id: string,
    @Body() body: { startDate?: string; endDate?: string },
  ) {
    return this.service.pauseSubscription(id, body.startDate, body.endDate);
  }

  // ── POST resume subscription ──────────────────────────────────────────
  @Public()
  @Post('subscriptions/:id/resume')
  async resumeSubscription(@Param('id') id: string) {
    return this.service.resumeSubscription(id);
  }

  // ── POST cancel subscription ──────────────────────────────────────────
  @Public()
  @Post('subscriptions/:id/cancel')
  async cancelSubscription(
    @Param('id') id: string,
    @Body() body: { cancelReason?: string; endDate?: string },
  ) {
    return this.service.cancelSubscription(id, body.cancelReason, body.endDate);
  }

  // ── GET pause history ─────────────────────────────────────────────────
  @Public()
  @Get('subscriptions/:id/pause-history')
  async getPauseHistory(@Param('id') id: string) {
    return this.service.getPauseHistory(id);
  }
}
