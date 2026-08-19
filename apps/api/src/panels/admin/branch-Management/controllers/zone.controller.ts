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
import { CustomerTableService } from '../services/table.service';
import { BranchShowAddService } from '../services/showAdd.service';
import { BranchSaveAddService } from '../services/saveAdd.service';
import { BranchShowEditService } from '../services/showEdit.service';
import { BranchSaveEditService } from '../services/saveEdit.service';
import { SectorService } from '../ModuleServices/sector.service';
import { RouteService } from '../services/route.service';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { CreateZoneDto } from '../dto/zone.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/zone', version: '1' })
export class ZoneController {
  constructor(
    private readonly tableService: CustomerTableService,
    private readonly showAddService: BranchShowAddService,
    private readonly saveAddService: BranchSaveAddService,
    private readonly showEditService: BranchShowEditService,
    private readonly saveEditService: BranchSaveEditService,
    private readonly sectorService: SectorService,
    private readonly routeService: RouteService,
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
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

  // ─── Driver app: get MY route for today (startup call) ────────
  // Used by Flutter app on init — returns route_id, route_name,
  // total_stops, shift_type, and whether it is an override day.
  @Get('delivery-boys/:deliveryPartnerId/my-route')
  async getMyRoute(
    @Param('deliveryPartnerId') deliveryPartnerId: string,
    @Query('date') date?: string,
    @Query('shift_type') shiftType?: 'morning' | 'evening',
  ) {
    return this.routeService.getMyRoute(deliveryPartnerId, date, shiftType);
  }

  // ═══════════════════════════════════════════════════════════════
  // ROUTE-BASED MICRO-MANAGEMENT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════


  // ─── Create a route inside a sector ───────────────────────────
  @Post('routes')
  async createRoute(@Body() body: {
    branch_id: string;
    sector_index: number;
    route_name: string;
    shift_type?: 'morning' | 'evening';
    delivery_partner_id?: string;
    max_stops?: number;
  }) {
    return this.routeService.createRoute(body);
  }

  // ─── Driver order view (backward-compat alias for run sheet) ──
  @Get('routes/:routeId/runsheet')
  async getRunSheet(
    @Param('routeId') routeId: string,
    @Query('date') date?: string,
  ) {
    return this.routeService.getDriverOrderView(routeId, date);
  }

  // ─── Get customers in a route (ordered) ───────────────────────
  @Get('routes/:routeId/customers')
  async getRouteCustomers(@Param('routeId') routeId: string) {
    return this.routeService.getRouteCustomers(routeId);
  }

  // ─── Assign delivery boy to a route ───────────────────────────
  @Patch('routes/:routeId/assign-boy')
  async assignBoyToRoute(
    @Param('routeId') routeId: string,
    @Body() body: { delivery_partner_id: string },
  ) {
    return this.routeService.assignBoyToRoute(routeId, body.delivery_partner_id);
  }

  // ─── Add customer to a route ──────────────────────────────────
  @Post('routes/:routeId/add-customer')
  async assignCustomerToRoute(
    @Param('routeId') routeId: string,
    @Body() body: { customer_id: string; sequence_number?: number },
  ) {
    return this.routeService.assignCustomerToRoute(routeId, body.customer_id, body.sequence_number);
  }

  // ─── Remove customer from a route ─────────────────────────────
  @Delete('routes/:routeId/remove-customer/:customerId')
  async removeCustomerFromRoute(
    @Param('routeId') routeId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.routeService.removeCustomerFromRoute(routeId, customerId);
  }

  // ─── Reorder customers in a route (drag-and-drop) ─────────────
  @Patch('routes/:routeId/reorder')
  async reorderRouteCustomers(
    @Param('routeId') routeId: string,
    @Body() body: { ordered_customer_ids: string[] },
  ) {
    return this.routeService.reorderRouteCustomers(routeId, body.ordered_customer_ids);
  }

  // ─── Delete a route ───────────────────────────────────────────
  @Delete('routes/:routeId')
  async deleteRoute(@Param('routeId') routeId: string) {
    return this.routeService.deleteRoute(routeId);
  }

  // ─── Get all routes for a branch ──────────────────────────────
  @Get('routes/:branchId')
  async getRoutesForBranch(@Param('branchId') branchId: string) {
    return this.routeService.getRoutesForBranch(branchId);
  }

  // ─── Driver app order view (replaces run sheet) ───────────────
  @Get('routes/:routeId/driver-view')
  async getDriverOrderView(
    @Param('routeId') routeId: string,
    @Query('date') date?: string,
  ) {
    return this.routeService.getDriverOrderView(routeId, date);
  }

  // ─── Get routes for a specific sector (MUST be after specific routes) ─
  @Get('routes/:branchId/:sectorIndex')
  async getRoutesForSector(
    @Param('branchId') branchId: string,
    @Param('sectorIndex') sectorIndex: string,
  ) {
    return this.routeService.getRoutesForSector(branchId, parseInt(sectorIndex));
  }

  // ─── Get unrouted customers in a sector (paginated) ──────────
  @Get('unrouted/:branchId/:sectorIndex')
  async getUnroutedCustomers(
    @Param('branchId') branchId: string,
    @Param('sectorIndex') sectorIndex: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.routeService.getUnroutedCustomers(
      branchId,
      parseInt(sectorIndex),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  // ─── Auto-group unrouted customers (GPS-first geo-clustering) ─
  @Post('routes/:branchId/:sectorIndex/auto-group')
  async autoGroupCustomers(
    @Param('branchId') branchId: string,
    @Param('sectorIndex') sectorIndex: string,
    @Query('force') force?: string,
    @Query('maxStops') maxStops?: string,
    @Query('clusterRadiusM') clusterRadiusM?: string,
    @Query('shiftType') shiftType?: 'morning' | 'evening',
  ) {
    return this.routeService.autoGroupCustomers(
      branchId,
      parseInt(sectorIndex),
      {
        force: force === 'true',
        maxStops: maxStops ? parseInt(maxStops) : 40,
        clusterRadiusM: clusterRadiusM ? parseInt(clusterRadiusM) : 300,
        shiftType: shiftType || 'morning',
      },
    );
  }

  // ─── Optimize route sequence (TSP nearest-neighbor) ───────────
  @Post('routes/:routeId/optimize-sequence')
  async optimizeRouteSequence(@Param('routeId') routeId: string) {
    return this.routeService.optimizeRouteSequence(routeId);
  }

  // ─── Temporary route reassignment (sick day) ──────────────────
  @Post('routes/:routeId/temporary-reassign')
  async temporaryReassignRoute(
    @Param('routeId') routeId: string,
    @Body() body: {
      delivery_partner_id: string;
      date: string;
      reason?: string;
      admin_id?: string;
    },
    @Req() req: any,
  ) {
    return this.routeService.temporaryReassignRoute(
      routeId,
      body.delivery_partner_id,
      body.date,
      body.reason,
      req.user?.user_id ?? body.admin_id,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY ZONE ENDPOINTS (kept for backward compatibility)
  // ═══════════════════════════════════════════════════════════════

  @Get('table')
  async getZoneTable(@Query() query: any) {
    return this.tableService.getZoneTable(query);
  }

  @Get('showAdd')
  async showZoneAdd() {
    return this.showAddService.zoneShowAddForm();
  }

  @Post('saveAdd')
  async saveZoneAdd(@Body() body: CreateZoneDto, @Req() req: any) {
    const adminId = req.user?.user_id ?? null;
    return this.saveAddService.saveZone(body, adminId);
  }

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

  @Get(':id/view')
  async getZoneView(@Param('id') id: string) {
    try {
      const zoneResult = await this.dataService.query('zones', {
        select: ['zones.*'],
        where: [{ column: 'zones.id', operator: '=', value: id }],
        limit: 1,
      });
      if (!zoneResult?.data?.length) {
        return { status: false, message: 'Zone not found' };
      }

      const hexagons = await this.db.query(
        `SELECT h3_index, h3_resolution FROM zone_hexagons WHERE zone_id = $1`,
        [id],
      );

      return {
        status: true,
        data: {
          ...zoneResult.data[0],
          hexagons: hexagons || [],
          hexagon_count: hexagons?.length || 0,
        },
      };
    } catch {
      return { status: false, message: 'Failed to load zone' };
    }
  }

  @Get(':id/editData')
  async getZoneEditData(@Param('id') id: string) {
    return this.showEditService.getZoneEditData(id);
  }

  @Get(':id/showEdit')
  async showZoneEdit(@Param('id') id: string) {
    return this.showEditService.getZoneEditForm(id);
  }

  @Post(':id/saveEdit')
  async saveZoneEdit(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.user_id ?? null;
    return this.saveEditService.saveZoneEdit(id, body, adminId);
  }

  @Post(':id/softDelete')
  async deleteZone(@Param('id') id: string) {
    try {
      await this.db.query('DELETE FROM zone_hexagons WHERE zone_id = $1', [id]);
      await this.db.query('DELETE FROM zones WHERE id = $1', [id]);
      return { status: true, message: 'Zone deleted completely' };
    } catch (error) {
      return { status: false, message: 'Failed to delete zone', error: String(error) };
    }
  }
}
