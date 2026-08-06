import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { DeliveryRouteCron } from '../services/delivery-route.cron';

// ═══════════════════════════════════════════════════════════════
// MigrationController — One-time admin utilities
//
// These endpoints are for one-time data migration/repair only.
// Guard them with admin authentication in production.
//
// Endpoints:
//   POST /zone/admin/migrate/seed-customer-sectors
//     → Seeds address_hex + sector_index for all existing customers
//       that have lat/lng but no address_hex.
//     → Processes in batches of 100 to avoid timeouts.
//     → Returns { jobId, status: 'started', total }
//
//   GET /zone/admin/migrate/status/:jobId
//     → Returns { jobId, processed, total, status, errors }
//
//   GET /zone/admin/migrate/pool-b-summary/:branchId/:sectorIndex
//     → Shows count of customers in each Pool B category
//       (no GPS, no apartment → needs manual assignment)
//
//   GET /zone/waitlist/:branchId
//     → Returns waitlist grouped by pincode with counts
// ═══════════════════════════════════════════════════════════════

interface MigrationJob {
  jobId: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  processed: number;
  total: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

// In-memory job store (use Redis/Bull in production for multi-instance)
const migrationJobs = new Map<string, MigrationJob>();

@Controller({ path: 'zone/admin', version: '1' })
export class MigrationController {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly cronService: DeliveryRouteCron,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // POST /zone/admin/migrate/seed-customer-sectors
  // Seeds address_hex for all customers that have GPS but no hex
  // Runs async in background — returns jobId immediately
  // ═══════════════════════════════════════════════════════════════

  @Post('migrate/seed-customer-sectors')
  async seedCustomerSectors(@Body() body: { branch_id?: string }) {
    try {
      // Count total customers to process
      const whereClause = body.branch_id
        ? `WHERE address_lat IS NOT NULL AND address_lng IS NOT NULL AND address_hex IS NULL AND branch_id = '${body.branch_id}'`
        : `WHERE address_lat IS NOT NULL AND address_lng IS NOT NULL AND address_hex IS NULL`;

      const countResult = await this.db.query(
        `SELECT COUNT(*)::int AS total FROM customers ${whereClause}`,
        [],
      );
      const total: number = countResult?.[0]?.total || 0;

      if (total === 0) {
        return {
          status: true,
          message: 'No customers need migration. All customers with GPS already have address_hex.',
          jobId: null,
          total: 0,
        };
      }

      // Create job record
      const jobId = `migration_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const job: MigrationJob = {
        jobId,
        status: 'pending',
        processed: 0,
        total,
        errors: [],
        startedAt: new Date(),
      };
      migrationJobs.set(jobId, job);

      // Run async (fire and forget — no await)
      this._runSeedJob(job, whereClause).catch((err) => {
        job.status = 'failed';
        job.errors.push(String(err));
        this.developer.error('seedCustomerSectors job failed', { err });
      });

      return {
        status: true,
        message: `Migration started: ${total} customers to process.`,
        jobId,
        total,
      };
    } catch (error) {
      this.developer.error('seedCustomerSectors error', { error });
      throw new InternalServerErrorException('Failed to start migration job');
    }
  }

  // ── Internal: runs the actual seeding in batches of 100 ──
  private async _runSeedJob(job: MigrationJob, whereClause: string): Promise<void> {
    job.status = 'running';
    const BATCH_SIZE = 100;
    let offset = 0;

    while (true) {
      const customers = await this.db.query(
        `SELECT id, address_lat, address_lng, branch_id
         FROM customers
         ${whereClause}
         LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
        [],
      );

      if (!customers?.length) break;

      for (const customer of customers) {
        try {
          // Compute H3 address_hex for this customer
          // Note: h3-js must be installed: npm install h3-js
          // If not available, use a simplified grid-based hex approximation
          const addressHex = this._computeAddressHex(
            customer.address_lat,
            customer.address_lng,
          );

          // Look up sector_index from branch_zone_hexes
          const hexRow = await this.db.query(
            `SELECT sector_index FROM branch_zone_hexes
             WHERE branch_id = $1 AND h3_index = $2`,
            [customer.branch_id, addressHex],
          );
          const sectorIndex = hexRow?.[0]?.sector_index ?? null;

          // Update customer
          await this.db.query(
            `UPDATE customers
             SET address_hex = $1, sector_index = $2
             WHERE id = $3`,
            [addressHex, sectorIndex, customer.id],
          );

          job.processed++;
        } catch (err) {
          job.errors.push(`Customer ${customer.id}: ${String(err)}`);
          job.processed++;
        }
      }

      offset += BATCH_SIZE;
    }

    job.status = 'done';
    job.completedAt = new Date();
  }

  // ── Compute H3-like address hex for a lat/lng ──
  // Uses h3-js if installed, otherwise a grid approximation
  private _computeAddressHex(lat: number, lng: number): string {
    try {
      // Try to use h3-js if installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const h3 = require('h3-js');
      return h3.latLngToCell(lat, lng, 9);
    } catch {
      // Fallback: grid-cell approximation that matches our clustering
      // Resolution ~174m (matches H3 resolution 9 roughly)
      const row = Math.floor((lat - 8.0) / 0.0015);  // ~174m in lat
      const col = Math.floor((lng - 68.0) / 0.002);  // ~174m in lng
      return `grid_${row}_${col}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GET /zone/admin/migrate/status/:jobId
  // ═══════════════════════════════════════════════════════════════

  @Get('migrate/status/:jobId')
  async getMigrationStatus(@Param('jobId') jobId: string) {
    const job = migrationJobs.get(jobId);
    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found`);
    }

    const progressPercent = job.total > 0
      ? Math.round((job.processed / job.total) * 100)
      : 0;

    return {
      status: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        processed: job.processed,
        total: job.total,
        progressPercent,
        errors: job.errors.slice(0, 10), // Show first 10 errors only
        errorCount: job.errors.length,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        elapsedMs: Date.now() - job.startedAt.getTime(),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET /zone/admin/pool-b-summary/:branchId/:sectorIndex
  // Shows Pool B breakdown for admin warning banner
  // ═══════════════════════════════════════════════════════════════

  @Get('pool-b-summary/:branchId/:sectorIndex')
  async getPoolBSummary(
    @Param('branchId') branchId: string,
    @Param('sectorIndex') sectorIndex: string,
  ) {
    try {
      const results = await Promise.all([
        // Pool A: has GPS
        this.db.query(
          `SELECT COUNT(*)::int AS count FROM customers
           WHERE branch_id = $1 AND sector_index = $2 AND route_id IS NULL
             AND address_lat IS NOT NULL AND address_lng IS NOT NULL
             AND address_lat != 0 AND address_lng != 0`,
          [branchId, parseInt(sectorIndex)],
        ),
        // Pool B with apartment (has apt, no GPS)
        this.db.query(
          `SELECT COUNT(*)::int AS count FROM customers
           WHERE branch_id = $1 AND sector_index = $2 AND route_id IS NULL
             AND (address_lat IS NULL OR address_lng IS NULL OR address_lat = 0)
             AND apartment_name IS NOT NULL AND apartment_name != ''`,
          [branchId, parseInt(sectorIndex)],
        ),
        // Pool B neither (no GPS, no apartment)
        this.db.query(
          `SELECT COUNT(*)::int AS count FROM customers
           WHERE branch_id = $1 AND sector_index = $2 AND route_id IS NULL
             AND (address_lat IS NULL OR address_lng IS NULL OR address_lat = 0)
             AND (apartment_name IS NULL OR apartment_name = '')`,
          [branchId, parseInt(sectorIndex)],
        ),
      ]);

      const poolACount = results[0]?.[0]?.count || 0;
      const poolBAptCount = results[1]?.[0]?.count || 0;
      const poolBNeitherCount = results[2]?.[0]?.count || 0;
      const totalUnrouted = poolACount + poolBAptCount + poolBNeitherCount;

      return {
        status: true,
        data: {
          total_unrouted: totalUnrouted,
          pool_a_gps: poolACount,
          pool_b_apartment_fallback: poolBAptCount,
          pool_b_manual_required: poolBNeitherCount,
          warning: poolBNeitherCount > 0
            ? `${poolBNeitherCount} customers have no GPS and no apartment name. They will be placed in "Manual Assignment Required" route after auto-group.`
            : null,
        },
      };
    } catch (error) {
      this.developer.error('getPoolBSummary error', { error });
      throw new InternalServerErrorException('Failed to fetch Pool B summary');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GET /zone/waitlist/:branchId
  // Returns out-of-area customer waitlist grouped by pincode
  // Sorted by count DESC (highest demand pincodes first)
  // ═══════════════════════════════════════════════════════════════

  @Get('waitlist/:branchId')
  async getWaitlistByBranch(@Param('branchId') branchId: string) {
    try {
      const byPincode = await this.db.query(
        `SELECT
          pincode,
          COUNT(*)::int AS customer_count,
          MIN(requested_at) AS first_request,
          MAX(requested_at) AS latest_request
         FROM customer_waitlist
         WHERE branch_id = $1
         GROUP BY pincode
         ORDER BY customer_count DESC`,
        [branchId],
      );

      const total = await this.db.query(
        `SELECT COUNT(*)::int AS total FROM customer_waitlist WHERE branch_id = $1`,
        [branchId],
      );

      return {
        status: true,
        data: {
          total_waitlisted: total?.[0]?.total || 0,
          by_pincode: byPincode || [],
          expansion_ready: (byPincode || []).filter((r: any) => r.customer_count >= 20),
          message:
            (byPincode || []).filter((r: any) => r.customer_count >= 20).length > 0
              ? 'Some pincodes have 20+ customers waiting — ready for new branch!'
              : null,
        },
      };
    } catch (error) {
      this.developer.error('getWaitlistByBranch error', { error });
      throw new InternalServerErrorException('Failed to fetch waitlist');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // POST /zone/admin/trigger-snapshot
  // Manually fires the delivery snapshot (bypasses cron schedule)
  // Use for: testing, emergency re-runs, or initial data seeding
  // Body: { date?: 'YYYY-MM-DD', shift_type: 'morning' | 'evening' }
  // ═══════════════════════════════════════════════════════════════

  @Post('trigger-snapshot')
  async triggerDeliverySnapshot(
    @Body() body: { date?: string; shift_type?: 'morning' | 'evening' },
  ) {
    try {
      const date = body.date || new Date().toISOString().split('T')[0];
      const shiftType = body.shift_type || 'morning';

      if (!['morning', 'evening'].includes(shiftType)) {
        throw new BadRequestException('shift_type must be morning or evening');
      }

      const result = await this.cronService.triggerManual(date, shiftType as 'morning' | 'evening');

      return {
        status: true,
        message: `Snapshot triggered for ${date} (${shiftType}).`,
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('triggerDeliverySnapshot error', { error });
      throw new InternalServerErrorException('Failed to trigger snapshot');
    }
  }
}
