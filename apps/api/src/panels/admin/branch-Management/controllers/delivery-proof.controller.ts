import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { DeliveryProofService } from '../services/delivery-proof.service';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

// ═══════════════════════════════════════════════════════════════
// DeliveryProofController — Phase 6
//
// Base: /zone/delivery
//
// Driver App Endpoints:
//   POST /zone/delivery/delivered        → mark stop delivered
//   POST /zone/delivery/not-home         → mark stop not-home
//   POST /zone/delivery/issue            → mark stop with issue
//   POST /zone/delivery/bulk             → offline bulk sync
//
// Admin Endpoints:
//   GET  /zone/delivery/route/:routeId?date=YYYY-MM-DD   → route proof view
//   GET  /zone/delivery/branch/:branchId?date=YYYY-MM-DD → branch summary
// ═══════════════════════════════════════════════════════════════

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'zone/delivery', version: '1' })
export class DeliveryProofController {
  constructor(private readonly proofService: DeliveryProofService) {}

  // ─── Driver: Mark delivered ────────────────────────────────────
  @Post('delivered')
  async markDelivered(@Body() body: {
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    route_id?: string;
    proof_photo_url?: string;
    delivery_partner_lat?: number;
    delivery_partner_lng?: number;
    delivery_notes?: string;
  }) {
    return this.proofService.markDelivered(body);
  }

  // ─── Driver: Mark not home ─────────────────────────────────────
  @Post('not-home')
  async markNotHome(@Body() body: {
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    route_id?: string;
    delivery_notes?: string;
  }) {
    return this.proofService.markNotHome(body);
  }

  // ─── Driver: Mark issue ────────────────────────────────────────
  @Post('issue')
  async markIssue(@Body() body: {
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    route_id?: string;
    delivery_notes?: string;
    proof_photo_url?: string;
  }) {
    return this.proofService.markIssue(body);
  }

  // ─── Driver: Offline bulk sync ─────────────────────────────────
  @Post('bulk')
  async submitBulkProofs(@Body() body: {
    proofs: Array<{
      subscription_id: string;
      customer_id: string;
      delivery_date: string;
      shift_type: 'morning' | 'evening';
      status: 'delivered' | 'not_home' | 'issue';
      route_id?: string;
      proof_photo_url?: string;
      delivery_partner_lat?: number;
      delivery_partner_lng?: number;
      delivery_notes?: string;
    }>;
  }) {
    return this.proofService.submitBulkProofs(body.proofs);
  }
}
