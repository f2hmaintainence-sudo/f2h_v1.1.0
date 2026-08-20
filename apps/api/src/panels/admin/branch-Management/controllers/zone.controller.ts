import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SectorService } from '../ModuleServices/sector.service';
import { DataService } from '../../../../shared/database/Data.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/zone', version: '1' })
export class ZoneController {
  constructor(
    private readonly sectorService: SectorService,
    private readonly dataService: DataService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // NEW SECTOR-BASED ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // ─── Get sectors for a branch ─────────────────────────────────
  @Get('sectors/:branchId')
  async getSectorsForBranch(@Param('branchId') branchId: string) {
    return this.sectorService.getSectorsForBranch(branchId);
  }

  // ─── Assign delivery boy to sector ────────────────────────────
  @Patch('sectors/:branchId/:sectorIndex/assign')
  async assignDeliveryPartnerToSector(
    @Param('branchId') branchId: string,
    @Param('sectorIndex') sectorIndex: string,
    @Body() body: { delivery_partner_id: string },
  ) {
    return this.sectorService.assignDeliveryPartnerToSector(
      branchId,
      parseInt(sectorIndex),
      body.delivery_partner_id,
    );
  }

  // ─── Get customers in a sector ────────────────────────────────
  @Get('sectors/:branchId/:sectorIndex/customers')
  async getCustomersInSector(
    @Param('branchId') branchId: string,
    @Param('sectorIndex') sectorIndex: string,
    @Query() query: any,
  ) {
    return this.sectorService.getCustomersInSector(
      branchId,
      parseInt(sectorIndex),
      query,
    );
  }

  // ─── Override customer delivery boy ───────────────────────────
  @Post('customers/:customerId/override')
  async overrideCustomerDeliveryPartner(
    @Param('customerId') customerId: string,
    @Body() body: { delivery_partner_id: string },
  ) {
    return this.sectorService.overrideCustomerDeliveryPartner(
      customerId,
      body.delivery_partner_id,
    );
  }

  // ─── Clear customer override ──────────────────────────────────
  @Delete('customers/:customerId/override')
  async clearCustomerOverride(
    @Param('customerId') customerId: string,
  ) {
    return this.sectorService.clearCustomerOverride(customerId);
  }

  // ─── Change sector count (destructive) ────────────────────────
  @Post('sectors/:branchId/change-count')
  async changeSectorCount(
    @Param('branchId') branchId: string,
    @Body() body: { sector_count: number },
  ) {
    return this.sectorService.changeSectorCount(branchId, body.sector_count);
  }

  // ─── Get delivery boys for a branch (for assignment dropdowns)─
  @Get('delivery-boys/:branchId')
  async getDeliveryPartnersForBranch(@Param('branchId') branchId: string) {
    return this.sectorService.getDeliveryPartnersForBranch(branchId);
  }

  // ─── Warehouse summary (per-sector customer + route counts) ───
  @Get('warehouse-summary/:branchId')
  async getWarehouseSummary(
    @Param('branchId') branchId: string,
    @Query('date') date?: string,
  ) {
    return this.sectorService.getWarehouseSummary(branchId, date);
  }

  // ─── Real-time location ping (driver app → 30s interval) ──────
  @Post('delivery-boys/:deliveryPartnerId/location')
  async pingDeliveryPartnerLocation(
    @Param('deliveryPartnerId') deliveryPartnerId: string,
    @Body() body: { lat: number; lng: number; shift_type?: 'morning' | 'evening' },
  ) {
    return this.sectorService.upsertDeliveryPartnerLocation(
      deliveryPartnerId, body.lat, body.lng, body.shift_type || 'morning',
    );
  }

  // ─── Get all delivery boy live locations (admin map view) ─────
  @Get('delivery-boys/:branchId/locations')
  async getDeliveryPartnerLocations(
    @Param('branchId') branchId: string,
    @Query('shift_type') shiftType?: 'morning' | 'evening',
  ) {
    return this.sectorService.getDeliveryPartnerLocations(branchId, shiftType);
  }

  // ═══════════════════════════════════════════════════════════════
  // BRANCH LOOKUP
  // ═══════════════════════════════════════════════════════════════

  @Get('branches-list')
  async getBranchesList(@Query() query: any) {
    try {
      const whereClause: any[] = [];
      if (!query || (query.all !== 'true' && query.all !== '1')) {
        whereClause.push({ column: 'branches.is_active', operator: '=', value: true });
      }
      const result = await this.dataService.query('branches', {
        select: [
          'branches.branch_id',
          'branches.branch_name',
          'branches.city',
          'branches.state',
          'branches.lat',
          'branches.lng',
          'branches.delivery_radius_km',
        ],
        where: whereClause,
      });
      return { status: true, data: result?.data || [] };
    } catch {
      return { status: false, data: [] };
    }
  }
}
