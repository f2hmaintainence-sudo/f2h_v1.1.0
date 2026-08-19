import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

  @Get('overrides/table')
  async getSubscriptionOverridesTable(@Query() query: any) {
    return this.tableService.getSubscriptionOverridesTable(query);
  }

  @Get('overrides/showAdd')
  async showSubscriptionOverrideAdd() {
    return this.showAddService.getSubscriptionsOverrideForm();
  }

  @Post('overrides/saveAdd')
  async saveSubscriptionOverrideAdd(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveAddService.saveSubscriptionOverride(body, adminId);
  }

  @Get('overrides/:overrideId/view')
  async getSubscriptionOverrideView(@Param('overrideId') overrideId: string) {
    return this.subscriptionsService.getSubscriptionOverrideView(overrideId);
  }

  @Get('overrides/:overrideId/showEdit')
  async showSubscriptionOverrideEdit(@Param('overrideId') overrideId: string) {
    return this.showEditService.getSubscriptionsOverrideEditForm(overrideId);
  }

  @Post('overrides/:overrideId/saveEdit')
  async saveSubscriptionOverrideEdit(
    @Param('overrideId') overrideId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.saveEditService.saveSubscriptionOverride(
      overrideId,
      body,
      adminId,
    );
  }

  @Delete('overrides/:overrideId/delete')
  async deleteSubscriptionOverride(
    @Param('overrideId') overrideId: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? 'system';
    return this.subscriptionsService.deleteSubscriptionOverride(
      overrideId,
      adminId,
    );
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
}
