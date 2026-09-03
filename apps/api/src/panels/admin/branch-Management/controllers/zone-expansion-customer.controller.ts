import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZoneExpansionService } from '../services/zone-expansion.service';

@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'customer/zone-expansion', version: '1' })
export class ZoneExpansionCustomerController {
  constructor(private readonly zoneExpansionService: ZoneExpansionService) {}

  /**
   * POST /v1/customer/zone-expansion/request
   * Submit or update a zone expansion request for the authenticated customer.
   *
   * Body: { latitude, longitude, address_label?, description? }
   *
   * Customer identity is resolved server-side via JWT → user_id → JOIN users.
   * Do NOT send customer_name — it is looked up from the users table.
   *
   * Triggers: When customer's pinned location is outside branch delivery radius.
   * Use case: Mobile map screen shows "Location is outside service boundary" →
   *           customer taps "Request Zone Expansion" → calls this endpoint.
   */
  @Post('request')
  async submitRequest(
    @Req() req: any,
    @Body()
    body: {
      latitude: number;
      longitude: number;
      address_label?: string;
      description?: string;
    },
  ) {
    const customerId: string = req.user?.user_id || req.user?.id || req.user?.sub;
    return this.zoneExpansionService.submitRequest(customerId, body);
  }

  /**
   * GET /v1/customer/zone-expansion/my-requests
   * Fetch the authenticated customer's own zone expansion requests.
   *
   * Use case: Mobile profile screen → "Zone Requests" menu item → calls this endpoint.
   * Returns: array of requests with status, branch_name, distance_km, created_at.
   */
  @Get('my-requests')
  async getMyRequests(@Req() req: any) {
    const customerId: string = req.user?.user_id || req.user?.id || req.user?.sub;
    return this.zoneExpansionService.getCustomerRequests(customerId);
  }
}
