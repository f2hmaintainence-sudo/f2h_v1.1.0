// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment-reconciliation.cron.ts
// Description : Sweeps captured-but-unconsumed online payments into the
//               customer's wallet so money is never left stranded when an app
//               drops out between "payment captured" and "order created".
//
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CustomerPaymentService } from './payment.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';

@Injectable()
export class PaymentReconciliationCron {
  private readonly logger = new Logger(PaymentReconciliationCron.name);

  constructor(
    private readonly paymentService: CustomerPaymentService,
    private readonly developer: DeveloperService,
    private readonly cronLock: CronLockService,
  ) {}

  /** Every 10 minutes. */
  @Cron('0 */10 * * * *', { timeZone: 'Asia/Kolkata' })
  async sweepStrandedPayments(): Promise<void> {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('sweepStrandedPayments', 300))) return;

    try {
      const { swept } = await this.paymentService.reconcileStrandedOrderPayments();
      if (swept > 0) {
        this.logger.log(
          `[CRON] Swept ${swept} stranded online payment(s) into customer wallets.`,
        );
      }
    } catch (error) {
      this.developer.error('Payment reconciliation cron failed', { error });
      this.logger.error('[CRON] Payment reconciliation failed');
    }
  }
}
