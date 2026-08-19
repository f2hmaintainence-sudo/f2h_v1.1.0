import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateCandidateInput,
  RefundCandidatesRepository,
} from './refund-candidates.repository';
import { DatabaseService } from '../../../../../shared/database/Database.service';

@Injectable()
export class RefundCandidatesService {
  private readonly logger = new Logger(RefundCandidatesService.name);

  constructor(
    private readonly repo: RefundCandidatesRepository,
    private readonly db: DatabaseService,
  ) {}

  // ─── Candidate Creation (called from cron / order handlers) ─────────────────

  /**
   * Idempotent create — safe to call multiple times for the same slot.
   * Logs and swallows errors so it never interrupts the calling flow.
   */
  async createRefundCandidate(input: CreateCandidateInput): Promise<string | null> {
    try {
      return await this.repo.createCandidate(input);
    } catch (err) {
      this.logger.error('Failed to create refund candidate', { err, input });
      return null;
    }
  }

  // ─── Summary Cards ───────────────────────────────────────────────────────────

  async getSummary() {
    try {
      const data = await this.repo.getSummary();
      return {
        status: true,
        data: {
          pending_count: Number(data.pending_count ?? 0),
          refunded_count: Number(data.refunded_count ?? 0),
          rejected_count: Number(data.rejected_count ?? 0),
          pending_amount: Number(data.pending_amount ?? 0),
          refunded_amount: Number(data.refunded_amount ?? 0),
          pending_customers: Number(data.pending_customers ?? 0),
        },
      };
    } catch (err) {
      this.logger.error('getSummary error', err);
      throw new InternalServerErrorException('Failed to fetch summary');
    }
  }

  // ─── Paginated Table ─────────────────────────────────────────────────────────

  async getTable(query: any) {
    try {
      const { rows, total } = await this.repo.getTable(query);
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
      return {
        status: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      this.logger.error('getTable error', err);
      throw new InternalServerErrorException('Failed to fetch refund candidates');
    }
  }

  // ─── Customer Groups ─────────────────────────────────────────────────────────

  async getCustomerGroups(query: any) {
    try {
      const rows = await this.repo.getCustomerGroups(query);
      return { status: true, data: rows };
    } catch (err) {
      this.logger.error('getCustomerGroups error', err);
      throw new InternalServerErrorException('Failed to fetch customer groups');
    }
  }

  // ─── Bulk Approve → create one payout per customer, credit wallet ────────────

  async bulkApprove(candidateIds: string[], adminId: string) {
    if (!candidateIds?.length) {
      throw new BadRequestException('No candidate IDs provided');
    }

    // Fetch the selected candidates
    const candidates = await this.repo.getCandidatesByIds(candidateIds);

    // Filter: only pending, not already refunded
    const eligible = candidates.filter((c) => c.status === 'pending');
    if (!eligible.length) {
      throw new BadRequestException('No eligible pending candidates found');
    }

    // Check for already-refunded duplicates
    const alreadyRefunded = candidates.filter((c) => c.status === 'refunded');
    if (alreadyRefunded.length) {
      throw new BadRequestException(
        `${alreadyRefunded.length} candidates are already refunded`,
      );
    }

    // Group by customer
    const byCustomer = new Map<string, typeof eligible>();
    for (const c of eligible) {
      if (!byCustomer.has(c.customer_id)) byCustomer.set(c.customer_id, []);
      byCustomer.get(c.customer_id)!.push(c);
    }

    const payouts: any[] = [];
    for (const [customerId, items] of byCustomer.entries()) {
      const totalAmount = items.reduce((s, c) => s + Number(c.refund_amount ?? 0), 0);
      const totalDeliveries = items.length;
      const ids = items.map((c) => c.refund_candidate_id);

      // Generate refund number
      const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
      const suffix = Math.floor(Math.random() * 9000 + 1000);
      const refundNumber = `SRF${ts}${suffix}`;

      // Create payout record
      const payoutId = await this.repo.createPayout({
        refund_number: refundNumber,
        customer_id: customerId,
        total_amount: totalAmount,
        total_deliveries: totalDeliveries,
        approved_by: adminId,
      });

      // Update candidates to approved
      await this.repo.approveCandidates(ids, payoutId, adminId);

      // Immediately credit wallet (approve + process in one step)
      const walletTxId = await this.repo.creditCustomerWallet(
        customerId,
        totalAmount,
        payoutId,
        refundNumber,
      );

      // Mark payout as processed
      await this.repo.updatePayoutProcessed(payoutId, walletTxId);

      // Mark candidates as refunded
      await this.repo.markRefunded(payoutId);

      payouts.push({
        payout_id: payoutId,
        refund_number: refundNumber,
        customer_id: customerId,
        total_amount: totalAmount,
        total_deliveries: totalDeliveries,
        wallet_transaction_id: walletTxId,
      });
    }

    return {
      status: true,
      message: `Approved and credited ${eligible.length} refund(s) across ${payouts.length} customer(s)`,
      data: payouts,
    };
  }

  // ─── Bulk Reject ─────────────────────────────────────────────────────────────

  async bulkReject(candidateIds: string[], adminId: string, notes?: string) {
    if (!candidateIds?.length) {
      throw new BadRequestException('No candidate IDs provided');
    }
    const count = await this.repo.rejectCandidates(candidateIds, adminId, notes);
    return {
      status: true,
      message: `Rejected ${count} refund candidate(s)`,
      data: { rejected_count: count },
    };
  }

  // ─── Single Approve ───────────────────────────────────────────────────────────

  async approveSingle(candidateId: string, adminId: string) {
    return this.bulkApprove([candidateId], adminId);
  }

  // ─── Single Reject ────────────────────────────────────────────────────────────

  async rejectSingle(candidateId: string, adminId: string, notes?: string) {
    return this.bulkReject([candidateId], adminId, notes);
  }

  // ─── Payouts List ─────────────────────────────────────────────────────────────

  async getPayouts(query: any) {
    try {
      const { rows, total } = await this.repo.getPayouts(query);
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
      return {
        status: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      this.logger.error('getPayouts error', err);
      throw new InternalServerErrorException('Failed to fetch payouts');
    }
  }

  // ─── Payout Detail ────────────────────────────────────────────────────────────

  async getPayoutById(payoutId: string) {
    const payout = await this.repo.getPayoutById(payoutId);
    if (!payout) throw new NotFoundException('Payout not found');
    return { status: true, data: payout };
  }

  // ─── Create refund candidates for remaining days on subscription cancellation ─

  /**
   * Called when a prepaid subscription is cancelled mid-period.
   * Creates refund candidates for all remaining scheduled delivery days.
   * This is idempotent — duplicates are skipped via ON CONFLICT.
   */
  async createCandidatesForCancellation(
    subscriptionId: string,
    fromDate: string,
    adminId: string,
  ): Promise<number> {
    try {
      const days = await this.repo.getRemainingScheduledDays(subscriptionId, fromDate);
      let created = 0;
      for (const day of days) {
        const slots: Array<{ slot: 'morning' | 'evening'; qty: number }> = [];
        if (Number(day.m_quantity) > 0) slots.push({ slot: 'morning', qty: Number(day.m_quantity) });
        if (Number(day.e_quantity) > 0) slots.push({ slot: 'evening', qty: Number(day.e_quantity) });

        for (const { slot, qty } of slots) {
          const finalPrice = Number(day.final_price ?? 0);
          const candidate = await this.repo.createCandidate({
            subscription_id: subscriptionId,
            subscription_item_id: day.subscription_item_id ?? day.si_raw_id,
            customer_id: day.customer_id,
            scheduled_date: day.scheduled_date,
            delivery_slot: slot,
            quantity: qty,
            unit_price: Number(day.unit_price ?? 0),
            final_price: finalPrice,
            refund_amount: Math.round(qty * finalPrice * 100) / 100,
            refund_reason: 'cancelled',
            source: 'pause',
            notes: `Auto-created on subscription cancellation by admin ${adminId}`,
          });
          if (candidate) created++;
        }
      }
      this.logger.log(
        `Created ${created} refund candidates for cancelled subscription ${subscriptionId}`,
      );
      return created;
    } catch (err) {
      this.logger.error('createCandidatesForCancellation error', { err, subscriptionId });
      return 0;
    }
  }
}
