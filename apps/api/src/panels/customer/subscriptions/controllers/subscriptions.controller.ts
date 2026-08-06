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
  async checkout(@Req() req: Request, @Body() body: CreateSubscriptionDto) {
    try {
      console.log("i am from subscription checkout", JSON.stringify(body));
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
      const result = await this.service.checkout(body, req);
      return result;
    } catch (err) {
      console.error('SUBSCRIPTION CHECKOUT ERROR:', err?.message || err, err?.stack);
      // Return structured error instead of raw 500
      return {
        status: false,
        error_code: 'server_error',
        message: err?.message || 'Subscription checkout failed',
        debug: String(err),
      };
    }
  }

  @Public()
  @Get()
  getSubscriptions(@Req() req: Request) {
    const user = req.user as any;
    let userId = user?.user_id || (req.headers['x-user-id'] as string)?.trim();
    let email = user?.email;
    if (!userId && req.headers['authorization']) {
      try {
        const token = (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '');
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.decode(token);
        if (decoded?.user_id || decoded?.sub) {
          userId = decoded.user_id || decoded.sub;
          email = decoded.email || email;
        }
      } catch (_) {}
    }
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
  async resumeSubscription(
    @Param('id') id: string,
    @Body() body: { resume_date?: string },
  ) {
    return this.service.resumeSubscription(id, body?.resume_date);
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

  @Public()
  @Patch(':id/auto-renew')
  async updateAutoRenew(
    @Param('id') id: string,
    @Body() body: { auto_renew: boolean },
  ) {
    return this.service.updateAutoRenew(id, body.auto_renew);
  }

  // @Public()
  // @Post(':id/cancel')
  // async cancelSubscriptionItem(@Param('id') id: string) {
  //   return this.service.cancelSubscriptionItem(id);
  // }
}
