import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async toggleShiftStatus(userId: string, requestedActiveState?: boolean) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const boyRes = await this.db.query(
      `SELECT id, is_active, delivery_partner_id, user_id FROM delivery_partners WHERE user_id = $1 OR delivery_partner_id = $1 LIMIT 1`,
      [userId],
    );

    if (!boyRes?.length) {
      throw new NotFoundException('Delivery partner profile not found');
    }

    const currentStatus = Boolean(boyRes[0].is_active);
    const newStatus = typeof requestedActiveState === 'boolean' ? requestedActiveState : !currentStatus;

    if (newStatus === false) {
      const { targetDate, targetSlot } = this.getKolkataDateAndSlot();
      const pendingRes = await this.db.query(
        `SELECT COUNT(*)::int AS pending_count
         FROM orders
         WHERE (delivery_partner_id = $1 OR delivery_partner_id = $2)
           AND scheduled_date = $3::date
           AND delivery_slot = $4
           AND status NOT IN ('delivered', 'failed', 'cancelled')`,
        [boyRes[0].delivery_partner_id, boyRes[0].user_id, targetDate, targetSlot],
      );
      const pendingCount = Number(pendingRes?.[0]?.pending_count ?? 0);
      if (pendingCount > 0) {
        throw new BadRequestException('Cannot go offline. You still have undelivered orders in your queue.');
      }
    }

    await this.db.execute(
      `UPDATE delivery_partners SET is_active = $1, is_online = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, boyRes[0].id],
    );

    return {
      success: true,
      is_active: newStatus,
      is_online: newStatus,
      message: `Shift status updated to ${newStatus ? 'active' : 'inactive'}`,
    };
  }

  private getKolkataDateAndSlot(): { targetDate: string; targetSlot: string } {
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
    const targetSlot = h < 13 || (h === 13 && m < 30) ? 'morning' : 'evening';

    return { targetDate: kolkataDateStr, targetSlot };
  }
}
