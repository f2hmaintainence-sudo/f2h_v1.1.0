import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { SubscriptionSnapshotService } from './services/subscription-snapshot.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/orders/dispatch', version: '1' })
export class DispatchController {
  private readonly logger = new Logger(DispatchController.name);

  constructor(
    private readonly snapshotService: SubscriptionSnapshotService,
  ) { }

  /**
   * GET /admin/orders/dispatch/pre-summary
   *
   * Returns branch-wise aggregated item quantities for eligible subscriptions
   * before order generation. Admins use this to review stock requirements.
   *
   * Query params:
   *  - date:     YYYY-MM-DD (required)
   *  - slot:     'morning' | 'evening' (required)
   *  - branchId: optional — filter to a specific branch
   */
  @Get('pre-summary')
  async getPreDispatchSummary(
    @Query('date') date: string,
    @Query('slot') slot: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!date || !slot) {
      throw new BadRequestException('date and slot are required query parameters');
    }
    if (slot !== 'morning' && slot !== 'evening') {
      throw new BadRequestException('slot must be "morning" or "evening"');
    }

    return this.snapshotService.getPreDispatchSummary(
      date,
      slot as 'morning' | 'evening',
      branchId || null,
    );
  }

  /**
   * GET /admin/orders/dispatch/branch-stats
   *
   * Returns branch-wise breakdown of subscription orders created and one-time orders confirmed
   * for the given date/slot.
   */
  @Get('branch-stats')
  async getBranchWiseStats(
    @Query('date') date: string,
    @Query('slot') slot: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!date || !slot) {
      throw new BadRequestException('date and slot are required query parameters');
    }
    if (slot !== 'morning' && slot !== 'evening') {
      throw new BadRequestException('slot must be "morning" or "evening"');
    }

    return this.snapshotService.getBranchWiseStats(
      date,
      slot as 'morning' | 'evening',
      branchId || null,
    );
  }

  /**
   * POST /admin/orders/dispatch/generate
   *
   * Generates orders for eligible subscriptions. Supports:
   *  - Generate for ALL branches (omit branchId)
   *  - Generate for a SPECIFIC branch (pass branchId)
   *
   * Body:
   *  - date:     YYYY-MM-DD (required)
   *  - slot:     'morning' | 'evening' (required)
   *  - branchId: optional — generate only for this branch
   */
  @Post('generate')
  async generateOrders(
    @Body() body: { date: string; slot: string; branchId?: string },
  ) {
    const { date, slot, branchId } = body;

    if (!date || !slot) {
      throw new BadRequestException('date and slot are required');
    }
    if (slot !== 'morning' && slot !== 'evening') {
      throw new BadRequestException('slot must be "morning" or "evening"');
    }

    this.logger.log(
      `[ADMIN] Manual order generation: date=${date} slot=${slot} branch=${branchId || 'all'}`,
    );

    const result = await this.snapshotService.generateOrdersForDateAndSlot(
      date,
      slot as 'morning' | 'evening',
      'manual',
      branchId || null,
    );

    return {
      success: result.status === 'success',
      targetDate: result.targetDate,
      slot: result.slot,
      generationType: result.generationType,
      status: result.status,
      durationMs: result.durationMs,

      // Subscription order generation
      subscriptionOrdersCreated: result.subscriptionOrdersCreated,
      subscriptionItemsInserted: result.subscriptionItemsInserted,
      subscriptionLogsInserted: result.subscriptionLogsInserted,

      // One-time order confirmation
      onetimeOrdersConfirmed: result.onetimeOrdersConfirmed,
      onetimeOrdersSkipped: result.onetimeOrdersSkipped,

      // Totals
      totalProcessed: result.totalProcessed,

      // Branch-wise breakdown
      branchStats: result.branchStats,

      errors: result.errors,
    };
  }

  /**
   * GET /admin/orders/dispatch/export-pdf
   *
   * Exports the dispatch summary as a PDF document.
   *
   * Query params:
   *  - date:     YYYY-MM-DD (required)
   *  - slot:     'morning' | 'evening' (required)
   *  - branchId: optional — export only for this branch
   */
  @Get('export-pdf')
  async exportDispatchPdf(
    @Query('date') date: string,
    @Query('slot') slot: string,
    @Query('branchId') branchId: string | undefined,
    @Res() res: Response,
  ) {
    if (!date || !slot) {
      throw new BadRequestException('date and slot are required query parameters');
    }
    if (slot !== 'morning' && slot !== 'evening') {
      throw new BadRequestException('slot must be "morning" or "evening"');
    }

    const buffer = await this.snapshotService.generateDispatchPdf(
      date,
      slot as 'morning' | 'evening',
      branchId || null,
    );

    const branchSuffix = branchId ? `-${branchId}` : '-all-branches';
    const filename = `dispatch-summary-${date}-${slot}${branchSuffix}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
