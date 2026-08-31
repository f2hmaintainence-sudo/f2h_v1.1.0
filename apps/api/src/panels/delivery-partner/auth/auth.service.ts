import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) { }

  async toggleShiftStatus(userId: string, requestedActiveState?: boolean) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    let boyRes = await this.db.query(
      `SELECT is_active, is_online, is_available, delivery_partner_id
       FROM delivery_partners
       WHERE delivery_partner_id = $1
       LIMIT 1`,
      [userId],
    );

    if (!boyRes?.length) {
      const [userRow] = await this.db.query(
        `SELECT user_id FROM users WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      if (userRow) {
        const [activeBranch] = await this.db.query(
          `SELECT branch_id FROM branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
        );
        const branchId = activeBranch?.branch_id || null;
        await this.db.query(
          `INSERT INTO delivery_partners (delivery_partner_id, branch_id, is_active, is_verified, is_available, is_online, vehicle_type, vehicle_number, created_at, updated_at)
           VALUES ($1, $2, true, true, true, false, 'BIKE', 'N/A', NOW(), NOW())
           ON CONFLICT (delivery_partner_id) DO NOTHING`,
          [userId, branchId],
        );
        boyRes = await this.db.query(
          `SELECT is_active, is_online, is_available, delivery_partner_id
           FROM delivery_partners
           WHERE delivery_partner_id = $1
           LIMIT 1`,
          [userId],
        );
      }
    }

    if (!boyRes?.length) {
      throw new NotFoundException('Delivery partner profile not found');
    }

    const currentStatus = Boolean(boyRes[0].is_online ?? boyRes[0].is_active);
    const newStatus = typeof requestedActiveState === 'boolean' ? requestedActiveState : !currentStatus;

    if (newStatus === false) {
      const { targetDate, targetSlot } = await this.getKolkataDateAndSlot();
      const pendingRes = await this.db.query(
        `SELECT COUNT(*)::int AS pending_count
         FROM orders
         WHERE delivery_partner_id = $1
           AND scheduled_date = $2::date
           AND delivery_slot = $3
           AND status NOT IN ('delivered', 'failed', 'cancelled')`,
        [boyRes[0].delivery_partner_id, targetDate, targetSlot],
      );
      const pendingCount = Number(pendingRes?.[0]?.pending_count ?? 0);
      if (pendingCount > 0) {
        throw new BadRequestException('Cannot go offline. You still have undelivered orders in your queue.');
      }
    }

    await this.db.query(
      `UPDATE delivery_partners
       SET is_online = $1,
           is_available = $1,
           updated_at = NOW()
       WHERE delivery_partner_id = $2`,
      [newStatus, boyRes[0].delivery_partner_id],
    );

    return {
      success: true,
      is_active: boyRes[0].is_active,
      is_online: newStatus,
      message: `Shift status updated to ${newStatus ? 'online' : 'offline'}`,
    };
  }

  private async getKolkataDateAndSlot(): Promise<{ targetDate: string; targetSlot: string }> {
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const timeMinutes = h * 60 + m;

    let morningClosingMinutes = 16 * 60;
    try {
      const rows = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'slot_timings' LIMIT 1`,
      );
      const timings = rows?.[0]?.config_data;
      if (timings?.evening_slot?.customer_cutoff_time) {
        const parts = timings.evening_slot.customer_cutoff_time.split(':');
        if (parts.length >= 2) {
          morningClosingMinutes = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        }
      }
    } catch (_) {}

    const targetSlot = timeMinutes < morningClosingMinutes ? 'morning' : 'evening';
    return { targetDate: kolkataDateStr, targetSlot };
  }
}
