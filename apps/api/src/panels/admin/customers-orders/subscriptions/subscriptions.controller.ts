import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsSaveAddService } from './services/saveAdd.service';
import { SubscriptionsSaveEditService } from './services/saveEdit.service';
import { SubscriptionsShowAddService } from './services/showAdd.service';
import { SubscriptionsShowEditService } from './services/showEdit.service';
import { SubscriptionsTableService } from './services/table.service';
import { SubscriptionStatusService } from './status/subscription-status.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tableService: SubscriptionsTableService,
    private readonly showAddService: SubscriptionsShowAddService,
    private readonly saveAddService: SubscriptionsSaveAddService,
    private readonly showEditService: SubscriptionsShowEditService,
    private readonly saveEditService: SubscriptionsSaveEditService,
    private readonly statusService: SubscriptionStatusService,
  ) {}

  @Get('subscriptions/summary')
  async getSubscriptionsSummary(@Query() query: any) {
    return this.subscriptionsService.getSubscriptionsSummary(query);
  }

  @Get('subscriptions/table')
  async getSubscriptionsTable(@Query() query: any) {
    return this.tableService.getSubscriptionsTable(query);
  }

  @Get('subscriptions/showAdd')
  async showSubscriptionsAdd() {
    return this.showAddService.getSubscriptionsForm();
  }

  @Post('subscriptions/saveAdd')
  async saveSubscriptionsAdd(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveSubscription(body, adminId);
  }

  @Get('subscriptions/:subscriptionId/view')
  async getSubscriptionView(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.getSubscriptionView(subscriptionId);
  }

  @Get('subscriptions/:subscriptionId/items')
  async getSubscriptionItems(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.getSubscriptionItems(subscriptionId);
  }

  @Get('subscriptions/:subscriptionId/showEdit')
  async showSubscriptionsEdit(@Param('subscriptionId') subscriptionId: string) {
    return this.showEditService.getSubscriptionsEditForm(subscriptionId);
  }

  @Post('subscriptions/:subscriptionId/saveEdit')
  async saveSubscriptionsEdit(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.saveSubscription(subscriptionId, body, adminId);
  }

  @Delete('subscriptions/:subscriptionId/delete')
  async deleteSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionsService.deleteSubscription(subscriptionId, adminId);
  }

  @Get('logs/table')
  async getSubscriptionLogsTable(@Query() query: any) {
    return this.tableService.getSubscriptionLogsTable(query);
  }

  // ─── Subscription Status Management ──────────────────────────────────

  @Get('subscriptions/:subscriptionId/renewal-status')
  async getRenewalStatus(@Param('subscriptionId') subscriptionId: string) {
    return this.statusService.getRenewalStatus(subscriptionId);
  }

  @Post('subscriptions/:subscriptionId/renew')
  async manualRenew(@Param('subscriptionId') subscriptionId: string) {
    try {
      const result = await this.statusService.manualRenew(subscriptionId);
      return { status: true, ...result };
    } catch (err: any) {
      return { status: false, message: err.message };
    }
  }

  @Post('subscriptions/:subscriptionId/retry-wallet')
  async retryWalletDeduction(@Param('subscriptionId') subscriptionId: string) {
    try {
      const result = await this.statusService.retryWalletDeduction(subscriptionId);
      return { status: true, ...result };
    } catch (err: any) {
      return { status: false, message: err.message };
    }
  }

  @Post('subscriptions/:subscriptionId/override-renew')
  async overrideRenewal(@Param('subscriptionId') subscriptionId: string) {
    try {
      const result = await this.statusService.overrideRenewal(subscriptionId);
      return { status: true, ...result };
    } catch (err: any) {
      return { status: false, message: err.message };
    }
  }

  @Post('subscriptions/process-status')
  async triggerStatusProcessing() {
    try {
      const result = await this.statusService.processSubscriptionStatuses();
      return { status: true, ...result };
    } catch (err: any) {
      return { status: false, message: err.message };
    }
  }

  // ─── Vacation Pause, Resume & Auto Renew Controls ───────────────────────

  @Post(['subscriptions/:subscriptionId/pause', ':subscriptionId/pause', 'subscriptions/pause/:subscriptionId'])
  async pauseSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { start_date?: string; end_date?: string; startDate?: string; endDate?: string; reason?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    const startDate = body.start_date || body.startDate;
    const endDate = body.end_date || body.endDate;
    return this.subscriptionsService.pauseSubscription(subscriptionId, startDate, endDate, body.reason, adminId);
  }

  @Post(['subscriptions/:subscriptionId/resume', ':subscriptionId/resume', 'subscriptions/resume/:subscriptionId'])
  async resumeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { resume_date?: string; resumeDate?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    const resumeDate = body?.resume_date || body?.resumeDate;
    return this.subscriptionsService.resumeSubscription(subscriptionId, resumeDate, adminId);
  }

  @Patch(['subscriptions/:subscriptionId/auto-renew', ':subscriptionId/auto-renew'])
  async updateAutoRenew(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { auto_renew: boolean },
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionsService.updateAutoRenew(subscriptionId, body.auto_renew, adminId);
  }

  @Get(['subscriptions/:subscriptionId/pause-history', ':subscriptionId/pause-history'])
  async getPauseHistory(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.getPauseHistory(subscriptionId);
  }
}
