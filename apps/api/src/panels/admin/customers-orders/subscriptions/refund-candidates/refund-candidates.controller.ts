import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RefundCandidatesService } from './refund-candidates.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'subscriptions/refund-candidates', version: '1' })
export class RefundCandidatesController {
  constructor(private readonly service: RefundCandidatesService) {}

  // ─── Summary Stats ───────────────────────────────────────────────────────────

  /** GET /subscriptions/refund-candidates/summary */
  @Get('summary')
  async getSummary() {
    return this.service.getSummary();
  }

  // ─── Candidate Table (paginated) ──────────────────────────────────────────────

  /** GET /subscriptions/refund-candidates/table */
  @Get('table')
  async getTable(@Query() query: any) {
    return this.service.getTable(query);
  }

  // ─── Customer Groups (accordion UI) ──────────────────────────────────────────

  /** GET /subscriptions/refund-candidates/customer-groups */
  @Get('customer-groups')
  async getCustomerGroups(@Query() query: any) {
    return this.service.getCustomerGroups(query);
  }

  // ─── Payouts List ────────────────────────────────────────────────────────────

  /** GET /subscriptions/refund-candidates/payouts */
  @Get('payouts')
  async getPayouts(@Query() query: any) {
    return this.service.getPayouts(query);
  }

  // ─── Payout Detail ───────────────────────────────────────────────────────────

  /** GET /subscriptions/refund-candidates/payouts/:payoutId */
  @Get('payouts/:payoutId')
  async getPayoutById(@Param('payoutId') payoutId: string) {
    return this.service.getPayoutById(payoutId);
  }

  // ─── Bulk Approve ────────────────────────────────────────────────────────────

  /**
   * POST /subscriptions/refund-candidates/bulk-approve
   * Body: { candidate_ids: string[] }
   *
   * Groups selected candidates by customer, creates one payout per customer,
   * credits wallet, and marks all candidates as refunded in one atomic flow.
   */
  @Post('bulk-approve')
  async bulkApprove(@Body() body: { candidate_ids: string[] }, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.service.bulkApprove(body.candidate_ids ?? [], adminId);
  }

  // ─── Bulk Reject ─────────────────────────────────────────────────────────────

  /**
   * POST /subscriptions/refund-candidates/bulk-reject
   * Body: { candidate_ids: string[], notes?: string }
   */
  @Post('bulk-reject')
  async bulkReject(
    @Body() body: { candidate_ids: string[]; notes?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.service.bulkReject(body.candidate_ids ?? [], adminId, body.notes);
  }

  // ─── Single Approve ───────────────────────────────────────────────────────────

  /** POST /subscriptions/refund-candidates/:id/approve */
  @Post(':id/approve')
  async approveSingle(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.service.approveSingle(id, adminId);
  }

  // ─── Single Reject ────────────────────────────────────────────────────────────

  /**
   * POST /subscriptions/refund-candidates/:id/reject
   * Body: { notes?: string }
   */
  @Post(':id/reject')
  async rejectSingle(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.service.rejectSingle(id, adminId, body.notes);
  }
}
