import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthService as SharedAuthService } from 'src/auth/auth.service';

@Injectable()
export class AuthService extends SharedAuthService {
  async toggleShiftStatus(userId: string, requestedActiveState?: boolean) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const boyRes = await (this as any).DataBase.query(
      `SELECT id, is_active, delivery_partner_id, user_id FROM delivery_partners WHERE user_id = $1 OR delivery_partner_id = $1 LIMIT 1`,
      [userId],
    );

    if (!boyRes?.length) {
      throw new NotFoundException('Delivery partner profile not found');
    }

    const currentStatus = Boolean(boyRes[0].is_active);
    const newStatus = typeof requestedActiveState === 'boolean' ? requestedActiveState : !currentStatus;

    if (newStatus === false) {
      const pendingRes = await (this as any).DataBase.query(
        `SELECT COUNT(*)::int AS pending_count 
         FROM orders 
         WHERE (delivery_partner_id::text = $1::text OR delivery_partner_id::text = $2::text)
           AND status IN ('assigned', 'out_for_delivery')
           AND (scheduled_date = CURRENT_DATE OR created_at::date = CURRENT_DATE)`,
        [boyRes[0].delivery_partner_id, boyRes[0].user_id],
      );
      const pendingCount = Number(pendingRes?.[0]?.pending_count ?? 0);
      if (pendingCount > 0) {
        throw new BadRequestException('Cannot go offline. You still have undelivered orders in your queue.');
      }
    }

    await (this as any).DataBase.execute(
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
}

