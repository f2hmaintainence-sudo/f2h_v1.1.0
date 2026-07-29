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
import { CreateSubscriptionDto } from '../dto/subscription.dto';
import { Request } from 'express';

@Controller({ path: 'customer/subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) { }

  // @Public()
  // @Post()
  // create(@Body() body: CreateSubscriptionDto) {
  //   return this.service.create(body);
  // }

  @Public()
  @Post('checkout')
  checkout(@Req() req: Request, @Body() body: CreateSubscriptionDto) {
    console.log("i am from subscription checkout", body);
    const user = req?.user as any;
    let customerId = body.customer_id?.trim() || user?.user_id || (req.headers['x-user-id'] as string)?.trim();
    if (!customerId && req.headers['authorization']) {
      try {
        const token = (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '');
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.decode(token);
        if (decoded?.user_id || decoded?.sub) {
          customerId = decoded.user_id || decoded.sub;
        }
      } catch (_) {}
    }
    if (customerId) {
      body.customer_id = customerId;
    }
    return this.service.checkout(body, req);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getSubscriptions(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.user_id;
    const email = user?.email;
    return this.service.getSubscriptions(userId, email);
  }

  @Public()
  @Get('subscription-calender/:subscriptionId')
  getSubscriptionCalender(@Param('subscriptionId') subscriptionId: string) {
    return this.service.makeSubscriptionCalender(subscriptionId);
  }

  @Public()
  @Post(':id/pause')
  async pauseSubscription(
    @Param('id') id: string,
    @Body() body: { startDate?: string; endDate?: string },
  ) {
    return this.service.pauseSubscription(id, body.startDate, body.endDate);
  }

  @Public()
  @Post(':id/resume')
  async resumeSubscription(@Param('id') id: string) {
    return this.service.resumeSubscription(id);
  }

  @Public()
  @Post(':id/cancel')
  async cancelSubscription(
    @Param('id') id: string,
    @Body() body: { cancelReason?: string; endDate?: string },
  ) {
    return this.service.cancelSubscription(id, body.cancelReason, body.endDate);
  }

  @Public()
  @Get(':id/pause-history')
  async getPauseHistory(@Param('id') id: string) {
    return this.service.getPauseHistory(id);
  }

  @Public()
  @Get(':id/detail')
  async getSubscriptionDetail(@Param('id') id: string) {
    return this.service.getSubscriptionDetail(id);
  }

  @Public()
  @Get(':id/bills')
  async getSubscriptionBills(@Param('id') id: string) {
    return this.service.getSubscriptionBills(id);
  }

  // @Public()
  // @Post(':id/cancel')
  // async cancelSubscriptionItem(@Param('id') id: string) {
  //   return this.service.cancelSubscriptionItem(id);
  // }
}

