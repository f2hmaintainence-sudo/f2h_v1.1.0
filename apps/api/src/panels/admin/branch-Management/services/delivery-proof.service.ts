import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

// ═══════════════════════════════════════════════════════════════
// DeliveryProofService — Phase 6
//
// Handles the 3-state delivery lifecycle:
//   pending → delivered | not_home | issue
//
// Each subscription stop for a given date/shift gets ONE row
// in delivery_proof_logs. The driver app calls markDelivered,
// markNotHome, or markIssue. Admin can query proof by date/route.
//
// Offline-first: the driver app queues proofs locally and submits
// in bulk when reconnected. submitBulkProofs handles this batch.
// ═══════════════════════════════════════════════════════════════

export type DeliveryStatus = 'delivered' | 'not_home' | 'issue';

@Injectable()
export class DeliveryProofService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // Mark a stop as DELIVERED (with optional photo proof URL)
  // ═══════════════════════════════════════════════════════════════

  async markDelivered(body: {
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
    return this._upsertProof({ ...body, status: 'delivered' });
  }

  // ═══════════════════════════════════════════════════════════════
  // Mark a stop as NOT HOME
  // ═══════════════════════════════════════════════════════════════

  async markNotHome(body: {
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    route_id?: string;
    delivery_notes?: string;
  }) {
    return this._upsertProof({ ...body, status: 'not_home' });
  }

  // ═══════════════════════════════════════════════════════════════
  // Mark a stop as ISSUE (e.g. locked gate, dog, wrong address)
  // ═══════════════════════════════════════════════════════════════

  async markIssue(body: {
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    route_id?: string;
    delivery_notes?: string;
    proof_photo_url?: string;
  }) {
    return this._upsertProof({ ...body, status: 'issue' });
  }

  // ═══════════════════════════════════════════════════════════════
  // Offline-first: submit a batch of proof records
  // Called by driver app when it reconnects to WiFi/4G
  // ═══════════════════════════════════════════════════════════════

  async submitBulkProofs(proofs: Array<{
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    status: DeliveryStatus;
    route_id?: string;
    proof_photo_url?: string;
    delivery_partner_lat?: number;
    delivery_partner_lng?: number;
    delivery_notes?: string;
  }>) {
    const results = { ok: 0, failed: 0, errors: [] as string[] };

    for (const proof of proofs) {
      try {
        await this._upsertProof(proof);
        results.ok++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`${proof.subscription_id}/${proof.delivery_date}: ${e.message}`);
      }
    }

    return {
      status: true,
      message: `Bulk sync: ${results.ok} OK, ${results.failed} failed.`,
      ...results,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Get all delivery proofs for a route on a given date
  // Used by admin panel to see daily delivery status at a glance
  // ═══════════════════════════════════════════════════════════════

  async getRouteProofs(routeId: string, date: string, shiftType?: 'morning' | 'evening') {
    try {
      let sql = `
        SELECT
          drc.sequence_number,
          dpl.subscription_id,
          dpl.customer_id,
          COALESCE(c.full_name, c.first_name || ' ' || COALESCE(c.last_name, '')) AS customer_name,
          c.phone,
          c.apartment_name,
          dpl.delivery_status,
          dpl.proof_photo_url,
          dpl.delivered_at,
          dpl.delivery_notes,
          dpl.delivery_partner_lat,
          dpl.delivery_partner_lng
        FROM delivery_route_customers drc
        JOIN customers c ON c.id = drc.customer_id
        LEFT JOIN delivery_proof_logs dpl
          ON dpl.customer_id = c.customer_id
          AND dpl.delivery_date = $2
          AND dpl.route_id = $1
      `;
      const params: any[] = [routeId, date];

      if (shiftType) {
        sql += ` AND dpl.shift_type = $3`;
        params.push(shiftType);
      }

      sql += ` WHERE drc.route_id = $1 AND drc.is_active = true ORDER BY drc.sequence_number`;

      const stops = await this.db.query(sql, params);

      // Summary counts
      const delivered = (stops || []).filter((s: any) => s.delivery_status === 'delivered').length;
      const notHome = (stops || []).filter((s: any) => s.delivery_status === 'not_home').length;
      const issue = (stops || []).filter((s: any) => s.delivery_status === 'issue').length;
      const pending = (stops || []).filter((s: any) => !s.delivery_status || s.delivery_status === 'pending').length;

      return {
        status: true,
        data: {
          date,
          stops: stops || [],
          summary: { total: stops?.length || 0, delivered, not_home: notHome, issue, pending },
        },
      };
    } catch (error) {
      this.developer.error('getRouteProofs error', { error });
      throw new InternalServerErrorException('Failed to fetch route proofs');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Get per-branch delivery summary for a date (admin dashboard)
  // ═══════════════════════════════════════════════════════════════

  async getBranchDeliverySummary(branchId: string, date: string, shiftType?: 'morning' | 'evening') {
    try {
      let sql = `
        SELECT
          r.id AS route_id,
          r.route_name,
          r.sector_index,
          COUNT(DISTINCT drc.customer_id)::int AS total_stops,
          COUNT(DISTINCT CASE WHEN dpl.delivery_status = 'delivered' THEN drc.customer_id END)::int AS delivered,
          COUNT(DISTINCT CASE WHEN dpl.delivery_status = 'not_home' THEN drc.customer_id END)::int AS not_home,
          COUNT(DISTINCT CASE WHEN dpl.delivery_status = 'issue' THEN drc.customer_id END)::int AS issue,
          COUNT(DISTINCT CASE WHEN dpl.delivery_status IS NULL OR dpl.delivery_status = 'pending' THEN drc.customer_id END)::int AS pending,
          db.full_name AS delivery_partner_name
        FROM delivery_routes r
        LEFT JOIN delivery_route_customers drc ON drc.route_id = r.id AND drc.is_active = true
        LEFT JOIN customers c ON c.id = drc.customer_id
        LEFT JOIN delivery_proof_logs dpl
          ON dpl.customer_id = c.customer_id
          AND dpl.delivery_date = $2
          AND dpl.route_id = r.id
        LEFT JOIN delivery_partners db ON db.id = r.delivery_partner_id
        WHERE r.branch_id = $1 AND r.is_active = true
      `;
      const params: any[] = [branchId, date];

      if (shiftType) {
        sql += ` AND r.shift_type = $3`;
        params.push(shiftType);
      }

      sql += ` GROUP BY r.id, r.route_name, r.sector_index, db.full_name ORDER BY r.sector_index, r.route_name`;

      const routes = await this.db.query(sql, params);

      const totals = (routes || []).reduce(
        (acc: any, r: any) => ({
          total_stops: acc.total_stops + (r.total_stops || 0),
          delivered: acc.delivered + (r.delivered || 0),
          not_home: acc.not_home + (r.not_home || 0),
          issue: acc.issue + (r.issue || 0),
          pending: acc.pending + (r.pending || 0),
        }),
        { total_stops: 0, delivered: 0, not_home: 0, issue: 0, pending: 0 },
      );

      const completionPct = totals.total_stops > 0
        ? Math.round((totals.delivered / totals.total_stops) * 100)
        : 0;

      return {
        status: true,
        data: {
          date,
          branch_id: branchId,
          routes: routes || [],
          totals: { ...totals, completion_percent: completionPct },
        },
      };
    } catch (error) {
      this.developer.error('getBranchDeliverySummary error', { error });
      throw new InternalServerErrorException('Failed to fetch branch delivery summary');
    }
  }

  // ─── Internal: upsert a single proof record ──────────────────

  private async _upsertProof(data: {
    subscription_id: string;
    customer_id: string;
    delivery_date: string;
    shift_type: 'morning' | 'evening';
    status: DeliveryStatus;
    route_id?: string;
    proof_photo_url?: string;
    delivery_partner_lat?: number;
    delivery_partner_lng?: number;
    delivery_notes?: string;
  }) {
    try {
      await this.db.query(
        `INSERT INTO delivery_proof_logs
           (subscription_id, customer_id, delivery_date, shift_type, delivery_status,
            route_id, proof_photo_url, delivered_at, delivery_partner_lat, delivery_partner_lng, delivery_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
           CASE WHEN $5 = 'delivered' THEN NOW() ELSE NULL END,
           $8, $9, $10)
         ON CONFLICT (subscription_id, delivery_date, shift_type) DO UPDATE
           SET delivery_status   = EXCLUDED.delivery_status,
               proof_photo_url   = COALESCE(EXCLUDED.proof_photo_url, delivery_proof_logs.proof_photo_url),
               delivered_at      = CASE WHEN EXCLUDED.delivery_status = 'delivered' THEN NOW() ELSE delivery_proof_logs.delivered_at END,
               delivery_partner_lat  = COALESCE(EXCLUDED.delivery_partner_lat, delivery_proof_logs.delivery_partner_lat),
               delivery_partner_lng  = COALESCE(EXCLUDED.delivery_partner_lng, delivery_proof_logs.delivery_partner_lng),
               delivery_notes    = COALESCE(EXCLUDED.delivery_notes, delivery_proof_logs.delivery_notes)`,
        [
          data.subscription_id,
          data.customer_id,
          data.delivery_date,
          data.shift_type,
          data.status,
          data.route_id || null,
          data.proof_photo_url || null,
          data.delivery_partner_lat || null,
          data.delivery_partner_lng || null,
          data.delivery_notes || null,
        ],
      );

      return { status: true, delivery_status: data.status };
    } catch (error: any) {
      this.developer.error('_upsertProof error', { error });
      throw new InternalServerErrorException(`Failed to record proof: ${error.message}`);
    }
  }
}
