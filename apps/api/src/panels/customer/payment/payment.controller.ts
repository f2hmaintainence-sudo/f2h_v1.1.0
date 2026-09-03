// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment.controller.ts
// Description : Customer payment endpoints — Razorpay order creation,
//               verification, history, bill settlement and gateway webhook.
//
// ============================================================================

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { RequireIntegrity } from 'src/shared/play-integrity/decorators/require-integrity.decorator';
import { CustomerPaymentService } from './payment.service';
import {
  CreatePaymentOrderDto,
  VerifyPaymentDto,
  PayBillFromWalletDto,
} from './dto/payment.dto';

function resolveUserId(req: Request): string {
  const user = req.user as any;
  return user?.user_id || user?.userId || user?.id || user?.customer_id;
}

@Controller({ path: 'customer/payment', version: '1' })
export class CustomerPaymentController {
  constructor(private readonly paymentService: CustomerPaymentService) {}

  // ── Gateway config (key id only — never the secret) ──
  @Get('config')
  @UseGuards(AuthGuard('jwt'))
  async getGatewayConfig() {
    return this.paymentService.getGatewayConfig();
  }

  // ── Razorpay order lifecycle ──
  @RequireIntegrity('customer')
  @Post('create-order')
  @UseGuards(AuthGuard('jwt'))
  async createOrder(@Req() req: Request, @Body() body: CreatePaymentOrderDto) {
    return this.paymentService.createOrder(resolveUserId(req), body);
  }

  @RequireIntegrity('customer')
  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  async verifyPayment(@Req() req: Request, @Body() body: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(resolveUserId(req), body);
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  async getPaymentHistory(@Req() req: Request, @Query('limit') limit?: string) {
    return this.paymentService.getPaymentHistory(
      resolveUserId(req),
      limit ? Number(limit) : 50,
    );
  }

  // ── Bills ──
  @Get('unpaid-bills')
  @UseGuards(AuthGuard('jwt'))
  async getUnpaidBills(@Req() req: Request) {
    return this.paymentService.getUnpaidBills(resolveUserId(req));
  }

  @RequireIntegrity('customer')
  @Post('pay-wallet')
  @UseGuards(AuthGuard('jwt'))
  async payBillFromWallet(
    @Req() req: Request,
    @Body() body: PayBillFromWalletDto,
  ) {
    return this.paymentService.payBillFromWallet(
      resolveUserId(req),
      body?.bill_id,
    );
  }

  // ── Legacy aliases kept so older app builds keep working ──
  @RequireIntegrity('customer')
  @Post('pay-online-init')
  @UseGuards(AuthGuard('jwt'))
  async payBillOnlineInit(@Req() req: Request, @Body() body: any) {
    return this.paymentService.createOrder(resolveUserId(req), {
      purpose: 'bill',
      bill_id: body?.bill_id,
    });
  }

  @RequireIntegrity('customer')
  @Post('verify-online')
  @UseGuards(AuthGuard('jwt'))
  async verifyBillOnlinePayment(
    @Req() req: Request,
    @Body() body: VerifyPaymentDto,
  ) {
    return this.paymentService.verifyPayment(resolveUserId(req), body);
  }
}

@Controller({ path: 'payments/razorpay', version: '1' })
export class RazorpayWebhookController {
  constructor(private readonly paymentService: CustomerPaymentService) {}

  /**
   * Razorpay → F2H webhook. Authenticated by HMAC signature over the raw body,
   * so it must stay outside the JWT guard.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request & { rawBody?: string },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    return this.paymentService.handleWebhook(rawBody, signature);
  }
}
