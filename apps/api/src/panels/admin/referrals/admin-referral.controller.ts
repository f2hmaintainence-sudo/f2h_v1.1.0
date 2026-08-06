import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminReferralService } from './admin-referral.service';

@Controller('admin/referrals')
@UseGuards(AuthGuard('jwt'))
export class AdminReferralController {
  constructor(private readonly adminReferralService: AdminReferralService) {}

  @Get('analytics')
  async getAnalytics() {
    return this.adminReferralService.getAnalytics();
  }

  @Get('top-referrers')
  async getTopReferrers(@Query('limit') limit?: number) {
    return this.adminReferralService.getTopReferrers(limit ? Number(limit) : 10);
  }

  @Get('history')
  async getRewardHistory(@Query() query: any) {
    return this.adminReferralService.getRewardHistory(query);
  }
}
