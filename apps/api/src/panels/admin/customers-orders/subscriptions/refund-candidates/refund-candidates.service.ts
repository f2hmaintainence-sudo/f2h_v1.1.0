import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CreateCandidateInput,
  RefundCandidatesRepository,
} from './refund-candidates.repository';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';
import { RefundEligibilityService } from './refund-eligibility.service';
import { RefundProcessingService } from './refund-processing.service';

@Injectable()
export class RefundCandidatesService {
  private readonly logger = new Logger(RefundCandidatesService.name);

  constructor(
    private readonly repo: RefundCandidatesRepository,
    private readonly db: DatabaseService,
    private readonly cronLock: CronLockService,
    private readonly eligibility: RefundEligibilityService,
    private readonly processing: RefundProcessingService,
  ) {}

  // ─── Scheduled month-close scan ────────────────────────────────────────────

  /**
   * Materialises the closed month's refund candidates at 00:20 IST on the 1st.
   *
   * Until this existed, nothing ever called `scan()` on a schedule: candidates
   * only appeared when an admin pressed "Run Live Scan" in the developer panel,
   * so `subscription_refund_candidates` stayed empty every month while paused
   * days and failed deliveries accumulated unrefunded.
   *
   * It runs after the 00:05 postpaid billing cron so the two never contend, and
   * `scan()` is keyed per paused day / failed order — re-running a month adds
   * nothing, so a retry or a manual admin scan on top of this is safe.
   */
  @Cron('0 20 0 1 * *', { timeZone: 'Asia/Kolkata' })
  async handleMonthlyRefundScanCron() {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleMonthlyRefundScanCron', 3600))) return;

    const now = new Date();
    const closed = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${closed.getFullYear()}-${String(closed.getMonth() + 1).padStart(2, '0')}`;

    this.logger.log(`Executing monthly refund candidate scan for ${month} (@Cron 0 20 0 1 * *)...`);
    try {
      const res = await this.eligibility.scan({ month });
      this.logger.log(
        `Monthly refund scan finished for ${month}: ${res.found} refundable item(s) — ` +
          `${res.created} new, ${res.skipped_existing} already tracked`,
      );
    } catch (err: any) {
      this.logger.error(
        `Monthly refund candidate scan failed for ${month}: ${err?.message}`,
        err?.stack,
      );
    }
  }

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

  /**
   * Approves and pays out. All the money movement lives in
   * RefundProcessingService so payout, candidate status and wallet credit share
   * one transaction — see that file for the ordering.
   */
  async bulkApprove(candidateIds: string[], adminId: string) {
    const payouts = await this.processing.approveAndProcess(candidateIds, adminId);
    const refunded = payouts.reduce((sum, p) => sum + p.total_deliveries, 0);

    return {
      status: true,
      message: `Approved and credited ${refunded} refund(s) across ${payouts.length} customer(s)`,
      data: payouts,
    };
  }

  // ─── Review step (Eligible → Reviewed) ───────────────────────────────────────

  /**
   * Marks candidates as reviewed. This is the checkpoint before money moves:
   * an admin has opened the calculation and agrees with it.
   */
  async bulkReview(candidateIds: string[], adminId: string, notes?: string) {
    if (!candidateIds?.length) {
      throw new BadRequestException('No candidate IDs provided');
    }
    const count = await this.repo.reviewCandidates(candidateIds, adminId, notes);
    if (!count) {
      throw new BadRequestException('No pending candidates were available to review');
    }
    return {
      status: true,
      message: `Marked ${count} refund(s) as reviewed`,
      data: { reviewed_count: count },
    };
  }

  async reviewSingle(candidateId: string, adminId: string, notes?: string) {
    return this.bulkReview([candidateId], adminId, notes);
  }

  /** Full detail for the review drawer, including how the amount was derived. */
  async getCandidateDetail(candidateId: string) {
    const detail = await this.repo.getCandidateDetail(candidateId);
    if (!detail) throw new NotFoundException('Refund candidate not found');
    return { status: true, data: detail };
  }

  // ─── Eligibility scan ────────────────────────────────────────────────────────

  /** Recalculates refundable days/orders for a month or explicit date range. */
  async scan(filters: any) {
    const result = await this.eligibility.scan(filters ?? {});
    return {
      status: true,
      message: `${result.found} refundable item(s) found — ${result.created} new, ${result.skipped_existing} already tracked`,
      data: result,
    };
  }

  /** Same calculation, nothing written — used to preview before scanning. */
  async previewScan(filters: any) {
    const { range, rows } = await this.eligibility.preview(filters ?? {});

    // Group rows by customer -> subscriptions -> line items
    const customerMap = new Map<string, any>();
    for (const row of rows) {
      const cId = row.customer_id;
      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          customer_id: cId,
          customer_name: row.customer_name || 'Customer',
          customer_phone: row.customer_phone || '',
          total_candidates: 0,
          total_refund_amount: 0,
          pause_count: 0,
          failed_count: 0,
          subscriptions_map: new Map<string, any>(),
        });
      }
      const cust = customerMap.get(cId);
      cust.total_candidates++;
      cust.total_refund_amount = Math.round((cust.total_refund_amount + row.refund_amount) * 100) / 100;
      if (row.source === 'pause') cust.pause_count++;
      else cust.failed_count++;

      const subId = row.subscription_id;
      if (!cust.subscriptions_map.has(subId)) {
        cust.subscriptions_map.set(subId, {
          subscription_id: subId,
          product_name: row.product_name || 'Product',
          variant_name: row.variant_name || '',
          total_candidates: 0,
          total_refund_amount: 0,
          pause_count: 0,
          failed_count: 0,
          items: [],
        });
      }
      const sub = cust.subscriptions_map.get(subId);
      sub.total_candidates++;
      sub.total_refund_amount = Math.round((sub.total_refund_amount + row.refund_amount) * 100) / 100;
      if (row.source === 'pause') sub.pause_count++;
      else sub.failed_count++;
      sub.items.push(row);
    }

    const grouped = Array.from(customerMap.values()).map((c) => ({
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      customer_phone: c.customer_phone,
      total_candidates: c.total_candidates,
      total_refund_amount: c.total_refund_amount,
      pause_count: c.pause_count,
      failed_count: c.failed_count,
      subscriptions: Array.from(c.subscriptions_map.values()),
    }));

    return {
      status: true,
      data: {
        range,
        count: rows.length,
        total_amount: Math.round(rows.reduce((s, r) => s + r.refund_amount, 0) * 100) / 100,
        rows,
        grouped,
      },
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
