// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : package.controller.ts
// Description : Admin container/package management endpoints
//
// ============================================================================

import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PackageService } from './package.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/package', version: '1' })
export class PackageController {
  constructor(private readonly packageService: PackageService) { }

  @Get('dashboard')
  dashboard(@Query() query: any) {
    return this.packageService.dashboard(query);
  }

  // ─── Simplified: customers with pending returnable containers ───
  @Get('pending')
  pendingReturns(@Query() query: any) {
    return this.packageService.getPendingReturns(query);
  }

  // ─── Simplified: admin manual adjustment (returned / lost / damaged) ───
  @Post('adjust')
  adjustContainers(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.packageService.adjustContainers(body, adminId);
  }

  // ─── Per-customer container balances ───
  @Get('customer/table')
  customerTable(@Query() query: any) {
    return this.packageService.customerBalancesTable(query);
  }
}
