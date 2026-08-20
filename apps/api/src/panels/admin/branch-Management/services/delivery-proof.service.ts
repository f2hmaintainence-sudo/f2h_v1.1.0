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
