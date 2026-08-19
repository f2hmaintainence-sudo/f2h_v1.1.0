// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment-gateway.module.ts
// Description : Global module exposing the Razorpay gateway client and the
//               shared wallet-credit ledger writer.
//
// ============================================================================

import { Global, Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { PushNotificationService } from '../pushNotifications/pushNotification.service';

@Global()
@Module({
  providers: [RazorpayService, WalletLedgerService, PushNotificationService],
  exports: [RazorpayService, WalletLedgerService],
})
export class PaymentGatewayModule {}
