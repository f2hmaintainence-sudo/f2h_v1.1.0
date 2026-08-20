// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : refund-processing.service.ts
// Description : The single writer that turns approved refund candidates into
//               money in a customer's wallet.
//
//               Everything for one customer commits together: the payout row,
//               the candidate status changes, the wallet credit and its ledger
//               entry, the pause bookkeeping and the audit log. A failure at any
//               point rolls the whole thing back, so a wallet can never be
//               credited without the candidates being marked refunded — or the
//               reverse.
//
//               Candidates are re-read FOR UPDATE inside the transaction, so two
//               admins clicking approve at the same time cannot both pay out.
// ============================================================================

import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import {
  WalletLedgerService,
  WalletMovementResult,
} from '../../../../../shared/payments/wallet-ledger.service';

/** Statuses a candidate may be in and still be payable. */
const PAYABLE_STATUSES = ['pending', 'reviewed'];

export interface PayoutSummary {
  payout_id: string;
  refund_number: string;
  customer_id: string;
  total_amount: number;
  total_deliveries: number;
  wallet_transaction_id: string;
  balance_after: number;
}

@Injectable()
export class RefundProcessingService {
  private readonly logger = new Logger(RefundProcessingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletLedgerService,
  ) {}

  private buildRefundNumber(): string {
    const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    return `SRF${ts}${rnd}`;
  }

  /**
   * Approves and pays out the given candidates, one payout per customer.
   *
   * @param candidateIds candidates to pay; each must still be pending/reviewed
   * @param adminId      who approved — recorded on payout, candidates and audit
   */
  async approveAndProcess(
    candidateIds: string[],
    adminId: string,
  ): Promise<PayoutSummary[]> {
    if (!candidateIds?.length) {
      throw new BadRequestException('No candidate IDs provided');
    }

    // Group first so each customer gets one payout in its own transaction: one
    // customer failing must not strand another customer's credit.
    const grouped = await this.groupByCustomer(candidateIds);
    const payouts: PayoutSummary[] = [];
    const notifications: Array<{ customerId: string; result: WalletMovementResult }> = [];

    for (const [customerId, ids] of grouped.entries()) {
      const { summary, credit } = await this.processCustomer(customerId, ids, adminId);
      payouts.push(summary);
      notifications.push({ customerId, result: credit });
    }

    // Only once the money is committed does the customer hear about it.
    for (const n of notifications) {
      await this.wallet
        .notifyCreditCommitted(n.customerId, n.result)
        .catch((err) => this.logger.warn(`Refund notification failed: ${err?.message}`));
    }

    return payouts;
  }

  private async groupByCustomer(candidateIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.db.query<any>(
      `SELECT refund_candidate_id, customer_id, status
         FROM subscription_refund_candidates
        WHERE refund_candidate_id = ANY($1::varchar[])
          AND deleted_at IS NULL`,
      [candidateIds],
    );

    if (!rows?.length) {
      throw new BadRequestException('No matching refund candidates found');
    }

    const alreadyPaid = rows.filter((r: any) => r.status === 'refunded');
    if (alreadyPaid.length) {
      throw new BadRequestException(
        `${alreadyPaid.length} candidate(s) are already refunded`,
      );
    }

    const payable = rows.filter((r: any) => PAYABLE_STATUSES.includes(r.status));
    if (!payable.length) {
      throw new BadRequestException('No candidates are in a payable state');
    }

    const grouped = new Map<string, string[]>();
    for (const row of payable) {
      const list = grouped.get(row.customer_id) ?? [];
      list.push(row.refund_candidate_id);
      grouped.set(row.customer_id, list);
    }
    return grouped;
  }

  /** One customer, one payout, one transaction. */
  private async processCustomer(
    customerId: string,
    candidateIds: string[],
    adminId: string,
  ): Promise<{ summary: PayoutSummary; credit: WalletMovementResult }> {
    const refundNumber = this.buildRefundNumber();

    return this.db.transaction(async (client) => {
      // 1. Lock the candidates and re-validate under the lock.
      const locked = await client.query(
        `SELECT refund_candidate_id, subscription_id, scheduled_date,
                refund_amount, status
           FROM subscription_refund_candidates
          WHERE refund_candidate_id = ANY($1::varchar[])
            AND customer_id = $2
            AND deleted_at IS NULL
          FOR UPDATE`,
        [candidateIds, customerId],
      );

      const rows = locked.rows ?? [];
      const stale = rows.filter((r: any) => !PAYABLE_STATUSES.includes(r.status));
      if (stale.length) {
        throw new BadRequestException(
          `${stale.length} candidate(s) changed status while approving — refresh and retry`,
        );
      }
      if (!rows.length) {
        throw new BadRequestException('Refund candidates are no longer available');
      }

      const totalAmount =
        Math.round(rows.reduce((s: number, r: any) => s + Number(r.refund_amount ?? 0), 0) * 100) /
        100;
      if (!(totalAmount > 0)) {
        throw new BadRequestException('Refund total must be greater than zero');
      }

      const ids = rows.map((r: any) => r.refund_candidate_id);
      const subscriptionIds = [...new Set(rows.map((r: any) => r.subscription_id))];

      // 2. Payout header.
      const payoutRows = await client.query(
        `INSERT INTO subscription_refund_payouts
           (refund_number, customer_id, total_amount, total_deliveries, status, approved_by, approved_at)
         VALUES ($1, $2, $3, $4, 'approved', $5, NOW())
         RETURNING refund_payout_id`,
        [refundNumber, customerId, totalAmount, rows.length, adminId],
      );
      const payoutId = payoutRows.rows[0].refund_payout_id;

      // 3. Candidates -> approved.
      await client.query(
        `UPDATE subscription_refund_candidates
            SET status = 'approved', refund_payout_id = $1,
                approved_by = $2, approved_at = NOW(), updated_at = NOW()
          WHERE refund_candidate_id = ANY($3::varchar[])`,
        [payoutId, adminId, ids],
      );

      // 4. Wallet credit, joined to this transaction.
      const credit = await this.wallet.credit(
        {
          customerId,
          amount: totalAmount,
          referenceType: 'subscription_refund',
          referenceId: payoutId,
          remarks: `Prepaid subscription refund ${refundNumber} — ${rows.length} delivery day(s)`,
          createdBy: adminId,
        },
        client,
      );

      // 5. Payout -> processed.
      await client.query(
        `UPDATE subscription_refund_payouts
            SET status = 'processed', wallet_transaction_id = $1,
                processed_at = NOW(), updated_at = NOW(),
                notes = COALESCE(notes, '') || $2
          WHERE refund_payout_id = $3`,
        [credit.transactionId, `Processed by ${adminId}`, payoutId],
      );

      // 6. Candidates -> refunded.
      await client.query(
        `UPDATE subscription_refund_candidates
            SET status = 'refunded', updated_at = NOW()
          WHERE refund_payout_id = $1`,
        [payoutId],
      );

      // 7. A pause is only settled once every candidate it produced is refunded —
      //    never blanket-mark a subscription's pauses.
      await client.query(
        `UPDATE subscription_pauses sp
            SET is_refunded = true, updated_at = NOW()
          WHERE sp.subscription_id = ANY($1::varchar[])
            AND sp.deleted_at IS NULL
            AND sp.is_refunded = false
            AND EXISTS (
              SELECT 1 FROM subscription_refund_candidates c
               WHERE c.subscription_id = sp.subscription_id
                 AND c.scheduled_date BETWEEN sp.start_date AND sp.end_date
                 AND c.status = 'refunded'
                 AND c.deleted_at IS NULL
            )
            AND NOT EXISTS (
              SELECT 1 FROM subscription_refund_candidates c
               WHERE c.subscription_id = sp.subscription_id
                 AND c.scheduled_date BETWEEN sp.start_date AND sp.end_date
                 AND c.status IN ('pending', 'reviewed', 'approved')
                 AND c.deleted_at IS NULL
            )`,
        [subscriptionIds],
      );

      // 8. Audit trail.
      await client.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, created_at)
         VALUES ($1, 'subscription_refund_processed', 'subscription_refund_payout', $2, $3, NOW())`,
        [
          adminId,
          payoutId,
          JSON.stringify({
            refund_number: refundNumber,
            customer_id: customerId,
            total_amount: totalAmount,
            candidate_count: rows.length,
            candidate_ids: ids,
            wallet_transaction_id: credit.transactionId,
            balance_after: credit.balanceAfter,
          }),
        ],
      );

      return {
        summary: {
          payout_id: payoutId,
          refund_number: refundNumber,
          customer_id: customerId,
          total_amount: totalAmount,
          total_deliveries: rows.length,
          wallet_transaction_id: credit.transactionId,
          balance_after: credit.balanceAfter,
        },
        credit,
      };
    });
  }
}
