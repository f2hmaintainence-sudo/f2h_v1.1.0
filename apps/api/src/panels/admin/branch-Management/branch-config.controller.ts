import { Controller, Get, Post, Patch, Query, Body, Param } from '@nestjs/common';
import { BranchConfigService } from './branch-config.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import { UpdateBranchRadiusDto } from './dto/branch.dto';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/branch-config', version: '1' })
export class BranchConfigController {
  constructor(private readonly configService: BranchConfigService) {}

  // ── Radius Config ──

  @Get('radius')
  async getRadiusConfig() {
    return this.configService.getRadiusConfig();
  }

  @Patch('radius/:branchId')
  async updateRadiusConfig(
    @Param('branchId') branchId: string,
    @Body() body: UpdateBranchRadiusDto,
  ) {
    return this.configService.updateRadiusConfig(branchId, body);
  }

  // ── Partner Allocation ──

  @Get('partners')
  async getPartnerAllocation() {
    return this.configService.getPartnerAllocation();
  }

  @Patch('partners/:partnerId/allocate')
  async allocatePartner(
    @Param('partnerId') partnerId: string,
    @Body() body: { branch_id: string },
  ) {
    return this.configService.allocatePartner(partnerId, body.branch_id);
  }

  // ── Branch Analytics ──

  @Get('analytics')
  async getBranchAnalytics(@Query() query: any) {
    return this.configService.getBranchAnalytics(query);
  }
}
