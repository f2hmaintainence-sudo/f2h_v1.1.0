// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : package.controller.ts
// Description : Admin container/package management endpoints
//
// ============================================================================

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  // ─── Container Types CRUD ───
  @Get('types/table')
  packagingTypesTable(@Query() query: any) {
    return this.packageService.packagingTypesTable(query);
  }

  @Get('types/showAdd')
  packagingTypeAddForm() {
    return this.packageService.packagingTypeForm();
  }

  @Post('types/saveAdd')
  savePackagingType(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.packageService.savePackagingType(body, adminId);
  }

  @Get('types/:id/showEdit')
  packagingTypeEditForm(@Param('id') id: string) {
    return this.packageService.packagingTypeForm(id);
  }

  @Post('types/:id/saveEdit')
  updatePackagingType(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.packageService.updatePackagingType(id, body, adminId);
  }

  @Get('types/:id/view')
  packagingTypeView(@Param('id') id: string) {
    return this.packageService.packagingTypeView(id);
  }

  // ─── Transactions / Ledger (kept for advanced use) ───
  @Get('transactions/table')
  transactionsTable(@Query() query: any) {
    return this.packageService.transactionsTable(query);
  }

  @Get('transactions/showAdd')
  transactionAddForm() {
    return this.packageService.transactionForm();
  }

  @Post('transactions/saveAdd')
  saveTransaction(@Body() body: any, @Req() req: any) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.packageService.saveTransaction(body, adminId);
  }

  @Get('transactions/:id/showEdit')
  transactionEditForm(@Param('id') id: string) {
    return this.packageService.transactionForm(id);
  }

  @Post('transactions/:id/saveEdit')
  updateTransaction(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    return this.packageService.updateTransaction(id, body, adminId);
  }

  @Get('transactions/:id/view')
  transactionView(@Param('id') id: string) {
    return this.packageService.transactionView(id);
  }

  @Get('customer/table')
  customerTable(@Query() query: any) {
    return this.packageService.customerBalancesTable(query);
  }

  @Get('damage/table')
  damageTable(@Query() query: any) {
    return this.packageService.damageTable(query);
  }

  @Get('reconciliation/table')
  reconciliationTable(@Query() query: any) {
    return this.packageService.reconciliationTable(query);
  }
}
