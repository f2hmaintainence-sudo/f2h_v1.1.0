import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ZoneExpansionService } from '../services/zone-expansion.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/zone-expansion', version: '1' })
export class ZoneExpansionAdminController {
  constructor(private readonly zoneExpansionService: ZoneExpansionService) {}

  // GET /admin/zone-expansion/requests?branchId=&status=&page=&limit=
  @Get('requests')
  async getRequests(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.zoneExpansionService.getAdminRequests({
      branchId: branchId || undefined,
      status: status || undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // GET /admin/zone-expansion/insights
  @Get('insights')
  async getInsights() {
    return this.zoneExpansionService.getAdminInsights();
  }

  // GET /admin/zone-expansion/pins?branchId=
  @Get('pins')
  async getMapPins(@Query('branchId') branchId?: string) {
    return this.zoneExpansionService.getMapPins(branchId || undefined);
  }

  // PATCH /admin/zone-expansion/:requestId/status
  @Patch(':requestId/status')
  async updateStatus(
    @Param('requestId') requestId: string,
    @Body('status') status: 'pending' | 'noted' | 'rejected',
  ) {
    return this.zoneExpansionService.updateStatus(requestId, status);
  }
}
