import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../../../../shared/redis/redis.service';
import { SubscriptionSnapshotResultDto } from '../dto/subscription-snapshot-result.dto';
import { SubscriptionSnapshotRepository } from '../repository/subscription-snapshot.repository';
import { PdfService } from '../../../../../../common/pdf';

const LOCK_TTL_SECONDS = 60 * 60;

@Injectable()
export class SubscriptionSnapshotService {
  private readonly logger = new Logger(SubscriptionSnapshotService.name);

  constructor(
    private readonly repository: SubscriptionSnapshotRepository,
    private readonly redisService: RedisService,
    private readonly pdfService: PdfService,
  ) { }

  // ─── Pre-Dispatch Summary ───────────────────────────────────────────

  /**
   * Returns branch-wise aggregated quantities for eligible subscriptions.
   * Admins call this to review stock requirements before triggering generation.
   */
  async getPreDispatchSummary(
    targetDate: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ) {
    this.assertValidDate(targetDate);

    const startedAt = Date.now();
    const summary = await this.repository.getPreDispatchSummary(
      targetDate,
      slot,
      branchId,
    );

    this.logger.log(
      `Pre-dispatch summary for ${targetDate} (${slot}): ` +
      `${summary.length} product-branch groups in ${Date.now() - startedAt}ms`,
    );

    return {
      targetDate,
      slot,
      branchId: branchId || 'all',
      durationMs: Date.now() - startedAt,
      items: summary,
    };
  }

  // ─── Unified Order Processing (Subscriptions + One-Time) ──────────

  /**
   * Processes orders for the given date and slot:
   *
   *  1. Generate subscription orders (INSERT ... ON CONFLICT DO NOTHING)
   *  2. Insert order items for newly created subscription orders
   *  3. Insert audit logs for subscription order creation
   *  4. Confirm eligible one-time orders (placed → confirmed)
   *  5. Gather branch-wise statistics
   *
   * All steps are idempotent:
   *  - Subscription orders use ON CONFLICT DO NOTHING
   *  - One-time confirmation uses WHERE status = 'placed' guard
   *  - Repeated executions produce the same final state
   *
   * Used by BOTH the cron scheduler AND the admin manual trigger,
   * ensuring identical behavior in both paths.
   */
  async generateOrdersForDateAndSlot(
    targetDate: string,
    slot: 'morning' | 'evening',
    generationType: 'cron' | 'manual' = 'cron',
    branchId?: string | null,
  ): Promise<SubscriptionSnapshotResultDto> {
    this.assertValidDate(targetDate);

    const lockSuffix = branchId ? `:${branchId}` : '';
    const lockKey = `order_processing:${targetDate}:${slot}${lockSuffix}`;
    const lockToken = randomUUID();
    const startedAt = Date.now();
    let lockAcquired = false;

    try {
      lockAcquired = await this.acquireLock(lockKey, lockToken);

      if (!lockAcquired) {
        this.logger.warn(
          `Order processing skipped; lock already held for ${lockKey}`,
        );
        return this.buildResult({
          targetDate,
          slot,
          generationType,
          lockKey,
          startedAt,
          subscriptionOrdersCreated: 0,
          subscriptionItemsInserted: 0,
          subscriptionLogsInserted: 0,
          onetimeOrdersConfirmed: 0,
          onetimeOrdersSkipped: 0,
          branchStats: [],
          status: 'skipped',
          errors: [],
        });
      }

      // ── STEP 1: Generate subscription orders ────────────────────────
      const subscriptionOrdersCreated = await this.repository.insertOrdersFromSubscriptions(
        targetDate,
        slot,
        generationType,
        branchId,
      );

      // ── STEP 2: Insert order items (only if subscription orders were created)
      let subscriptionItemsInserted = 0;
      if (subscriptionOrdersCreated > 0) {
        subscriptionItemsInserted = await this.repository.insertOrderItemsFromSubscriptions(
          targetDate,
          slot,
          branchId,
        );
      }

      // ── STEP 3: Insert audit logs for subscription orders ───────────
      let subscriptionLogsInserted = 0;
      if (subscriptionOrdersCreated > 0) {
        subscriptionLogsInserted = await this.repository.insertOrderGenerationLogs(
          targetDate,
          slot,
          branchId,
        );
      }

      // ── STEP 4: Confirm eligible one-time orders (placed → confirmed)
      const onetimeOrdersConfirmed = await this.repository.confirmOneTimeOrders(
        targetDate,
        slot,
        branchId,
      );

      // ── STEP 5: Count skipped one-time orders (already beyond 'placed')
      const onetimeOrdersSkipped = await this.repository.countSkippedOneTimeOrders(
        targetDate,
        slot,
        branchId,
      );

      // ── STEP 6: Gather branch-wise statistics ──────────────────────
      const branchStats = await this.repository.getBranchWiseStats(
        targetDate,
        slot,
        branchId,
      );

      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Order processing completed: date=${targetDate} slot=${slot} ` +
        `branch=${branchId || 'all'} type=${generationType} ` +
        `sub_orders=${subscriptionOrdersCreated} sub_items=${subscriptionItemsInserted} ` +
        `sub_logs=${subscriptionLogsInserted} ` +
        `onetime_confirmed=${onetimeOrdersConfirmed} onetime_skipped=${onetimeOrdersSkipped} ` +
        `branches=${branchStats.length} duration=${durationMs}ms`,
      );

      return this.buildResult({
        targetDate,
        slot,
        generationType,
        lockKey,
        startedAt,
        subscriptionOrdersCreated,
        subscriptionItemsInserted,
        subscriptionLogsInserted,
        onetimeOrdersConfirmed,
        onetimeOrdersSkipped,
        branchStats,
        status: 'success',
        errors: [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Order processing failed for ${targetDate} (${slot}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Log process-level error
      try {
        await this.repository.logProcessError(
          null,
          'ORDER_PROCESSING_FAILED',
          message,
          targetDate,
          slot,
        );
      } catch (logErr) {
        this.logger.error(
          `Failed to write process-level error log: ${logErr instanceof Error ? logErr.message : String(logErr)}`,
        );
      }

      return this.buildResult({
        targetDate,
        slot,
        generationType,
        lockKey,
        startedAt,
        subscriptionOrdersCreated: 0,
        subscriptionItemsInserted: 0,
        subscriptionLogsInserted: 0,
        onetimeOrdersConfirmed: 0,
        onetimeOrdersSkipped: 0,
        branchStats: [],
        status: 'failed',
        errors: [message],
      });
    } finally {
      if (lockAcquired) {
        await this.releaseLock(lockKey, lockToken);
      }
    }
  }

  // ─── IST Date Helper ───────────────────────────────────────────────

  /**
   * Returns current IST date (or offset by N days) in YYYY-MM-DD format.
   */
  getIstDate(offsetDays = 0): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter
      .formatToParts(now)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

    const todayInIst = `${parts.year}-${parts.month}-${parts.day}`;
    if (offsetDays === 0) return todayInIst;

    const d = new Date(`${todayInIst}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  private async acquireLock(
    lockKey: string,
    lockToken: string,
  ): Promise<boolean> {
    const redis = this.redisService.getRedis();
    const result = await redis.set(
      lockKey,
      lockToken,
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(lockKey: string, lockToken: string): Promise<void> {
    const redis = this.redisService.getRedis();
    await redis.eval(
      `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
      `,
      1,
      lockKey,
      lockToken,
    );
  }

  private assertValidDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`targetDate must be in YYYY-MM-DD format: ${value}`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new Error(`targetDate is not a valid calendar date: ${value}`);
    }
  }

  private buildResult(params: {
    targetDate: string;
    slot: string;
    generationType: string;
    lockKey: string;
    startedAt: number;
    subscriptionOrdersCreated: number;
    subscriptionItemsInserted: number;
    subscriptionLogsInserted: number;
    onetimeOrdersConfirmed: number;
    onetimeOrdersSkipped: number;
    branchStats: any[];
    status: 'success' | 'skipped' | 'failed';
    errors: string[];
  }): SubscriptionSnapshotResultDto {
    const totalProcessed = params.subscriptionOrdersCreated + params.onetimeOrdersConfirmed;

    return {
      targetDate: params.targetDate,
      slot: params.slot,
      generationType: params.generationType,

      // Subscription details
      subscriptionOrdersCreated: params.subscriptionOrdersCreated,
      subscriptionItemsInserted: params.subscriptionItemsInserted,
      subscriptionLogsInserted: params.subscriptionLogsInserted,

      // One-time details
      onetimeOrdersConfirmed: params.onetimeOrdersConfirmed,
      onetimeOrdersSkipped: params.onetimeOrdersSkipped,

      // Aggregated
      totalProcessed,

      // Branch breakdown
      branchStats: params.branchStats,

      // Execution metadata
      durationMs: Date.now() - params.startedAt,
      status: params.status,
      lockKey: params.lockKey,
      errors: params.errors,

      // Legacy compat
      recordsInserted: params.subscriptionOrdersCreated,
      recordsUpdated: params.subscriptionItemsInserted,
    };
  }

  // ─── Dispatch Summary PDF ────────────────────────────────────────────

  /**
   * Generates a PDF report for the dispatch summary.
   * Supports both all-branches and single-branch modes.
   */
  async generateDispatchPdf(
    targetDate: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<Buffer> {
    this.assertValidDate(targetDate);

    const summary = await this.repository.getPreDispatchSummary(
      targetDate,
      slot,
      branchId,
    );

    const now = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    });

    const totalQty = summary.reduce(
      (sum: number, row: any) => sum + Number(row.total_quantity || 0),
      0,
    );
    const totalSubs = summary.reduce(
      (sum: number, row: any) => sum + Number(row.subscription_count || 0),
      0,
    );
    const branchCount = new Set(summary.map((r: any) => r.branch_id)).size;

    const branchLabel = branchId || 'All Branches';
    const slotLabel = slot === 'morning' ? 'Morning' : 'Evening';

    return this.pdfService.generateReport({
      title: `Dispatch Summary — ${targetDate}`,
      subtitle: `Slot: ${slotLabel} | Branch: ${branchLabel}`,
      generatedAt: now,
      summaryCards: [
        { label: 'Total Quantity', value: totalQty.toFixed(1), color: '#f0fdf4' },
        { label: 'Products', value: summary.length, color: '#eff6ff' },
        { label: 'Branches', value: branchCount, color: '#fefce8' },
        { label: 'Subscriptions', value: totalSubs, color: '#ecfdf5' },
      ],
      columns: [
        { header: 'Branch ID', key: 'branch_id', width: 90 },
        { header: 'Product', key: 'product_name', width: 100 },
        { header: 'Variant', key: 'variant_name', width: 100 },
        {
          header: 'Quantity',
          key: 'total_quantity',
          width: 80,
          align: 'right' as const,
          format: (v: unknown) => Number(v ?? 0).toFixed(1),
        },
        {
          header: 'Subscriptions',
          key: 'subscription_count',
          width: 80,
          align: 'right' as const,
          format: (v: unknown) => String(v ?? 0),
        },
        { header: 'Variant ID', key: 'product_variant_id', width: 100 },
      ],
      rows: summary as Record<string, unknown>[],
      footer: `Total Quantity: ${totalQty.toFixed(1)} | Products: ${summary.length} | Generated at ${now}`,
      orientation: 'landscape',
    });
  }

  /**
   * Retrieves branch-wise statistics for subscription orders created and one-time orders.
   */
  async getBranchWiseStats(
    targetDate: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ) {
    this.assertValidDate(targetDate);
    return this.repository.getBranchWiseStats(targetDate, slot, branchId);
  }
}
