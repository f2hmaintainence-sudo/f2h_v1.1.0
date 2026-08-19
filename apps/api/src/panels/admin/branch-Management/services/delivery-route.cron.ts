import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { RouteService } from './route.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';

// ═══════════════════════════════════════════════════════════════
// DeliveryRouteCron — Phase 7
//
// Runs twice daily (IST):
//   Morning: 12:00 AM (midnight)  — creates morning delivery snapshot
//   Evening: 12:00 PM (noon)      — creates evening delivery snapshot
//
// Each run:
//   1. Loads all active branches
//   2. Loads all active delivery routes for each branch
//   3. For each route: loads subscription items active on today's date
//   4. Creates delivery_proof_logs rows (status = 'pending') for each stop
//      → This "pre-populates" the delivery board so the driver sees
//        their full stop list even before they start delivering
//
// Idempotency: uses ON CONFLICT DO NOTHING so re-running is safe.
// ═══════════════════════════════════════════════════════════════

@Injectable()
export class DeliveryRouteCron {
  private readonly logger = new Logger(DeliveryRouteCron.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly routeService: RouteService,
    private readonly cronLock: CronLockService,
  ) {}

  // ─── Morning: runs at 12:00 AM IST ─────────────────────────
  // Cron: second=0, minute=0, hour=0 → midnight
  @Cron('0 0 0 * * *', { timeZone: 'Asia/Kolkata' })
  async handleMorningDeliverySetup(): Promise<void> {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleMorningDeliverySetup', 3600))) return;

    this.logger.log('[CRON] Morning delivery setup started (12:00 AM IST)');
    try {
      const date = new Date().toISOString().split('T')[0];
      const result = await this._createDeliverySnapshot(date, 'morning');
      this.logger.log(`[CRON] Morning snapshot done: ${result.routes_processed} routes, ${result.stops_created} stops for ${date}`);
    } catch (error) {
      this.logger.error('[CRON] Morning delivery setup FAILED', error instanceof Error ? error.stack : String(error));
    }
  }

  // ─── Evening: runs at 12:00 PM IST ─────────────────────────
  // Cron: second=0, minute=0, hour=12 → noon
  @Cron('0 0 12 * * *', { timeZone: 'Asia/Kolkata' })
  async handleEveningDeliverySetup(): Promise<void> {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleEveningDeliverySetup', 3600))) return;

    this.logger.log('[CRON] Evening delivery setup started (12:00 PM IST)');
    try {
      const date = new Date().toISOString().split('T')[0];
      const result = await this._createDeliverySnapshot(date, 'evening');
      this.logger.log(`[CRON] Evening snapshot done: ${result.routes_processed} routes, ${result.stops_created} stops for ${date}`);
    } catch (error) {
      this.logger.error('[CRON] Evening delivery setup FAILED', error instanceof Error ? error.stack : String(error));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Core: creates delivery_proof_logs rows for all active routes
  // ═══════════════════════════════════════════════════════════════

  private async _createDeliverySnapshot(
    date: string,
    shiftType: 'morning' | 'evening',
  ): Promise<{ routes_processed: number; stops_created: number; errors: number }> {
    const stats = { routes_processed: 0, stops_created: 0, errors: 0 };

    // ── Step 1: Get all active branches ─────────────────────────
    const branches = await this.db.query(
      `SELECT branch_id FROM branches WHERE is_active = true`,
      [],
    );

    if (!branches?.length) {
      this.logger.warn('[CRON] No active branches found');
      return stats;
    }

    for (const branch of branches) {
      try {
        // ── Step 2: Get active routes for this branch/shift ────
        const routes = await this.db.query(
          `SELECT id AS route_id FROM delivery_routes
           WHERE branch_id = $1 AND shift_type = $2 AND is_active = true`,
          [branch.branch_id, shiftType],
        );

        if (!routes?.length) continue;

        for (const route of routes) {
          try {
            stats.routes_processed++;

            // ── Step 3: Get customers in this route who have active subscriptions ──
            const stops = await this.db.query(
              `SELECT DISTINCT
                 c.customer_id,
                 sub.id AS subscription_id
               FROM delivery_route_customers drc
               JOIN customers c ON c.id = drc.customer_id
               JOIN subscriptions sub
                 ON sub.customer_id = c.customer_id
                 AND sub.status = 'active'
                 AND sub.start_date <= $1
                 AND (sub.end_date IS NULL OR sub.end_date >= $1)
               WHERE drc.route_id = $2 AND drc.is_active = true`,
              [date, route.route_id],
            );

            if (!stops?.length) continue;

            // ── Step 4: Bulk INSERT delivery_proof_logs (idempotent) ──
            // Build parameterized VALUES for batch insert
            const values: any[] = [];
            const valueParts: string[] = [];
            let p = 1;

            for (const stop of stops) {
              valueParts.push(`($${p}, $${p+1}, $${p+2}, $${p+3}, $${p+4})`);
              values.push(
                stop.subscription_id,
                stop.customer_id,
                date,
                shiftType,
                route.route_id,
              );
              p += 5;
            }

            const insertResult = await this.db.query(
              `INSERT INTO delivery_proof_logs
                 (subscription_id, customer_id, delivery_date, shift_type, route_id, delivery_status)
               VALUES ${valueParts.join(', ')}
               ON CONFLICT (subscription_id, delivery_date, shift_type) DO NOTHING`,
              values,
            );

            stats.stops_created += stops.length;
          } catch (routeErr: any) {
            stats.errors++;
            this.developer.error('[CRON] Error processing route', {
              route_id: route.route_id,
              error: routeErr?.message,
            });
          }
        }
      } catch (branchErr: any) {
        stats.errors++;
        this.developer.error('[CRON] Error processing branch', {
          branch_id: branch.branch_id,
          error: branchErr?.message,
        });
      }
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════════
  // Manual trigger endpoint (for testing without waiting for cron)
  // Call via: POST /zone/admin/trigger-snapshot
  // ═══════════════════════════════════════════════════════════════

  async triggerManual(
    date: string,
    shiftType: 'morning' | 'evening',
  ): Promise<{ routes_processed: number; stops_created: number; errors: number }> {
    this.logger.log(`[CRON] Manual trigger: ${shiftType} snapshot for ${date}`);
    return this._createDeliverySnapshot(date, shiftType);
  }
}
